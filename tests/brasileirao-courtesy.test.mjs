import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {readRecord,writeRecord,updateRecord} from '../server/store.mjs';
import {checkout,quoteCheckout,purchaseAccess,purchaseLicenses,shop,refreshOrder} from '../server/commerce.mjs';
import {COURTESY_CODE,SOURCE_COLLECTION,prepareBrasileiraoCourtesy,releaseBrasileiraoCourtesy,runBrasileiraoCourtesyEmails,courtesyRecipients} from '../server/brasileirao-courtesy.mjs';
import {brasileiraoCourtesyEmail} from '../server/brasileirao-courtesy-email.mjs';
import {saveCartCoupon} from '../server/cart-coupons.mjs';
import handler from '../server/handler.mjs';
import seed from '../data/catalog.json' with {type:'json'};

test('Brasileirão courtesy: held campaign, eligible buyers, one atomic free redemption and protected license',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'tl-courtesy-'));
 const keys=['DATABASE_URL','POSTGRES_URL','VERCEL','BLOB_READ_WRITE_TOKEN','LOCAL_DATA_DIR','ASAAS_ENVIRONMENT','ASAAS_API_KEY','PAYPAL_ENVIRONMENT','PAYPAL_CLIENT_ID','PAYPAL_CLIENT_SECRET','RESEND_API_KEY','EMAIL_FROM','SITE_URL','ADMIN_SESSION_SECRET'];
 const env=Object.fromEntries(keys.map(k=>[k,process.env[k]])),fetchBefore=globalThis.fetch;
 for(const k of keys)delete process.env[k];
 Object.assign(process.env,{LOCAL_DATA_DIR:dir,ASAAS_ENVIRONMENT:'sandbox',PAYPAL_ENVIRONMENT:'sandbox',RESEND_API_KEY:'test-only',EMAIL_FROM:'test@example.invalid',SITE_URL:'https://www.tiolira.com.br',ADMIN_SESSION_SECRET:'test-only-session-key-at-least-32-chars'});
 let deliveries=[];globalThis.fetch=async(url,opts)=>{assert.equal(url,'https://api.resend.com/emails');deliveries.push(JSON.parse(opts.body));assert.ok(opts.headers['Idempotency-Key']);return {ok:true,json:async()=>({id:'email-'+deliveries.length})};};
 const a={id:randomUUID(),name:'Buyer A',email:'a@example.invalid',country:'Brasil',countryCode:'BR'},b={id:randomUUID(),name:'Buyer B',email:'b@example.invalid',country:'España',countryCode:'ES'},outsider={id:randomUUID(),name:'Other',email:'other@example.invalid',country:'Brasil'};
 const data={...structuredClone(seed),collections:[{id:SOURCE_COLLECTION,name:'Noéis Brasileirão',published:true,comingSoon:true,free:false},{id:'gift-collection',name:'Outra coleção',published:true,free:false,comingSoon:false,priceCents:9990}],products:[{id:'source',name:'Noel source',slug:'source',collection:SOURCE_COLLECTION,published:true,access:'paid',filePath:'models/source.3mf',priceCents:1990},...['gift-a','gift-b','gift-c'].map(id=>({id,name:id,slug:id,collection:'gift-collection',published:true,access:'paid',filePath:`models/${id}.3mf`,priceCents:8994,priceUsdCents:1499}))]};
 const sourceOrder=(m,id)=>({id,memberId:m.id,memberName:m.name,memberEmail:m.email,provider:m===b?'paypal':'asaas',environment:'sandbox',status:'paid',totalCents:1990,createdAt:'2026-11-08T00:00:00.000Z',productIds:['source'],items:[{kind:'product',id:'source',collection:SOURCE_COLLECTION,products:[{id:'source',name:'Noel source'}]}],lang:m===b?'es':'pt'});
 const input=(id='gift-a')=>({items:[{kind:'product',id}],couponCode:COURTESY_CODE,requestId:randomUUID(),expectedTotalCents:0,lang:'pt'});
 const call=async(route,method='GET',body={})=>{let result;await handler({method,url:'/api/'+route,body,headers:{host:'localhost',origin:'http://localhost'},socket:{remoteAddress:'test'}},{setHeader(){},set statusCode(v){this.status=v},end(v){result={status:this.status||200,body:JSON.parse(v)}}});return result;};
 try{
  await writeRecord('catalog.json',data,null);await writeRecord('club-members.json',{members:[a,b,outsider]},null);await writeRecord('commerce.json',{orders:[sourceOrder(a,'order-a'),sourceOrder(b,'order-b')],downloads:{}},null);
  await t.test('campaign endpoints require admin and reserved code cannot become a global coupon',async()=>{
   for(const [path,method] of [['admin/brasileirao-update','GET'],['admin/brasileirao-update/prepare','POST'],['admin/brasileirao-update/release','POST']])assert.equal((await call(path,method)).status,401);
   await assert.rejects(()=>saveCartCoupon({revision:null,item:{id:randomUUID(),code:COURTESY_CODE,type:'percent',value:99,active:true}}),/reservado/);
  });
  await t.test('prepare persists two held recipients; cron and checkout cannot send or redeem',async()=>{
   let report=await prepareBrasileiraoCourtesy();assert.equal(report.campaign.status,'awaiting_files');assert.equal(report.campaign.coupon.active,false);assert.equal(report.campaign.recipients.length,2);assert.deepEqual(report.campaign.recipients.map(r=>r.language),['pt','es']);
   const created=report.campaign.createdAt;report=await prepareBrasileiraoCourtesy();assert.equal(report.campaign.createdAt,created);assert.equal(report.campaign.recipients.length,2);
   assert.deepEqual(await runBrasileiraoCourtesyEmails(),{sent:0});assert.equal(deliveries.length,0);
   await assert.rejects(()=>quoteCheckout(a,input()),/aguarda/);await assert.rejects(()=>checkout(a,input()),/aguarda/);
   await assert.rejects(()=>releaseBrasileiraoCourtesy({}),/Confirme/);
   await assert.rejects(()=>releaseBrasileiraoCourtesy({confirmation:'ARQUIVOS ATUALIZADOS; LIBERAR E ENVIAR'}),/preparação/);
  });
  await t.test('audience excludes unpaid/refunded/wrong collection, groups duplicate email and includes bundle snapshots',()=>{
   const orders=[sourceOrder(a,'oa'),{...sourceOrder(a,'dup'),memberId:'dup'},{...sourceOrder(b,'pending'),status:'pending'},{...sourceOrder(b,'revoked'),status:'revoked'},{...sourceOrder(b,'zero'),totalCents:0},{...sourceOrder(b,'wrong'),items:[],productIds:['gift-a']},{...sourceOrder(b,'prod'),environment:'production'},{...sourceOrder(b,'future'),createdAt:'2030-01-01'}, {...sourceOrder(b,'bundle'),items:[{kind:'collection',id:SOURCE_COLLECTION}],productIds:['old-deleted-id']}];
   const rs=courtesyRecipients(orders,[a,b,{...a,id:'dup',email:a.email.toUpperCase()}],data,'2026-11-09');assert.equal(rs.length,2);assert.equal(rs[0].memberIds.length,2);assert.deepEqual(rs[1].orderIds,['bundle']);
  });
  await t.test('release requires explicit confirmation and available files; quote gives full individual price only',async()=>{
   const ready=structuredClone(data);ready.collections[0].comingSoon=false;await writeRecord('catalog.json',ready,(await readRecord('catalog.json')).etag);
   const report=await releaseBrasileiraoCourtesy({confirmation:'ARQUIVOS ATUALIZADOS; LIBERAR E ENVIAR'});assert.equal(report.campaign.coupon.active,true);assert.equal(report.campaign.status,'sending');assert.equal(deliveries.length,0);
   const q=await quoteCheckout(a,input());assert.equal(q.totalCents,0);assert.equal(q.discountCents,8994);assert.equal(q.couponDiscountCents,8994);assert.equal(q.promotion,null);assert.equal(q.natalPromotion,null);assert.ok(q.courtesy);assert.equal(q.items[0].totalCents,0);
   await assert.rejects(()=>quoteCheckout(outsider,input()),/exclusivo/);
   await assert.rejects(()=>quoteCheckout(a,{...input(),items:[{kind:'collection',id:'gift-collection'}]}),/individual/);
   await assert.rejects(()=>quoteCheckout(a,{...input(),items:[{kind:'product',id:'gift-a'},{kind:'product',id:'gift-b'}]}),/individual/);
   await assert.rejects(()=>quoteCheckout(a,{...input(),items:[{kind:'product',id:'source'}]}),/já possui/);
   ready.collections[1].comingSoon=true;await writeRecord('catalog.json',ready,(await readRecord('catalog.json')).etag);await assert.rejects(()=>checkout(a,input()),/preparação/);
   ready.collections[1].comingSoon=false;await writeRecord('catalog.json',ready,(await readRecord('catalog.json')).etag);
  });
  await t.test('two concurrent requests unlock only one model, retry is idempotent, no gateway or CPF needed',async()=>{
   const requests=[input('gift-a'),input('gift-b')];const results=await Promise.allSettled(requests.map(i=>checkout(a,i)));assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.match(results.find(r=>r.status==='rejected').reason.message,/já utilizou/);
   const index=results.findIndex(r=>r.status==='fulfilled'),order=results[index].value;assert.equal(order.totalCents,0);assert.equal(order.status,'paid');assert.equal(order.provider,'promotion');assert.equal(order.licenses.length,1);
   assert.equal((await checkout(a,requests[index])).id,order.id);assert.equal(await purchaseAccess(a,requests[index].items[0].id),true);assert.equal((await purchaseLicenses(a)).length,1);
   assert.ok((await shop(a)).products.find(p=>p.id===requests[index].items[0].id).downloadUrl);assert.equal((await refreshOrder(a,order.id)).status,'paid');assert.equal(deliveries.length,0);
   await assert.rejects(()=>checkout(a,input('gift-c')),/já utilizou/);
  });
  await t.test('international customer redeems USD gift with the same protected zero-payment path',async()=>{
   const quote=await quoteCheckout(b,input('gift-c'));assert.equal(quote.currency,'USD');assert.equal(quote.subtotalCents,1499);
   const order=await checkout(b,{...input('gift-c'),lang:'es'});assert.equal(order.currency,'USD');assert.equal(order.totalCents,0);assert.equal(order.licenses.length,1);assert.equal(deliveries.length,0);
  });
  await t.test('released notices send once per recipient with logo and correct language',async()=>{
   assert.deepEqual(await runBrasileiraoCourtesyEmails(),{sent:2});assert.equal(deliveries.length,2);assert.match(deliveries[0].html,/lang="pt"/);assert.match(deliveries[1].html,/lang="es"/);
   assert.match(deliveries[0].text,/barba e a parte branca do gorro/);assert.match(deliveries[0].html,/tl-monogram-3d-icon/);assert.match(deliveries[0].text,/BRASILEIRAO_CARINHO/);
   assert.deepEqual(await runBrasileiraoCourtesyEmails(),{sent:0});assert.equal(deliveries.length,2);await assert.rejects(()=>prepareBrasileiraoCourtesy(),/já foi liberada/);
  });
 }finally{globalThis.fetch=fetchBefore;for(const k of keys){if(env[k]===undefined)delete process.env[k];else process.env[k]=env[k];}await rm(dir,{recursive:true,force:true});}
});
test('email translations preserve repair scope, individual gift and secure account link',()=>{
 for(const l of ['pt','en','es','fr']){const e=brasileiraoCourtesyEmail(l,'https://www.tiolira.com.br');assert.match(e.html,new RegExp('lang="'+l+'"'));assert.match(e.text,new RegExp('/'+l+'/clube#compras'));assert.match(e.text,/BRASILEIRAO_CARINHO/);assert.ok(!e.text.includes('/api/download'));}
 assert.throws(()=>brasileiraoCourtesyEmail('pt','http://unsafe.test'));assert.throws(()=>brasileiraoCourtesyEmail('xx','https://www.tiolira.com.br'));
});
