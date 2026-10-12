import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {checkout,quoteCart,shop,paymentDetails,paymentContext,purchaseLicenses,purchaseAccess,receiveWebhook,applyPayment,refreshOrder,recordDownload,salesReport} from '../server/commerce.mjs';
import {readRecord,writeRecord} from '../server/store.mjs';
import {invoiceUrl} from '../server/asaas.mjs';
import {makeSession} from '../server/auth.mjs';
import handler from '../server/handler.mjs';
import seed from '../data/catalog.json' with {type:'json'};

test('cart, Asaas reconciliation, protected downloads and sales',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'tiolira-sales-'));
 const keys=['DATABASE_URL','POSTGRES_URL','VERCEL','BLOB_READ_WRITE_TOKEN','LOCAL_DATA_DIR','ASAAS_ENVIRONMENT','ASAAS_API_KEY','ASAAS_WEBHOOK_TOKEN','ADMIN_SESSION_SECRET'];
 const env=Object.fromEntries(keys.map(k=>[k,process.env[k]])),originalFetch=globalThis.fetch;
 for(const k of keys)delete process.env[k];
 Object.assign(process.env,{LOCAL_DATA_DIR:dir,ASAAS_ENVIRONMENT:'sandbox',ASAAS_API_KEY:'test-only',ASAAS_WEBHOOK_TOKEN:'test-webhook-secret-with-at-least-32-chars',ADMIN_SESSION_SECRET:'test-session-secret-at-least-32-characters'});
 const a={id:randomUUID(),version:randomUUID(),name:'A',email:'a@example.invalid'},b={id:randomUUID(),version:randomUUID(),name:'B',email:'b@example.invalid'};
 const data=structuredClone(seed);data.collections.push({id:'folclore-test',name:'Folclore Brasileiro Parte 1',published:true,free:false,comingSoon:false,priceCents:4990});
 const products=['saci','curupira','boitata','cuca','mula'].map(id=>({id,name:id,slug:id,collection:'folclore-test',published:true,access:'paid',priceCents:1490,filePath:`models/${id}.zip`}));data.products.push(...products);
 let posts=0,timeout=false;const remote=new Map(),customers=new Map();
 globalThis.fetch=async(url,options={})=>{
  const u=new URL(url),payload=options.body?JSON.parse(options.body):{};
  assert.equal(u.origin,'https://api-sandbox.asaas.com');assert.equal(options.headers.access_token,'test-only');
  let result;
  if(u.pathname==='/v3/customers'&&options.method==='GET')result={data:[...customers.values()].filter(c=>c.externalReference===u.searchParams.get('externalReference'))};
  else if(u.pathname==='/v3/customers'){result={...payload,id:`cus_${customers.size+1}`};customers.set(result.id,result);assert.equal(payload.notificationDisabled,true);}
  else if(u.pathname==='/v3/payments'&&options.method==='POST'){posts++;result={...payload,id:`pay_${posts}`,invoiceUrl:`https://sandbox.asaas.com/i/${posts}`,status:'PENDING'};remote.set(result.id,result);if(timeout){timeout=false;throw Error('timeout after remote commit');}}
  else if(u.pathname==='/v3/payments')result={data:[...remote.values()].filter(p=>p.externalReference===u.searchParams.get('externalReference'))};
  else if(u.pathname.endsWith('/pixQrCode'))result={encodedImage:'aGVsbG8=',payload:'000201-test-pix',expirationDate:'2030-01-01 23:59:59'};
  else if(u.pathname.endsWith('/identificationField'))result={identificationField:'00190.00009 01234.567890 12345.678901 1 99990000001490'};
  else result=remote.get(u.pathname.split('/').pop());
  assert.ok(result);return {ok:true,status:200,json:async()=>structuredClone(result)};
 };
 const cookie=`tiolira_club=${await makeSession(a.version,{memberId:a.id})}`;
 const call=async(route,{method='GET',body={},headers={}}={})=>{let result;await handler({method,url:'/api/'+route,body,headers:{host:'localhost',origin:'http://localhost',cookie,...headers},socket:{remoteAddress:'test'}},{setHeader(){},set statusCode(s){this.status=s},end(v){result={status:this.status,body:JSON.parse(v)}}});return result;};
 const input=(items=[{kind:'product',id:'saci'}])=>({items,requestId:randomUUID(),billingType:'PIX',cpfCnpj:'12345678901',totalCents:1});
 try{
  await writeRecord('catalog.json',data,null);await writeRecord('club-members.json',{members:[a,b]},null);
  await t.test('server prices and no duplicate bundle billing',()=>{
   const q=quoteCart(data,[{kind:'product',id:'saci'},{kind:'product',id:'saci'},{kind:'collection',id:'folclore-test'}]);assert.equal(q.totalCents,4990);assert.equal(q.items.length,1);assert.equal(q.productIds.length,5);
   assert.throws(()=>quoteCart(data,[{kind:'product',id:'missing'}]));
   const incomplete=structuredClone(data);incomplete.products.find(p=>p.id==='mula').filePath='';assert.throws(()=>quoteCart(incomplete,[{kind:'collection',id:'folclore-test'}]));
   assert.equal(invoiceUrl('https://asaas.com.evil.invalid/i/x'),'');assert.equal(invoiceUrl('javascript:alert(1)'),'');
  });
  let first;
  await t.test('forged totals ignored, parallel checkout does not duplicate charges',async()=>{
   const payload=input();const results=await Promise.all([checkout(a,payload),checkout(a,payload)]);assert.equal(posts,1);assert.equal(results[0].id,results[1].id);first=await checkout(a,payload);assert.equal(first.totalCents,1490);assert.equal(first.status,'pending');
   const other=await checkout(a,input());assert.equal(other.id,first.id);assert.equal(posts,1);
   assert.equal(await purchaseAccess(a,'saci'),false);assert.equal((await call('download?id=saci')).status,403);
   assert.equal((await call('admin/sales')).status,401);assert.equal((await call('admin/asaas-status')).status,401);assert.equal((await shop(b)).orders.length,0);
   assert.equal((await paymentDetails(a,first.id)).pix.payload,'000201-test-pix');await assert.rejects(()=>paymentDetails(b,first.id),/não encontrado/);assert.equal((await purchaseLicenses(a)).length,0);
  });
  await t.test('authenticated webhook, verified amount, duplicate delivery and paid access',async()=>{
   const remotePayment=remote.get('pay_1');remotePayment.status='CONFIRMED';
   const event={id:'evt-paid',event:'PAYMENT_CONFIRMED',payment:{id:'pay_1',externalReference:first.id}};
   assert.equal((await call('webhooks/asaas',{method:'POST',body:event,headers:{origin:'https://asaas.com','asaas-access-token':'bad'}})).status,401);
   assert.equal((await call('webhooks/asaas',{method:'POST',body:event,headers:{origin:'https://asaas.com','asaas-access-token':process.env.ASAAS_WEBHOOK_TOKEN}})).status,200);
   const licenseBefore=(await purchaseLicenses(a))[0];assert.equal(licenseBefore.status,'active');
   await receiveWebhook(event);assert.equal((await purchaseLicenses(a))[0].code,licenseBefore.code);assert.equal(await purchaseAccess(a,'saci'),true);assert.equal(await purchaseAccess(b,'saci'),false);
   assert.equal((await readRecord('commerce.json')).data.orders[0].events.length,1);
   await assert.rejects(()=>applyPayment(first.id,{...remotePayment,value:1}),/Valor/);
   await assert.rejects(()=>applyPayment(first.id,{...remotePayment,customer:'cus_other'}),/corresponde/);
   await assert.rejects(()=>refreshOrder(b,first.id),/não encontrado/);
   assert.ok(!(JSON.stringify(await shop(a)).includes('customerId')));
  });
  await t.test('bundle overlap requires acknowledgement; bundle records all five pieces and integer revenue',async()=>{
   const body=input([{kind:'collection',id:'folclore-test'},{kind:'product',id:'saci'}]);await assert.rejects(()=>checkout(a,body),/sem abatimento/);
   const order=await checkout(a,{...body,acceptOverlap:true});assert.equal(order.totalCents,4990);remote.get('pay_2').status='RECEIVED';await refreshOrder(a,order.id);
   for(const p of products)assert.equal(await purchaseAccess(a,p.id),true);
   assert.equal((await purchaseLicenses(a)).filter(l=>l.orderId===order.id&&l.status==='active').length,5);
   const generated=await call('club/licenses',{method:'POST',body:{productId:'cuca'}});assert.equal(generated.status,200);assert.equal(generated.body.license.source,'purchase');
   await recordDownload(a,products[0]);const report=await salesReport();assert.equal(report.totalCents,6480);assert.equal(report.products.reduce((n,p)=>n+p.revenueCents,0),6480);const saci=report.products.find(p=>p.id==='saci');assert.equal(saci.individualSales,1);assert.equal(saci.collectionSales,1);assert.equal(saci.downloads,1);
  });
  await t.test('timeout is reconciled rather than creating another payment',async()=>{
   const body=input([{kind:'product',id:'cuca'}]);timeout=true;await assert.rejects(()=>checkout(b,body));assert.equal(posts,3);
   const pending=await checkout(b,body);assert.equal(pending.status,'creating');assert.equal(posts,3);await refreshOrder(b,pending.id);assert.equal(posts,3);assert.equal((await shop(b)).orders[0].status,'pending');
  });
  await t.test('refund revokes bundle; delayed events cannot restore it; sandbox cannot unlock production',async()=>{
   const p=remote.get('pay_2');p.refunds=[{status:'DONE',value:10}];p.value=39.90;await receiveWebhook({id:'evt-refund',event:'PAYMENT_PARTIALLY_REFUNDED',payment:{id:p.id}});assert.equal(await purchaseAccess(a,'cuca'),false);assert.equal(await purchaseAccess(a,'saci'),true);assert.equal((await purchaseLicenses(a)).filter(l=>l.status==='suspended').length,5);
   p.status='CONFIRMED';p.value=49.90;p.refunds=[];await receiveWebhook({id:'evt-delayed-paid',event:'PAYMENT_CONFIRMED',payment:{id:p.id}});assert.equal(await purchaseAccess(a,'cuca'),false);
   process.env.ASAAS_ENVIRONMENT='production';assert.equal(await purchaseAccess(a,'saci'),false);process.env.ASAAS_ENVIRONMENT='sandbox';
  });

  await t.test('inline boleto and card processing keep sensitive details out of storage',async()=>{
   const boleto=await checkout(b,{...input([{kind:'product',id:'curupira'}]),billingType:'BOLETO'});
   assert.ok((await paymentDetails(b,boleto.id)).boleto.identificationField.startsWith('00190'));
   const c={id:randomUUID(),version:randomUUID(),name:'C',email:'c@example.invalid'};
   const body={...input(),billingType:'CREDIT_CARD',creditCard:{holderName:'Test Holder',number:'4444444444444444',expiryMonth:'12',expiryYear:'2099',ccv:'123'},creditCardHolderInfo:{name:'Test Holder',email:'holder@example.invalid',cpfCnpj:'12345678901',postalCode:'57000000',addressNumber:'123',phone:'82999999999'}};
   await assert.rejects(()=>checkout(c,body),/conexão/);
   const order=await checkout(c,body,{remoteIp:'203.0.113.5',secure:true});
   const p=[...remote.values()].find(p=>p.externalReference===order.id);assert.equal(p.creditCard.number,body.creditCard.number);assert.equal(p.remoteIp,'203.0.113.5');
   const saved=JSON.stringify((await readRecord('commerce.json')).data);for(const secret of ['4444444444444444','creditCard','holder@example.invalid','82999999999'])assert.equal(saved.includes(secret),false);
   assert.equal((await purchaseLicenses(c)).length,0);p.status='CONFIRMED';await refreshOrder(c,order.id);assert.equal((await purchaseLicenses(c)).length,1);
   assert.equal(paymentContext({headers:{'x-forwarded-for':'1.2.3.4'},socket:{remoteAddress:'127.0.0.1'}}).remoteIp,'127.0.0.1');
   process.env.ASAAS_ENVIRONMENT='production';await assert.rejects(()=>checkout(c,body,{remoteIp:'203.0.113.5',secure:false}),/HTTPS/);process.env.ASAAS_ENVIRONMENT='sandbox';
  });
  await t.test('edited catalog prices apply to new purchases, preserving existing orders',async()=>{
   data.products.find(p=>p.id==='saci').priceCents=1990;data.collections.find(c=>c.id==='folclore-test').priceCents=5990;
   await writeRecord('catalog.json',data,(await readRecord('catalog.json')).etag);
   assert.equal(quoteCart(data,[{kind:'product',id:'saci'}]).totalCents,1990);assert.equal(quoteCart(data,[{kind:'collection',id:'folclore-test'}]).totalCents,5990);
   assert.equal((await shop(a)).orders.find(o=>o.id===first.id).totalCents,1490);
  });
 }finally{globalThis.fetch=originalFetch;for(const k of keys){if(env[k]===undefined)delete process.env[k];else process.env[k]=env[k];}await rm(dir,{recursive:true,force:true});}
});
