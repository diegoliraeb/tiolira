import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {applySubscriberDiscount} from '../lib/subscriber-discount.mjs';
import {discountQuote} from '../server/cart-coupons.mjs';
import {checkoutFingerprint} from '../server/checkout-fingerprint.mjs';
import {cartSelection} from '../lib/cart-lines.mjs';
import {quoteCheckout,shop,checkout} from '../server/commerce.mjs';
import {writeRecord,readRecord} from '../server/store.mjs';
import {subscriptionPageCopy} from '../lib/subscription-page.mjs';
import {subscriptionPresentation} from '../lib/subscription-presentation.mjs';
import {makerTerms,commercialPolicy} from '../lib/maker-license.mjs';
const quote=()=>({items:[{kind:'product',id:'a',priceCents:1990},{kind:'collection',id:'b',priceCents:1001}]});
test('10% applies once after other discounts, exact line totals, free and subscription excluded',()=>{
 const base=discountQuote(quote(),'',[]),active=applySubscriberDiscount(base,true);
 assert.equal(active.totalCents,2692);assert.equal(active.discountCents,299);assert.equal(active.items.reduce((n,i)=>n+i.totalCents,0),active.totalCents);assert.equal(active.items.reduce((n,i)=>n+i.discountCents,0),active.discountCents);
 assert.strictEqual(applySubscriberDiscount(base,false),base);assert.strictEqual(applySubscriberDiscount(base,'true'),base);assert.strictEqual(applySubscriberDiscount(active,true),active);
 const coupon={id:'c',code:'TEN',type:'percent',value:10,minimumCents:0,active:true};
 const stacked=discountQuote(quote(),'TEN',[coupon],Date.now(),undefined,undefined,true);assert.equal(stacked.couponDiscountCents,299);assert.equal(stacked.subscriberDiscount.discountCents,269);assert.equal(stacked.totalCents,2423);
 assert.equal(applySubscriberDiscount({...base,totalCents:0},true).totalCents,0);
 assert.equal(applySubscriberDiscount({...base,courtesy:true},true).subscriberDiscount,undefined);
 assert.equal(applySubscriberDiscount({items:[{kind:'subscription',priceCents:4990}],totalCents:4990},true).totalCents,4990);
 assert.notEqual(checkoutFingerprint(base),checkoutFingerprint(active));assert.notEqual(checkoutFingerprint(active),checkoutFingerprint(active,'paypal'));
});
test('public presentation omits tribute name but commercial restrictions remain enforced',()=>{
 for(const [lang,c] of Object.entries(subscriptionPageCopy)){assert.ok(!JSON.stringify(c).includes('Senna'));assert.match(JSON.stringify(c),/10/);assert.ok(!subscriptionPresentation(makerTerms[lang],lang).includes('Senna'));}
 assert.equal(commercialPolicy({id:'96f7f843-b608-4a57-8f27-6ba12e2862da'}),'noncommercial');
});
test('server verifies active periods, BRL/USD carts match, Asaas and PayPal receive discounted amounts',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'subscriber-discount-')),old={...process.env},fetch0=globalThis.fetch;
 for(const k of ['DATABASE_URL','POSTGRES_URL','VERCEL','BLOB_READ_WRITE_TOKEN','RESEND_API_KEY'])delete process.env[k];
 Object.assign(process.env,{LOCAL_DATA_DIR:dir,ASAAS_ENVIRONMENT:'sandbox',ASAAS_API_KEY:'test-only',ASAAS_WEBHOOK_TOKEN:'test-webhook-secret-at-least-32-characters',SITE_URL:'https://www.tiolira.com.br',PAYPAL_MERCHANT_ID:'merchant-test',PAYPAL_WEBHOOK_ID:'webhook-test',PAYPAL_ENVIRONMENT:'sandbox',PAYPAL_CLIENT_ID:'test-only',PAYPAL_CLIENT_SECRET:'test-only',ADMIN_SESSION_SECRET:'test-session-secret-at-least-32-characters'});
 const br={id:randomUUID(),name:'Local test',email:'test@example.invalid',cpfCnpj:'52998224725',countryCode:'BR'},us={...br,id:randomUUID(),countryCode:'IE'},expired={...br,id:randomUUID()},outsider={...br,id:randomUUID()};
 const data={collections:[{id:'collection',name:'Test',published:true,free:false,priceCents:3000,priceUsdCents:1000}],products:[{id:'a',slug:'a',name:'Test A',collection:'collection',published:true,access:'paid',priceCents:1990,priceUsdCents:499,image:'/assets/test.png',filePath:'models/test.3mf'}]};
 const selections=[{kind:'product',id:'a'}],period={startsAt:new Date(Date.now()-86400000).toISOString(),endsAt:new Date(Date.now()+86400000).toISOString()};let asaasCalls=0,paypalCalls=0;
 try{
 await writeRecord('catalog.json',data,null);
 await writeRecord('maker-subscriptions.json',{subscriptions:[br,us,expired].map(m=>({id:randomUUID(),memberId:m.id,environment:'sandbox',provider:'asaas',status:'active',periods:[m===expired?{...period,endsAt:new Date(Date.now()-1000).toISOString()}:period]}))},null);
 globalThis.fetch=async()=>{throw Error('No network allowed while quoting');};
 for(const [member,total] of [[br,1791],[us,449],[expired,1990],[outsider,1990]]){
  const back=await quoteCheckout(member,{items:selections,subscriberDiscountActive:true}),store=await shop(member),front=cartSelection(store,selections);assert.equal(back.totalCents,total);assert.equal(front.total,total);assert.equal(Boolean(back.subscriberDiscount),member===br||member===us);
 }
 const bundle=await quoteCheckout(br,{items:[{kind:'collection',id:'collection'}]});assert.equal(bundle.totalCents,2700);
 await assert.rejects(checkout(expired,{items:selections,requestId:randomUUID(),billingType:'PIX',expectedTotalCents:1791,subscriberDiscountActive:true}),/desconto mudou/);
 globalThis.fetch=async(url,opts={})=>{const u=new URL(url),body=opts.body&&u.pathname!=='/v1/oauth2/token'?JSON.parse(opts.body):{};let result;
 if(u.pathname==='/v3/customers')result=opts.method==='POST'?{id:'cus_test',...body}:{data:[]};
 else if(u.pathname==='/v3/payments'&&opts.method==='POST'){asaasCalls++;assert.equal(body.value,17.91);result={...body,id:'pay_test',status:'PENDING'};}
 else if(u.pathname==='/v1/oauth2/token')result={access_token:'test-token',expires_in:300};
 else if(u.pathname==='/v2/checkout/orders'){paypalCalls++;assert.equal(body.purchase_units[0].amount.value,'4.49');assert.equal(body.purchase_units[0].amount.currency_code,'USD');result={...body,id:'PAYPALTEST00001',status:'CREATED',links:[{rel:'approve',href:'https://www.sandbox.paypal.com/checkoutnow?token=PAYPALTEST00001'}]};}
 else throw Error('Unexpected URL '+u.pathname);
 return {ok:true,status:200,json:async()=>result};};
 const req={items:selections,requestId:randomUUID(),billingType:'PIX',expectedTotalCents:1791};
 const order=await checkout(br,req);assert.equal(order.totalCents,1791);assert.equal(order.subscriberDiscount.discountCents,199);assert.equal((await checkout(br,req)).id,order.id);assert.equal(asaasCalls,1);
 const international=await checkout(us,{...req,requestId:randomUUID(),billingType:'PAYPAL',expectedTotalCents:449});assert.equal(international.totalCents,449);assert.equal(paypalCalls,1);
 const saved=(await readRecord('commerce.json')).data.orders;assert.equal(saved.find(o=>o.id===order.id).items[0].subscriberDiscountCents,199);
 }finally{globalThis.fetch=fetch0;for(const k of Object.keys(process.env))if(!(k in old))delete process.env[k];Object.assign(process.env,old);await rm(dir,{recursive:true,force:true});}
});
