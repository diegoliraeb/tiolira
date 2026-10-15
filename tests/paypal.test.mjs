import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {internationalBuyer,usdPriceCents,paypalApprovalUrl,marketCatalog} from '../lib/international-pricing.mjs';
import {returnedPaymentId} from '../lib/payment-return.mjs';
import {checkout,shop,quoteCheckout,purchaseAccess,purchaseLicenses,salesReport,applyPayment} from '../server/commerce.mjs';
import {refreshPaypal,applyPaypalOrder,receivePaypalWebhook} from '../server/paypal-commerce.mjs';
import {readRecord,writeRecord} from '../server/store.mjs';
import seed from '../data/catalog.json' with {type:'json'};

test('international country, fixed USD prices, URL allowlist and payment return',()=>{
 assert.equal(internationalBuyer({countryCode:'BR',country:'USA'}),false);
 assert.equal(internationalBuyer({countryCode:'US'}),true);assert.equal(internationalBuyer({country:'Portugal'}),true);assert.equal(internationalBuyer({country:'Brasil'}),false);assert.equal(internationalBuyer({}),false);
 assert.deepEqual([1290,1690,6990].map(priceCents=>usdPriceCents({priceCents})),[215,282,1165]);assert.equal(usdPriceCents({priceCents:1690,priceUsdCents:399}),399);assert.equal(usdPriceCents({priceCents:0}),0);
 for(const url of ['https://paypal.com.evil.test/checkoutnow?token=x','http://www.paypal.com/checkoutnow?token=x','https://user:pass@www.paypal.com/checkoutnow?token=x','https://www.paypal.com/mep/dashboard?token=x'])assert.equal(paypalApprovalUrl(url),'');
 assert.equal(paypalApprovalUrl('https://www.sandbox.paypal.com/checkoutnow?token=x','production'),'');
 const id=randomUUID();assert.equal(returnedPaymentId('?retorno=paypal&pedido='+id),id);
});

test('PayPal verified capture, idempotency, environment isolation and revocation',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'tiolira-paypal-'));
 const keys=['DATABASE_URL','POSTGRES_URL','VERCEL','BLOB_READ_WRITE_TOKEN','LOCAL_DATA_DIR','ASAAS_ENVIRONMENT','PAYPAL_ENVIRONMENT','PAYPAL_CLIENT_ID','PAYPAL_CLIENT_SECRET','PAYPAL_MERCHANT_ID','PAYPAL_WEBHOOK_ID','SITE_URL','RESEND_API_KEY'];
 const env=Object.fromEntries(keys.map(k=>[k,process.env[k]])),originalFetch=globalThis.fetch;
 for(const k of keys)delete process.env[k];
 Object.assign(process.env,{LOCAL_DATA_DIR:dir,ASAAS_ENVIRONMENT:'sandbox',PAYPAL_ENVIRONMENT:'sandbox',PAYPAL_CLIENT_ID:'test-id',PAYPAL_CLIENT_SECRET:'test-secret',PAYPAL_MERCHANT_ID:'TESTMERCHANT',PAYPAL_WEBHOOK_ID:'test-webhook',SITE_URL:'https://www.tiolira.com.br'});
 const a={id:randomUUID(),name:'International',email:'test@example.invalid',countryCode:'US'},b={...a,id:randomUUID()};
 const data=structuredClone(seed);data.collections.push({id:'international-test',name:'Collection',published:true,free:false,priceCents:6990});data.products.push(...['saci-test','cuca-test','boitata-test'].map(id=>({id,name:id,slug:id,collection:'international-test',access:'paid',priceCents:1690,published:true,filePath:'models/'+id+'.zip'})));
 const remote=new Map(),ids=new Map();let createCalls=0,captureCalls=0,timeout=false,signature='SUCCESS',lastVerify;
 globalThis.fetch=async(url,options={})=>{
  const u=new URL(url);assert.equal(u.origin,'https://api-m.sandbox.paypal.com');
  if(u.pathname==='/v1/oauth2/token')return {ok:true,json:async()=>({access_token:'test-access'})};
  assert.equal(options.headers.Authorization,'Bearer test-access');let value;const payload=options.body?JSON.parse(options.body):{};
  if(u.pathname==='/v2/checkout/orders'&&options.method==='POST'){
   const key=options.headers['PayPal-Request-Id'];assert.ok(key);
   if(ids.has(key))value=remote.get(ids.get(key));else{createCalls++;const id='TESTORDER000'+createCalls;value={...payload,id,status:'PAYER_ACTION_REQUIRED',links:[{rel:'payer-action',href:'https://www.sandbox.paypal.com/checkoutnow?token='+id}]};ids.set(key,id);remote.set(id,value);}
   if(timeout){timeout=false;throw Error('lost response');}
  }else if(u.pathname.endsWith('/capture')){
   captureCalls++;value=remote.get(u.pathname.split('/').at(-2));assert.equal(options.headers['PayPal-Request-Id'],'capture-'+value.purchase_units[0].custom_id);value.status='COMPLETED';value.purchase_units[0].payments={captures:[{id:'CAPTURE'+value.id,status:'COMPLETED',amount:structuredClone(value.purchase_units[0].amount)}]};
  }else if(u.pathname.startsWith('/v2/payments/captures/'))value=[...remote.values()].flatMap(o=>o.purchase_units[0].payments?.captures||[]).find(c=>c.id===u.pathname.split('/').pop());
  else if(u.pathname==='/v1/notifications/verify-webhook-signature'){lastVerify=options.body;value={verification_status:signature};}
  else value=remote.get(u.pathname.split('/').pop());
  assert.ok(value);return {ok:true,json:async()=>structuredClone(value)};
 };
 const input=(id='saci-test')=>({items:[{kind:'product',id}],requestId:randomUUID(),billingType:'PAYPAL',expectedTotalCents:282});
 const headers={'paypal-auth-algo':'SHA256withRSA','paypal-cert-url':'https://api-m.sandbox.paypal.com/cert','paypal-transmission-id':'tx','paypal-transmission-sig':'sig','paypal-transmission-time':'2026-10-15T00:00:00Z'};
 try{
  await writeRecord('catalog.json',data,null);
  await t.test('international store uses USD and no CPF; server rejects tampered total',async()=>{
   const offers=await shop(a);assert.equal(offers.currency,'USD');assert.equal(offers.paymentProvider,'paypal');assert.equal(offers.products.find(p=>p.id==='saci-test').priceCents,282);assert.equal(offers.collections.find(c=>c.id==='international-test').priceCents,1165);
   assert.equal((await quoteCheckout(a,input())).totalCents,282);
   await assert.rejects(()=>checkout(a,{...input(),expectedTotalCents:1}),/preço mudou/);assert.equal(createCalls,0);
  });
  let order;
  await t.test('repeated create recovers one remote order and grants no files before capture',async()=>{
   timeout=true;const i=input();await assert.rejects(()=>checkout(a,i),/Resposta/);order=await checkout(a,i);assert.equal(createCalls,1);assert.equal(order.currency,'USD');assert.equal(order.status,'pending');assert.equal(order.provider,'paypal');assert.equal(await purchaseAccess(a,'saci-test'),false);assert.equal((await purchaseLicenses(a)).length,0);assert.equal(captureCalls,0);
   assert.equal((await checkout(a,input())).id,order.id);assert.equal(createCalls,1);
   const r=remote.values().next().value;assert.equal(r.payment_source.paypal.experience_context.shipping_preference,'NO_SHIPPING');assert.match(r.payment_source.paypal.experience_context.return_url,/retorno=paypal/);
   assert.equal(JSON.stringify(await shop(a)).includes('test-secret'),false);
  });
  await t.test('wrong member, reference, currency, amount and payee cannot grant access',async()=>{
   const r=remote.values().next().value;
   await assert.rejects(()=>refreshPaypal(b,order.id),/não encontrado/);
   for(const edit of [u=>u.custom_id=randomUUID(),u=>u.amount.currency_code='BRL',u=>u.amount.value='0.01',u=>u.payee.merchant_id='OTHER']){const copy=structuredClone(r);edit(copy.purchase_units[0]);await assert.rejects(()=>applyPaypalOrder(order.id,copy),/corresponde/);}
   await assert.rejects(()=>applyPayment(order.id,{id:'pay_forged',externalReference:order.id}),/corresponde/);
  });
  await t.test('approved capture grants files and licenses exactly once',async()=>{
   const r=remote.values().next().value;r.status='APPROVED';const paid=await refreshPaypal(a,order.id);assert.equal(paid.status,'paid');assert.equal(captureCalls,1);assert.equal(await purchaseAccess(a,'saci-test'),true);const licenses=await purchaseLicenses(a);assert.equal(licenses.length,1);
   await refreshPaypal(a,order.id);assert.equal(captureCalls,1);assert.equal((await purchaseLicenses(a))[0].code,licenses[0].code);
   const report=await salesReport();assert.equal(report.totalCents,0);assert.equal(report.totalUsdCents,282);assert.equal(report.products.find(p=>p.id==='saci-test').revenueUsdCents,282);
   process.env.PAYPAL_ENVIRONMENT='production';assert.equal(await purchaseAccess(a,'saci-test'),false);process.env.PAYPAL_ENVIRONMENT='sandbox';
   process.env.ASAAS_ENVIRONMENT='production';assert.equal(await purchaseAccess(a,'saci-test'),true);process.env.ASAAS_ENVIRONMENT='sandbox';
  });
  await t.test('signed refund revokes access and delayed completed events cannot restore it',async()=>{
   const r=remote.values().next().value,capture=r.purchase_units[0].payments.captures[0];
   const event={id:'event-refund',event_type:'PAYMENT.CAPTURE.REFUNDED',resource:{id:'REFUND1',links:[{rel:'up',href:'https://api-m.sandbox.paypal.com/v2/payments/captures/'+capture.id}]}};
   const raw=JSON.stringify(event,null,2);signature='FAILURE';await assert.rejects(()=>receivePaypalWebhook(headers,raw),/não autorizado/);assert.equal(await purchaseAccess(a,'saci-test'),true);
   signature='SUCCESS';await receivePaypalWebhook(headers,raw);assert.ok(lastVerify.includes(raw));assert.equal(await purchaseAccess(a,'saci-test'),false);
   await applyPaypalOrder(order.id,r,'delayed');assert.equal(await purchaseAccess(a,'saci-test'),false);assert.equal((await purchaseLicenses(a))[0].status,'suspended');
  });
  await t.test('pending captures do not grant files and stale creates are not retried',async()=>{
   const next=await checkout(a,input('cuca-test')),r=remote.get(ids.get(next.id));r.status='COMPLETED';r.purchase_units[0].payments={captures:[{id:'CAPTUREPENDING',status:'PENDING',amount:r.purchase_units[0].amount}]};await refreshPaypal(a,next.id);assert.equal(await purchaseAccess(a,'cuca-test'),false);
   timeout=true;await assert.rejects(()=>checkout(a,input('boitata-test')));let record=await readRecord('commerce.json');const stale=record.data.orders.at(-1);stale.createdAt='2020-01-01T00:00:00Z';await writeRecord('commerce.json',record.data,record.etag);const count=createCalls;await assert.rejects(()=>refreshPaypal(a,stale.id),/Contate o suporte/);assert.equal(createCalls,count);
  });
 }finally{globalThis.fetch=originalFetch;for(const [k,v] of Object.entries(env))v===undefined?delete process.env[k]:process.env[k]=v;await rm(dir,{recursive:true,force:true});}
});
