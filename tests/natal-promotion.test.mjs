import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {natalState,natalActive,NATAL_START,NATAL_END,NATAL_COLLECTION_IDS,campaignId} from '../lib/natal-promotion.mjs';
import {discountQuote} from '../server/cart-coupons.mjs';
import {memberNatalState} from '../server/natal-promotion.mjs';
import {cartSelection} from '../lib/cart-lines.mjs';
import {FAMILY_COLLECTION_ID as F} from '../lib/family-discount.mjs';
import {checkout,quoteCheckout,quoteCart,shop,paymentDetails,purchaseAccess,purchaseLicenses,downloadablePurchaseLicense} from '../server/commerce.mjs';
import {writeRecord,readRecord} from '../server/store.mjs';
import {makeSession} from '../server/auth.mjs';
import handler from '../server/handler.mjs';
import {marketCatalog} from '../lib/international-pricing.mjs';
const now=Date.parse('2026-11-15T12:00:00Z');
for(const N of NATAL_COLLECTION_IDS){
const P=campaignId(N);
const campaign=state=>state.campaigns?.find(c=>c.collectionId===N)||state;
const products=Array.from({length:5},(_,i)=>({id:`noel-${i}`,name:`Noel ${i}`,slug:`noel-${i}`,collection:N,access:'paid',published:true,priceCents:1990,filePath:`models/noel-${i}.3mf`,image:'/assets/demo.jpg',printProfiles:[{id:'fine',name:'0.16 mm',filePath:`models/noel-${i}-fine.3mf`,published:true},{id:'fast',name:'0.20 mm',filePath:`models/noel-${i}-fast.3mf`,published:true}]}));
const data={collections:[{id:N,name:'Natal Brasileiro',published:true,free:false,priceCents:0},{id:'other',name:'Other',published:true,free:false},{id:F,name:'Família',published:true,free:false}],products:[...products,{...products[0],id:'free-noel',access:'site',priceCents:0},{...products[0],id:'other-piece',collection:'other',priceCents:1290},{...products[0],id:'family-piece',collection:F,priceCents:1290}]};
const selections=ids=>ids.map(id=>({kind:'product',id}));
const previous=(memberId,count,status='paid')=>Array.from({length:count},(_,i)=>({id:randomUUID(),memberId,status,provider:'asaas',environment:'sandbox',currency:'BRL',totalCents:1990,createdAt:'2026-10-30T12:00:00Z',items:[{kind:'product',id:`noel-${i}`,collection:N,priceCents:1990,products:[{id:`noel-${i}`,name:`Noel ${i}`}]}],productIds:[`noel-${i}`]}));
const coupon={id:randomUUID(),code:'TEN',type:'percent',value:10,minimumCents:0,active:true};
const quote=(ids,prior=0,orders)=>discountQuote(quoteCart(data,selections(ids)), '',[],now,natalState(orders||previous('a',prior),data.products,'a',now,N));

test(`${N}: dates, thresholds, exclusions and non-stacking`,()=>{
 assert.equal(natalActive(Date.parse(NATAL_START)-1),false);assert.equal(natalActive(Date.parse(NATAL_START)),true);
 assert.equal(natalActive(Date.parse(NATAL_END)-1),true);assert.equal(natalActive(Date.parse(NATAL_END)),false);
 for(const [qty,total] of [[1,1990],[2,2985],[3,3980],[4,5970],[5,7960]])assert.equal(quote(products.slice(0,qty).map(p=>p.id)).totalCents,total);
 assert.equal(quote(['noel-4'],1).totalCents,995);assert.equal(quote(['noel-3','noel-4'],1).totalCents,1990);
 for(const prior of [2,3,4])assert.equal(quote(['noel-4'],prior).totalCents,0);
 assert.equal(quote(['noel-2','noel-3','other-piece']).totalCents,4275);
 assert.equal(quote(['other-piece'],3).totalCents,1290);
 assert.throws(()=>quoteCart(data,selections(['free-noel'])));
 assert.throws(()=>quoteCart(data,[{kind:'product',id:'noel-0',quantity:2}]));
 assert.equal(quoteCart(data,selections(['noel-0','noel-0'])).items.length,1);
 const context=natalState([],data.products,'a',now,N);
 assert.throws(()=>discountQuote(quoteCart(data,selections(['noel-0','noel-1'])),coupon.code,[coupon],now,context),/não acumula/);
 const mixed=discountQuote(quoteCart(data,[...selections(['noel-0','noel-1','other-piece']),{kind:'product',id:'family-piece',quantity:3}]),coupon.code,[coupon],now,context);
 assert.equal(mixed.natalPromotion.discountCents,995);assert.equal(mixed.promotion.discountCents,387);assert.equal(mixed.couponDiscountCents,129);
 assert.equal(mixed.totalCents,3980+1290+3870-995-387-129);
 const unequal=structuredClone(data);unequal.products[0].priceCents=1001;
 const uq=discountQuote(quoteCart(unequal,selections(['noel-0','noel-1'])),'',[],now,context);assert.equal(uq.natalPromotion.discountCents,501);assert.equal(uq.totalCents,2490);
});
test(`${N}: historical eligibility counts only distinct full-price confirmed purchases`,()=>{
 const orders=previous('a',3);orders.push({...orders[0],id:'duplicate'});orders.push(...previous('b',4));
 orders[1].items[0].discountCents=100;orders[1].items[0].totalCents=1890;
 orders[2].status='refunded';
 assert.equal(natalState(orders,data.products,'a',now,N).previousCount,1);
 orders.push({...previous('a',1)[0],id:'promotion-used',natalPromotion:{id:P},status:'paid'});
 const state=natalState(orders,data.products,'a',now,N);assert.equal(state.used,true);assert.equal(quote(['noel-4'],0,orders).totalCents,1990);
 orders.at(-1).status='pending';assert.equal(natalState(orders,data.products,'a',now,N).reserved,true);
 assert.equal(quote(['noel-3','noel-4'],0,orders).totalCents,3980);
});
test(`${N}: checkout and free redemption integrate with existing payment, files and licenses`,async t=>{
 const dir=await mkdtemp(join(tmpdir(),'tiolira-natal-test-')),keys=['DATABASE_URL','POSTGRES_URL','VERCEL','BLOB_READ_WRITE_TOKEN','LOCAL_DATA_DIR','ASAAS_ENVIRONMENT','ASAAS_API_KEY','PAYPAL_ENVIRONMENT','PAYPAL_CLIENT_ID','PAYPAL_CLIENT_SECRET','ADMIN_SESSION_SECRET','RESEND_API_KEY','ASAAS_WEBHOOK_TOKEN','PAYPAL_MERCHANT_ID','PAYPAL_WEBHOOK_ID','SITE_URL'];
 const env=Object.fromEntries(keys.map(k=>[k,process.env[k]])),oldFetch=globalThis.fetch;
 for(const k of keys)delete process.env[k];
 Object.assign(process.env,{LOCAL_DATA_DIR:dir,ASAAS_ENVIRONMENT:'sandbox',ASAAS_API_KEY:'test-only',ASAAS_WEBHOOK_TOKEN:'natal-test-webhook-secret-more-than-32-chars',SITE_URL:'https://www.tiolira.com.br',PAYPAL_MERCHANT_ID:'merchant-test',PAYPAL_WEBHOOK_ID:'webhook-test',PAYPAL_ENVIRONMENT:'sandbox',PAYPAL_CLIENT_ID:'test-only',PAYPAL_CLIENT_SECRET:'test-only',ADMIN_SESSION_SECRET:'natal-local-test-secret-at-least-32-characters'});t.mock.timers.enable({apis:['Date'],now});
 const a={id:randomUUID(),version:randomUUID(),name:'Test A',email:'a@example.invalid',cpfCnpj:''},b={...a,id:randomUUID(),email:'b@example.invalid'},us={...a,id:randomUUID(),email:'us@example.invalid',countryCode:'US',country:'United States'};
 const save=async orders=>writeRecord('commerce.json',{orders,downloads:{},recentDownloads:[]},(await readRecord('commerce.json'))?.etag||null);
 const input=(ids,total)=>({items:selections(ids),requestId:randomUUID(),billingType:'PIX',lang:'pt',expectedTotalCents:total});
 let network=0;globalThis.fetch=async()=>{network++;throw Error('Unexpected network call');};
 try{
  await writeRecord('catalog.json',data,null);await writeRecord('club-members.json',{members:[a,b,us]},null);await save([...previous(a.id,3),...previous(us.id,2)]);
  await t.test('browser and backend totals agree in BRL and USD, including mixed carts',async()=>{
   for(const m of [a,b,us])for(const ids of [['noel-3'],['noel-3','noel-4'],['noel-3','other-piece']]){
    const store=await shop(m),back=await quoteCheckout(m,{items:selections(ids)}),front=cartSelection(store,selections(ids));assert.equal(front.total,back.totalCents);
   }
   const orders=[...previous(b.id,3)];orders.forEach(o=>o.environment='production');assert.equal(memberNatalState(orders,b.id,data,now).previousCount,0);
   assert.equal(campaign((await shop(a)).natalCampaign).previousCount,3);assert.equal((await shop(us)).currency,'USD');
  });
  let gift;
  await t.test('atomic free gift, duplicate retries, all profiles and PDF license, no payment or email',async()=>{
   const request=input(['noel-3'],0),results=await Promise.all([checkout(a,request),checkout(a,request)]);gift=results[0];assert.equal(gift.id,results[1].id);assert.equal(gift.licenses[0].code,results[1].licenses[0].code);
   assert.equal(gift.totalCents,0);assert.equal(gift.status,'paid');assert.equal(gift.provider,'promotion');assert.equal(await purchaseAccess(a,'noel-3'),true);assert.equal(await purchaseAccess(b,'noel-3'),false);
   assert.equal((await paymentDetails(a,gift.id)).order.id,gift.id);
   const files=(await shop(a)).products.find(p=>p.id==='noel-3');assert.ok(files.downloadUrl);assert.deepEqual(files.printProfiles.map(p=>p.id),['original','fine','fast']);assert.ok(files.printProfiles.every(p=>p.downloadUrl));
   const license=await downloadablePurchaseLicense(a,gift.licenses[0].code);assert.equal(license.productId,'noel-3');
   const cookie=`tiolira_club=${await makeSession(a.version,{memberId:a.id})}`;let response;
   await handler({method:'GET',url:gift.licenses[0].downloadUrl,headers:{host:'localhost',cookie},socket:{remoteAddress:'natal-test'}},{setHeader(){},set statusCode(v){this.status=v},end(v){response={status:this.status||200,body:v}}});
   assert.equal(response.status,200);assert.equal(response.body.subarray(0,5).toString(),'%PDF-');assert.equal(network,0);
   await assert.rejects(()=>checkout(a,input(['noel-4'],0)));assert.equal(campaign((await shop(a)).natalCampaign).used,true);
  });
  await t.test('international customer redeems free without entering PayPal',async()=>{
   const g=await checkout(us,{...input(['noel-4'],0),lang:'en'});assert.equal(g.currency,'USD');assert.equal(g.totalCents,0);assert.equal(g.licenses.length,1);assert.equal(network,0);
  });
  await t.test('forged free totals, self-reported purchase history and expired benefits rejected',async()=>{
   await assert.rejects(()=>checkout(b,{...input(['noel-4'],0),previousCount:3,natalCampaign:{previousCount:3,active:true}}));
   t.mock.timers.setTime(Date.parse(NATAL_END));await assert.rejects(()=>checkout(b,input(['noel-4'],0)));assert.equal(await purchaseAccess(a,'noel-3'),true);t.mock.timers.setTime(now);
  });
  await t.test('refund of a qualifying original purchase revokes gift access and license',async()=>{
   const s=(await readRecord('commerce.json')).data;s.orders.find(o=>o.memberId===a.id&&o.id===s.orders.find(o=>o.id===gift.id).natalPromotion.qualifyingPurchases[0].orderId).status='refunded';await save(s.orders);
   assert.equal(await purchaseAccess(a,'noel-3'),false);assert.equal((await purchaseLicenses(a)).find(l=>l.productId==='noel-3').status,'suspended');await assert.rejects(()=>downloadablePurchaseLicense(a,gift.licenses[0].code));
   assert.equal((await shop(a)).orders.find(o=>o.id===gift.id).licenses.length,0);
  });
  await t.test('two different simultaneous gift claims cannot both succeed',async()=>{
   await save(previous(b.id,3));const results=await Promise.allSettled([checkout(b,input(['noel-3'],0)),checkout(b,input(['noel-4'],0))]);assert.equal(results.filter(x=>x.status==='fulfilled').length,1);assert.equal((await readRecord('commerce.json')).data.orders.filter(o=>o.provider==='promotion').length,1);
  });
  await t.test('Asaas receives discounted amount once; reserved promotion prevents a second order',async()=>{
   await save([]);let payments=0;const remote=new Map();
   globalThis.fetch=async(url,opts={})=>{network++;const u=new URL(url),body=opts.body?JSON.parse(opts.body):{};let result;
    assert.equal(u.origin,'https://api-sandbox.asaas.com');
    if(u.pathname==='/v3/customers')result=opts.method==='POST'?{id:'cus_natal',...body}:{data:[]};
    else if(u.pathname==='/v3/payments'&&opts.method==='POST'){payments++;assert.equal(body.value,29.85);result={...body,id:'pay_natal',status:'PENDING'};remote.set(result.id,result);}
    else if(u.pathname==='/v3/payments')result={data:[...remote.values()].filter(p=>p.externalReference===u.searchParams.get('externalReference'))};
    else result=remote.get(u.pathname.split('/').at(-1));
    assert.ok(result,u.pathname);return {ok:true,status:200,json:async()=>result};
   };
   const member={...b,cpfCnpj:'52998224725'},request=input(['noel-0','noel-1'],2985);
   const results=await Promise.all([checkout(member,request),checkout(member,request)]);assert.equal(results[0].id,results[1].id);assert.equal(payments,1);
   const retry=await checkout(member,{...request,requestId:randomUUID()});assert.equal(retry.id,results[0].id);assert.equal(payments,1);
   await assert.rejects(()=>checkout(member,input(['noel-2','noel-3','noel-4'],3980)),/reservada/);assert.equal(payments,1);
  });
  await t.test('PayPal receives correct USD discount and validates expected total',async()=>{
   await save([]);let payments=0;globalThis.fetch=async(url,opts={})=>{const u=new URL(url);
    assert.equal(u.origin,'https://api-m.sandbox.paypal.com');
    if(u.pathname==='/v1/oauth2/token')return {ok:true,status:200,json:async()=>({access_token:'token',expires_in:300})};
    const body=JSON.parse(opts.body);assert.equal(u.pathname,'/v2/checkout/orders');assert.equal(body.purchase_units[0].amount.currency_code,'USD');
    const prices=marketCatalog(data,'USD');const expected=discountQuote({...quoteCart(prices,selections(['noel-0','noel-1','noel-2'])),currency:'USD'},'',[],now,natalState([],data.products,us.id,now,N)).totalCents;
    assert.equal(body.purchase_units[0].amount.value,(expected/100).toFixed(2));payments++;
    return {ok:true,status:201,json:async()=>({...body,id:'PAYPALNATAL00001',status:'CREATED',links:[{rel:'approve',href:'https://www.sandbox.paypal.com/checkoutnow?token=PAYPALNATAL00001'}]})};
   };
   const req=input(['noel-0','noel-1','noel-2'],(await quoteCheckout(us,{items:selections(['noel-0','noel-1','noel-2'])})).totalCents);
   await assert.rejects(()=>checkout(us,{...req,expectedTotalCents:req.expectedTotalCents-1}));assert.equal(payments,0);
   const order=await checkout(us,req);assert.equal(order.totalCents,req.expectedTotalCents);assert.equal(order.natalPromotion.percent,100);assert.equal(payments,1);
  });
 }finally{globalThis.fetch=oldFetch;t.mock.timers.reset();for(const k of keys){if(env[k]===undefined)delete process.env[k];else process.env[k]=env[k];}await rm(dir,{recursive:true,force:true});}
});

}
