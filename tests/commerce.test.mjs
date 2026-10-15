import test from 'node:test';
import {PDFDocument} from 'pdf-lib';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {checkout,quoteCheckout,quoteCart,shop,paymentDetails,purchaseLicenses,purchaseAccess,receiveWebhook,applyPayment,refreshOrder,recordDownload,salesReport} from '../server/commerce.mjs';
import {readRecord,writeRecord} from '../server/store.mjs';
import {invoiceUrl} from '../server/asaas.mjs';
import {clubProducts} from '../server/club.mjs';
import {makeSession} from '../server/auth.mjs';
import handler from '../server/handler.mjs';
import seed from '../data/catalog.json' with {type:'json'};

test('cart, Asaas reconciliation, protected downloads and sales',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'tiolira-sales-'));
 const keys=['DATABASE_URL','POSTGRES_URL','VERCEL','BLOB_READ_WRITE_TOKEN','LOCAL_DATA_DIR','ASAAS_ENVIRONMENT','ASAAS_API_KEY','ASAAS_WEBHOOK_TOKEN','ADMIN_SESSION_SECRET','RESEND_API_KEY','EMAIL_FROM','SITE_URL','ASAAS_PAYMENT_REDIRECT_ENABLED'];
 const env=Object.fromEntries(keys.map(k=>[k,process.env[k]])),originalFetch=globalThis.fetch;
 for(const k of keys)delete process.env[k];
 Object.assign(process.env,{RESEND_API_KEY:'test-resend',EMAIL_FROM:'Tio Lira <test@example.invalid>',SITE_URL:'https://www.tiolira.com.br',LOCAL_DATA_DIR:dir,ASAAS_ENVIRONMENT:'sandbox',ASAAS_API_KEY:'test-only',ASAAS_WEBHOOK_TOKEN:'test-webhook-secret-with-at-least-32-chars',ADMIN_SESSION_SECRET:'test-session-secret-at-least-32-characters'});
 const a={id:randomUUID(),version:randomUUID(),name:'A',email:'a@example.invalid',cpfCnpj:'12345678901'},b={id:randomUUID(),version:randomUUID(),name:'B',email:'b@example.invalid',cpfCnpj:'12345678000199'},c={id:randomUUID(),version:randomUUID(),name:'C',email:'c@example.invalid',cpfCnpj:'12345678901'};
 const data=structuredClone(seed);data.collections.push({id:'folclore-test',name:'Folclore Brasileiro Parte 1',published:true,free:false,comingSoon:false,priceCents:4990});
 const products=['saci','curupira','boitata','cuca','mula'].map(id=>({id,name:id,slug:id,collection:'folclore-test',published:true,access:'paid',priceCents:1490,filePath:`models/${id}.zip`}));data.products.push(...products);
 let posts=0,callbackUpdates=0,timeout=false;const remote=new Map(),customers=new Map();
 globalThis.fetch=async(url,options={})=>{
  const u=new URL(url),payload=options.body?JSON.parse(options.body):{};
  if(u.origin==='https://api.resend.com')return {ok:true,json:async()=>({id:'email-demo'})};
  assert.equal(u.origin,'https://api-sandbox.asaas.com');assert.equal(options.headers.access_token,'test-only');
  let result;
  if(u.pathname==='/v3/customers'&&options.method==='GET')result={data:[...customers.values()].filter(c=>c.externalReference===u.searchParams.get('externalReference'))};
  else if(u.pathname==='/v3/customers'){result={...payload,id:`cus_${customers.size+1}`};customers.set(result.id,result);assert.equal(payload.notificationDisabled,true);assert.equal(payload.cpfCnpj,[a,b,c].find(m=>payload.externalReference===`tiolira:${m.id}`).cpfCnpj);}
  else if(u.pathname==='/v3/payments'&&options.method==='POST'){posts++;result={...payload,id:`pay_${posts}`,invoiceUrl:`https://sandbox.asaas.com/i/${posts}`,status:'PENDING'};remote.set(result.id,result);if(timeout){timeout=false;throw Error('timeout after remote commit');}}
  else if(u.pathname==='/v3/payments')result={data:[...remote.values()].filter(p=>p.externalReference===u.searchParams.get('externalReference'))};
  else if(options.method==='PUT'&&u.pathname.startsWith('/v3/payments/')){assert.deepEqual(Object.keys(payload),['callback']);callbackUpdates++;result=remote.get(u.pathname.split('/').pop());assert.ok(result);Object.assign(result,payload);}
  else if(u.pathname.endsWith('/pixQrCode'))result={encodedImage:'aGVsbG8=',payload:'000201-test-pix',expirationDate:'2030-01-01 23:59:59'};
  else if(u.pathname.endsWith('/identificationField'))result={identificationField:'00190.00009 01234.567890 12345.678901 1 99990000001490'};
  else result=remote.get(u.pathname.split('/').pop());
  assert.ok(result);return {ok:true,status:200,json:async()=>structuredClone(result)};
 };
 const cookie=`tiolira_club=${await makeSession(a.version,{memberId:a.id})}`;
 const call=async(route,{method='GET',body={},headers={}}={})=>{let result;await handler({method,url:'/api/'+route,body,headers:{host:'localhost',origin:'http://localhost',cookie,...headers},socket:{remoteAddress:'test'}},{setHeader(){},set statusCode(s){this.status=s},end(v){result={status:this.status||200,body:Buffer.isBuffer(v)?v:JSON.parse(v)}}});return result;};
 const input=(items=[{kind:'product',id:'saci'}])=>({items,requestId:randomUUID(),billingType:'PIX',cpfCnpj:'99999999999',totalCents:1});
 try{
  await writeRecord('catalog.json',data,null);await writeRecord('club-members.json',{members:[a,b]},null);
  await t.test('checkout requires the private profile document before contacting Asaas',async()=>{await assert.rejects(()=>checkout({...a,cpfCnpj:''},input()),/Meus dados/);assert.equal(customers.size,0);assert.equal(posts,0);assert.equal(await readRecord('commerce.json'),null)});
  await t.test('published singles remain purchasable while their collection is in preparation',async()=>{
   const draft=structuredClone(data);draft.collections.find(c=>c.id==='folclore-test').comingSoon=true;
   draft.products.find(p=>p.id==='curupira').priceCents=1790;
   draft.products.find(p=>p.id==='mula').published=false;
   await writeRecord('catalog.json',draft,(await readRecord('catalog.json')).etag);
   const offers=await shop(b);assert.equal(offers.products.find(p=>p.id==='curupira').priceCents,1790);assert.ok(!offers.products.some(p=>p.id==='mula'));assert.ok(!offers.collections.some(c=>c.id==='folclore-test'));
   assert.equal(quoteCart(draft,[{kind:'product',id:'curupira'}]).totalCents,1790);assert.throws(()=>quoteCart(draft,[{kind:'collection',id:'folclore-test'}]));
   assert.equal(clubProducts(draft).find(p=>p.id==='curupira').canPurchase,true);assert.equal(clubProducts(draft,new Set(['curupira'])).find(p=>p.id==='curupira').canPurchase,false);
   draft.products.find(p=>p.id==='curupira').filePath='';assert.throws(()=>quoteCart(draft,[{kind:'product',id:'curupira'}]));assert.ok(!clubProducts(draft).some(p=>p.id==='curupira'));
   await writeRecord('catalog.json',data,(await readRecord('catalog.json')).etag);
  });
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
   const paidOrder=(await shop(a)).orders.find(o=>o.id===first.id),download=paidOrder.licenses[0].downloadUrl.replace('/api/','');
   const pdf=await call(download);assert.equal(pdf.status,200);assert.equal(pdf.body.subarray(0,5).toString(),'%PDF-');assert.equal((await PDFDocument.load(pdf.body)).getPageCount(),1);
   assert.equal((await call(download,{headers:{cookie:''}})).status,401);
   const otherCookie=`tiolira_club=${await makeSession(b.version,{memberId:b.id})}`;
   assert.equal((await call(download,{headers:{cookie:otherCookie}})).status,404);
   assert.equal((await call('club/licenses/download?code=unknown')).status,404);
  });
  await t.test('bundle overlap requires acknowledgement; bundle records all five pieces and integer revenue',async()=>{
   const body=input([{kind:'collection',id:'folclore-test'},{kind:'product',id:'saci'}]);await assert.rejects(()=>checkout(a,body),/sem abatimento/);
   const listed=(await shop(a)).collections.find(c=>c.id==='folclore-test');assert.equal(listed.priceCents,4990);assert.deepEqual(new Set(listed.productIds),new Set(products.map(p=>p.id)));
   const order=await checkout(a,{...body,acceptOverlap:true});assert.equal(order.totalCents,4990);assert.equal(order.items.length,1);assert.equal(order.productIds.length,5);
   for(const p of products.filter(p=>p.id!=='saci')){assert.equal(await purchaseAccess(a,p.id),false);assert.equal((await call(`download?id=${p.id}`)).status,403);}
   assert.equal((await shop(a)).orders.find(o=>o.id===order.id).licenses.length,0);
   remote.get('pay_2').status='RECEIVED';await refreshOrder(a,order.id);
   for(const p of products)assert.equal(await purchaseAccess(a,p.id),true);
   assert.equal((await purchaseLicenses(a)).filter(l=>l.orderId===order.id&&l.status==='active').length,5);
   const paidShop=await shop(a),paidBundle=paidShop.orders.find(o=>o.id===order.id);
   assert.equal(paidBundle.licenses.length,5);
   for(const p of products){
    assert.equal(paidShop.products.find(x=>x.id===p.id).downloadUrl,`/api/download?id=${p.id}`);
    const license=paidBundle.licenses.find(l=>l.productId===p.id);assert.ok(license);
    const pdf=await call(license.downloadUrl.replace('/api/',''));assert.equal(pdf.status,200);assert.equal((await PDFDocument.load(pdf.body)).getPageCount(),1);
    const otherCookie=`tiolira_club=${await makeSession(b.version,{memberId:b.id})}`;
    assert.equal((await call(license.downloadUrl.replace('/api/',''),{headers:{cookie:otherCookie}})).status,404);
   }
   await refreshOrder(a,order.id);assert.deepEqual((await shop(a)).orders.find(o=>o.id===order.id).licenses,paidBundle.licenses);
   const generated=await call('club/licenses',{method:'POST',body:{productId:'cuca'}});assert.equal(generated.status,200);assert.equal(generated.body.license.source,'purchase');
   await recordDownload(a,products[0]);const report=await salesReport();assert.equal(report.totalCents,6480);assert.equal(report.products.reduce((n,p)=>n+p.revenueCents,0),6480);const saci=report.products.find(p=>p.id==='saci');assert.equal(saci.individualSales,1);assert.equal(saci.collectionSales,1);assert.equal(saci.downloads,1);
  });
  await t.test('timeout is reconciled rather than creating another payment',async()=>{
   const body=input([{kind:'product',id:'cuca'}]);timeout=true;await assert.rejects(()=>checkout(b,body));assert.equal(posts,3);
   const pending=await checkout(b,body);assert.equal(pending.status,'creating');assert.equal(posts,3);await refreshOrder(b,pending.id);assert.equal(posts,3);assert.equal((await shop(b)).orders[0].status,'pending');
  });
  await t.test('refund revokes bundle; delayed events cannot restore it; sandbox cannot unlock production',async()=>{
   const p=remote.get('pay_2');p.refunds=[{status:'DONE',value:10}];p.value=39.90;await receiveWebhook({id:'evt-refund',event:'PAYMENT_PARTIALLY_REFUNDED',payment:{id:p.id}});assert.equal(await purchaseAccess(a,'cuca'),false);assert.equal(await purchaseAccess(a,'saci'),true);assert.equal((await purchaseLicenses(a)).filter(l=>l.status==='suspended').length,5);
   const suspended=(await purchaseLicenses(a)).find(l=>l.status==='suspended');
   assert.equal((await call(`club/licenses/download?code=${suspended.code}`)).status,404);
   assert.equal((await shop(a)).orders.find(o=>o.id===suspended.orderId).licenses.length,0);
   p.status='CONFIRMED';p.value=49.90;p.refunds=[];await receiveWebhook({id:'evt-delayed-paid',event:'PAYMENT_CONFIRMED',payment:{id:p.id}});assert.equal(await purchaseAccess(a,'cuca'),false);
   process.env.ASAAS_ENVIRONMENT='production';assert.equal(await purchaseAccess(a,'saci'),false);assert.equal((await call(`club/licenses/download?code=${(await readRecord('commerce.json')).data.orders[0].licenses[0].code}`)).status,404);process.env.ASAAS_ENVIRONMENT='sandbox';
  });

  await t.test('hosted card checkout accepts no card data, reuses the invoice and verifies payment before access',async()=>{
   const boleto=await checkout(b,{...input([{kind:'product',id:'curupira'}]),billingType:'BOLETO'});
   assert.ok((await paymentDetails(b,boleto.id)).boleto.identificationField.startsWith('00190'));
   const body={...input(),billingType:'CREDIT_CARD',lang:'es'};
   const before=posts;
   const [order,duplicate]=await Promise.all([checkout(c,body),checkout(c,body)]);
   assert.equal(order.id,duplicate.id);assert.equal(posts,before+1);
   assert.equal(order.status,'pending');assert.equal(order.billingType,'CREDIT_CARD');
   assert.match(order.paymentUrl,/^https:\/\/sandbox\.asaas\.com\/i\//);
   const p=[...remote.values()].find(p=>p.externalReference===order.id);
   assert.equal(p.value,14.90);
   assert.deepEqual(p.callback,{successUrl:`https://www.tiolira.com.br/es/clube?pedido=${order.id}&retorno=asaas#compras`,autoRedirect:true});
   for(const field of ['creditCard','creditCardHolderInfo','creditCardToken','remoteIp'])assert.equal(field in p,false);
   const legacy={...body,requestId:randomUUID(),creditCard:{number:'4444444444444444',ccv:'123'},creditCardHolderInfo:{email:'holder@example.invalid'}};
   assert.equal((await checkout(c,legacy)).id,order.id);assert.equal(posts,before+1);
   const saved=JSON.stringify((await readRecord('commerce.json')).data);for(const secret of ['4444444444444444','creditCard','holder@example.invalid'])assert.equal(saved.includes(secret),false);
   assert.equal((await paymentDetails(c,order.id)).order.paymentUrl,order.paymentUrl);
   assert.equal(await purchaseAccess(c,'saci'),false);assert.equal((await purchaseLicenses(c)).length,0);
   const oldRecord=await readRecord('commerce.json');delete oldRecord.data.orders.find(o=>o.id===order.id).paymentReturnUrl;delete p.callback;
   await writeRecord('commerce.json',oldRecord.data,oldRecord.etag);
   const writes=callbackUpdates;await paymentDetails(c,order.id);
   assert.equal(callbackUpdates,writes+1);assert.equal(posts,before+1);
   assert.deepEqual(p.callback,{successUrl:`https://www.tiolira.com.br/es/clube?pedido=${order.id}&retorno=asaas#compras`,autoRedirect:true});
   await paymentDetails(c,order.id);assert.equal(callbackUpdates,writes+1);
   await assert.rejects(()=>paymentDetails(b,order.id),/Pedido não encontrado/);
   p.status='CONFIRMED';const returned=await paymentDetails(c,order.id);assert.equal(returned.order.status,'paid');
   assert.equal((await shop(c)).products.find(p=>p.id==='saci').downloadUrl,'/api/download?id=saci');
   const license=returned.order.licenses[0].code;
   await receiveWebhook({id:'evt-hosted-card-paid',event:'PAYMENT_CONFIRMED',payment:{id:p.id}});
   assert.equal(await purchaseAccess(c,'saci'),true);assert.equal((await purchaseLicenses(c)).length,1);assert.equal((await paymentDetails(c,order.id)).order.licenses[0].code,license);
  });
  await t.test('a card creation timeout recovers the same hosted invoice without another charge',async()=>{
   const body={...input([{kind:'product',id:'boitata'}]),billingType:'CREDIT_CARD'};
   const before=posts;timeout=true;await assert.rejects(()=>checkout(c,body));
   const pending=await checkout(c,body);assert.equal(pending.status,'creating');assert.equal(posts,before+1);
   const recovered=await paymentDetails(c,pending.id);assert.equal(recovered.order.status,'pending');assert.ok(recovered.order.paymentUrl);assert.equal(posts,before+1);
   assert.equal(await purchaseAccess(c,'boitata'),false);
  });
  await t.test('edited catalog prices apply to new purchases, preserving existing orders',async()=>{
   data.products.find(p=>p.id==='saci').priceCents=1990;data.collections.find(c=>c.id==='folclore-test').priceCents=5990;
   await writeRecord('catalog.json',data,(await readRecord('catalog.json')).etag);
   assert.equal(quoteCart(data,[{kind:'product',id:'saci'}]).totalCents,1990);assert.equal(quoteCart(data,[{kind:'collection',id:'folclore-test'}]).totalCents,5990);
   assert.equal((await shop(a)).orders.find(o=>o.id===first.id).totalCents,1490);
  });
  await t.test('admin coupons are private; discounted checkout charges server total and preserves history',async()=>{
   const item={id:randomUUID(),code:'folclore10',type:'percent',value:10,minimumCents:1000,active:true,expiresAt:''};
   assert.equal((await call('admin/cart-coupons')).status,401);
   assert.equal((await call('admin/cart-coupons',{method:'PUT',body:{item,revision:null}})).status,401);
   const admin={version:randomUUID()};await writeRecord('admin.json',admin,null);
   const headers={cookie:`tiolira_admin=${await makeSession(admin.version)}`};
   const saved=await call('admin/cart-coupons',{method:'PUT',body:{item,revision:null},headers});assert.equal(saved.status,200);assert.equal(saved.body.coupons[0].code,'FOLCLORE10');
   assert.equal((await call('admin/cart-coupons',{headers})).body.coupons.length,1);
   assert.equal((await call('admin/cart-coupons',{method:'PUT',headers,body:{item:{...item,id:randomUUID()},revision:saved.body.revision}})).status,409);
   assert.ok(!JSON.stringify((await call('catalog')).body).includes('FOLCLORE10'));
   const items=[{kind:'product',id:'cuca'}],q=await quoteCheckout(a,{items,couponCode:'folclore10',discountCents:1490,totalCents:1});assert.equal(q.totalCents,1341);
   assert.equal((await call('club/cart-quote',{method:'POST',body:{items,couponCode:item.code}})).body.totalCents,1341);
   const body={...input(items),couponCode:item.code,expectedTotalCents:1};const before=posts;
   await assert.rejects(()=>checkout(a,body),/desconto mudou/);assert.equal(posts,before);
   body.expectedTotalCents=q.totalCents;
   const [order,duplicate]=await Promise.all([checkout(a,body),checkout(a,body)]);assert.equal(order.id,duplicate.id);assert.equal(posts,before+1);assert.equal(order.discountCents,149);assert.equal(order.totalCents,1341);
   const payment=[...remote.values()].find(p=>p.externalReference===order.id);assert.equal(payment.value,13.41);
   const disabled=await call('admin/cart-coupons',{method:'PUT',headers,body:{item:{...item,active:false},revision:saved.body.revision}});assert.equal(disabled.status,200);
   assert.equal((await checkout(a,body)).id,order.id);
   await assert.rejects(()=>quoteCheckout(b,{items,couponCode:item.code}),/inativo/);
   assert.equal((await shop(a)).orders.find(o=>o.id===order.id).discountCents,149);
   await assert.rejects(()=>applyPayment(order.id,{...payment,value:14.90,status:'RECEIVED'}),/Valor/);
   payment.status='RECEIVED';await receiveWebhook({id:'evt-discount-paid',event:'PAYMENT_RECEIVED',payment:{id:payment.id}});
   assert.equal(await purchaseAccess(a,'cuca'),true);
   const report=await salesReport();assert.equal(report.products.reduce((n,p)=>n+p.revenueCents,0),report.totalCents);assert.equal(report.orders.find(o=>o.id===order.id).coupon.code,'FOLCLORE10');
  });
 }finally{globalThis.fetch=originalFetch;for(const k of keys){if(env[k]===undefined)delete process.env[k];else process.env[k]=env[k];}await rm(dir,{recursive:true,force:true});}
});
