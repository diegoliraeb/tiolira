import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {checkoutFingerprint} from '../server/checkout-fingerprint.mjs';
import {createHash,randomUUID} from 'node:crypto';
import {FAMILY_COLLECTION_ID,applyFamilyDiscount} from '../lib/family-discount.mjs';
import {cartSelection,addCartOffer} from '../lib/cart-lines.mjs';
import {discountQuote} from '../server/cart-coupons.mjs';
import {quoteCart,quoteCheckout,checkout,shop,applyPayment,purchaseAccess,purchaseLicenses,salesReport} from '../server/commerce.mjs';
import {refreshPaypal} from '../server/paypal-commerce.mjs';
import {writeRecord,readRecord} from '../server/store.mjs';
import {marketCatalog} from '../lib/international-pricing.mjs';
import seed from '../data/catalog.json' with {type:'json'};
const products=Array.from({length:10},(_,i)=>({id:`family-${i}`,slug:`family-${i}`,name:`Statue ${i}`,collection:FAMILY_COLLECTION_ID,published:true,access:'paid',filePath:`models/family-${i}.zip`,priceCents:1290}));
const other={...products[0],id:'other',slug:'other',name:'Other',collection:'another',priceCents:1690};
const catalog={...seed,products:[...products,other],collections:[{id:FAMILY_COLLECTION_ID,name:'Renamed collection',published:true,free:false,priceCents:0},{id:'another',name:'Estátuas Sagrada Família',published:true,free:false,priceCents:1000}]};
const coupon={id:randomUUID(),code:'SAVE10',active:true,type:'percent',value:10,minimumCents:0};
const select=n=>products.slice(0,n).map(p=>({kind:'product',id:p.id}));
const quote=items=>discountQuote(quoteCart(catalog,items),'',[]);
const clientData=data=>({...data,collections:data.collections.filter(c=>c.priceCents).map(c=>({...c,productIds:data.products.filter(p=>p.collection===c.id).map(p=>p.id)}))});
const totals=[1290,2451,3483,4386,5160,5805,6321,6708,6966,7740];
test('all 1–10 tiers exactly match the published table, backend, client and quantity changes',()=>{
 for(let n=1;n<=10;n++){
  for(const items of [select(n),[{kind:'product',id:products[0].id,quantity:n}]]){
   const q=quote(items),ui=cartSelection(clientData(catalog),items);
   assert.equal(q.totalCents,totals[n-1]);assert.equal(ui.total,q.totalCents);assert.equal(q.promotion.quantity,n);assert.equal(q.promotion.percent,Math.min((n-1)*5,40));
   assert.equal(q.items.reduce((s,i)=>s+i.totalCents,0),q.totalCents);
   assert.deepEqual(applyFamilyDiscount(q),q,'promotion cannot be applied twice');
  }
 }
 const cart=select(4);assert.equal(quote(cart).totalCents,4386);cart.pop();assert.equal(quote(cart).totalCents,3483);assert.equal(quote(addCartOffer(cart,{...products[3],kind:'product'})).totalCents,4386);
 assert.equal(quote([{kind:'product',id:products[0].id,quantity:100}]).promotion.percent,40);
 const forged=[...select(3),{...select(3)[0],quantity:100,priceCents:1,totalCents:1,collection:FAMILY_COLLECTION_ID}];assert.equal(quote(forged).totalCents,3483);
 for(const quantity of [0,-1,1.5,101,'3',null])assert.throws(()=>quote([{kind:'product',id:products[0].id,quantity}]));
});
test('mixed cart, exact cent allocation, identifier scope, free/owned pieces and unchanged bundles',()=>{
 const items=[...select(3),{kind:'product',id:'other'}],q=quote(items);
 assert.equal(q.totalCents,5173);assert.equal(q.items.find(i=>i.id==='other').discountCents,0);assert.equal(q.promotion.subtotalCents,3870);
 assert.equal(quote([{kind:'product',id:'other'}]).totalCents,1690);
 assert.equal(quote([{kind:'collection',id:'another'}]).totalCents,1000);
 assert.equal(quote([...select(3),{kind:'collection',id:'another'},{kind:'product',id:'other'}]).totalCents,4483);
 assert.throws(()=>quote([{kind:'product',id:'other',quantity:2}]));assert.throws(()=>quote([{kind:'collection',id:'another',quantity:2}]));
 const d=structuredClone(catalog);d.products[0].priceCents=0;d.products[0].access='site';assert.throws(()=>quoteCart(d,select(2)));
 assert.throws(()=>quoteCart(catalog,select(2),new Set([products[0].id])));
 assert.equal(cartSelection(clientData(catalog),select(2)).lines.reduce((n,i)=>n+i.totalCents,0),2451);
 const usd=marketCatalog(catalog,'USD');assert.equal(discountQuote(quoteCart(usd,select(3)),'',[]).totalCents,cartSelection(clientData(usd),select(3)).total);
});
test('coupons only discount other lines while progressive savings are active',()=>{
 assert.throws(()=>discountQuote(quoteCart(catalog,select(3)),coupon.code,[coupon]),/não acumula/);
 const mixed=quoteCart(catalog,[...select(3),{kind:'product',id:'other'}]);
 const q=discountQuote(mixed,coupon.code,[coupon]);assert.equal(q.totalCents,5004);assert.equal(q.couponDiscountCents,169);assert.equal(q.discountCents,556);assert.equal(q.promotion.discountCents,387);assert.equal(q.items.reduce((n,i)=>n+i.totalCents,0),5004);
 assert.deepEqual(discountQuote(q,coupon.code,[coupon]),q);
 assert.throws(()=>discountQuote(mixed,coupon.code,[{...coupon,minimumCents:2000}]),/mínima/);
 assert.throws(()=>discountQuote(mixed,coupon.code,[{...coupon,type:'fixed',value:1690}]),/maior que zero/);
 assert.equal(discountQuote(quoteCart(catalog,[{kind:'product',id:'other'}]),coupon.code,[coupon]).totalCents,1521);
 assert.equal(discountQuote(quoteCart(catalog,select(1)),coupon.code,[coupon]).totalCents,1161);
});
test('Asaas and PayPal charge the authoritative discounted total and preserve all entitlements',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'family-promotion-'));
 const keys=['DATABASE_URL','POSTGRES_URL','VERCEL','BLOB_READ_WRITE_TOKEN','LOCAL_DATA_DIR','ASAAS_API_KEY','ASAAS_ENVIRONMENT','ASAAS_WEBHOOK_TOKEN','PAYPAL_ENVIRONMENT','PAYPAL_CLIENT_ID','PAYPAL_CLIENT_SECRET','PAYPAL_MERCHANT_ID','PAYPAL_WEBHOOK_ID','SITE_URL','RESEND_API_KEY'];
 const env=Object.fromEntries(keys.map(k=>[k,process.env[k]])),fetchBefore=globalThis.fetch;keys.forEach(k=>delete process.env[k]);
 Object.assign(process.env,{LOCAL_DATA_DIR:dir,ASAAS_API_KEY:'fake',ASAAS_ENVIRONMENT:'sandbox',ASAAS_WEBHOOK_TOKEN:'test-webhook-token-32-characters-long',PAYPAL_ENVIRONMENT:'sandbox',PAYPAL_CLIENT_ID:'fake',PAYPAL_CLIENT_SECRET:'fake',PAYPAL_MERCHANT_ID:'TESTMERCHANT',PAYPAL_WEBHOOK_ID:'fake',SITE_URL:'https://www.tiolira.com.br'});
 const remote=new Map();let calls=0;
 globalThis.fetch=async(url,options={})=>{
  const u=new URL(url);assert.ok(['https://api-sandbox.asaas.com','https://api-m.sandbox.paypal.com'].includes(u.origin));
  if(u.pathname==='/v1/oauth2/token')return {ok:true,json:async()=>({access_token:'fake'})};
  const body=options.body?JSON.parse(options.body):{};let value;
  if(u.pathname==='/v3/customers')value=options.method==='GET'?{data:[{id:'cus_test',externalReference:u.searchParams.get('externalReference'),cpfCnpj:'12345678901'}]}:{...body,id:'cus_test'};
  else if(u.pathname==='/v3/payments'&&options.method==='POST'){calls++;value={...body,id:`pay_${calls}`,status:'PENDING',invoiceUrl:'https://sandbox.asaas.com/i/test'};remote.set(value.id,value);}
  else if(u.pathname==='/v2/checkout/orders'&&options.method==='POST'){calls++;value={...body,id:`TESTORDER000${calls}`,status:'PAYER_ACTION_REQUIRED',links:[{rel:'payer-action',href:`https://www.sandbox.paypal.com/checkoutnow?token=TESTORDER000${calls}`}]};remote.set(value.id,value);}
  else if(u.pathname.endsWith('/capture')){value=remote.get(u.pathname.split('/').at(-2));value.status='COMPLETED';value.purchase_units[0].payments={captures:[{id:'CAPTURE'+value.id,status:'COMPLETED',amount:structuredClone(value.purchase_units[0].amount)}]};}
  else if(u.pathname.startsWith('/v2/payments/captures/'))value=[...remote.values()].flatMap(o=>o.purchase_units?.[0]?.payments?.captures||[]).find(c=>c.id===u.pathname.split('/').pop());
  else value=remote.get(u.pathname.split('/').pop());
  assert.ok(value,url);return {ok:true,status:200,json:async()=>structuredClone(value)};
 };
 try{
  await writeRecord('catalog.json',catalog,null);await writeRecord('cart-coupons.json',{coupons:[coupon]},null);
  for(const countryCode of ['BR','FR']){
   const member={id:randomUUID(),name:'Test buyer',email:'buyer@example.invalid',cpfCnpj:'12345678901',countryCode};
   const items=[...select(3),{kind:'product',id:'other'}],currency=countryCode==='BR'?'BRL':'USD';
   const quoted=await quoteCheckout(member,{items,couponCode:''}),ui=cartSelection(await shop(member),items);assert.equal(quoted.totalCents,ui.total);
   const input={items,requestId:randomUUID(),billingType:countryCode==='BR'?'PIX':'PAYPAL',expectedTotalCents:ui.total,couponCode:''};
   const count=calls;await assert.rejects(()=>checkout(member,{...input,expectedTotalCents:1}),/mudou/);assert.equal(calls,count);
   const order=await checkout(member,{...input,totalCents:1,discountCents:999999,promotion:{percent:100}});
   assert.equal(order.totalCents,quoted.totalCents);assert.equal(order.promotion.percent,10);assert.equal(order.currency,currency);assert.equal(order.licenses.length,0);
   const persisted=(await readRecord('commerce.json')).data.orders.find(o=>o.id===order.id);assert.deepEqual(persisted.promotion,order.promotion);
   assert.equal((await checkout(member,input)).id,order.id);assert.equal(calls,count+1);
   for(const id of order.productIds)assert.equal(await purchaseAccess(member,id),false);
   const payment=remote.get(persisted.paymentId);
   if(currency==='BRL'){assert.equal(payment.value,order.totalCents/100);await assert.rejects(()=>applyPayment(order.id,{...payment,status:'CONFIRMED',value:0.01}),/Valor/);payment.status='CONFIRMED';await applyPayment(order.id,payment);}
   else{assert.equal(payment.purchase_units[0].amount.value,(order.totalCents/100).toFixed(2));payment.status='APPROVED';await refreshPaypal(member,order.id);}
   const paidOrder=(await shop(member)).orders.find(o=>o.id===order.id);assert.equal(paidOrder.licenses.length,4);
   for(const id of order.productIds){assert.equal(await purchaseAccess(member,id),true);assert.ok((await shop(member)).products.find(p=>p.id===id).downloadUrl);}
   assert.equal((await purchaseLicenses(member)).filter(l=>l.status==='active').length,4);
   const report=await salesReport();assert.equal(report[currency==='BRL'?'totalCents':'totalUsdCents'],order.totalCents);
  }
 }finally{globalThis.fetch=fetchBefore;for(const [k,v] of Object.entries(env))v===undefined?delete process.env[k]:process.env[k]=v;await rm(dir,{recursive:true,force:true});}
});

test('unchanged legacy carts reuse pending payments after the promotion deployment',()=>{
 for(const code of ['',coupon.code])for(const provider of ['asaas','paypal']){
  const q=discountQuote(quoteCart(catalog,[{kind:'product',id:'other'}]),code,[coupon]);
  const items=q.items.map(i=>({kind:i.kind,id:i.id,name:i.name,priceCents:i.priceCents,products:i.products,...(code?{discountCents:i.discountCents,totalCents:i.totalCents}:{})}));
  const payload=provider==='paypal'||code?{items,coupon:q.coupon}:items;
  assert.equal(checkoutFingerprint(q,provider),createHash('sha256').update(JSON.stringify(payload)).digest('hex'));
 }
});
