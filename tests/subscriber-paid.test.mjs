import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {Readable,Writable} from 'node:stream';
import {finished} from 'node:stream/promises';
import {productSchema,publicCatalog} from '../server/schema.mjs';
import {productAvailability} from '../lib/subscriber-purchase.mjs';
import {isSubscriptionProduct,canDownloadProduct} from '../lib/subscriber-access.mjs';
import {clubProducts} from '../server/club.mjs';
import {serveProductDownload} from '../server/product-download.mjs';
import {checkout,quoteCheckout,quoteCart,shop,applyPayment,purchaseAccess,purchaseLicenses} from '../server/commerce.mjs';
import {readRecord,writeRecord} from '../server/store.mjs';
import {applyPaypalOrder} from '../server/paypal-commerce.mjs';
import {makeSession} from '../server/auth.mjs';
import handler from '../server/handler.mjs';
import {PDFDocument} from 'pdf-lib';
import seed from '../data/catalog.json' with {type:'json'};

const product={...seed.products[0],id:'subscriber-paid-test',slug:'subscriber-paid-test',name:'Paid exclusive test',collection:'exclusive-test',access:'paid',subscriberPurchaseOnly:true,includedInSubscription:false,published:true,exclusive:false,allowPhysicalSales:false,priceCents:1990,priceUsdCents:499,url:'',filePath:'models/main.3mf',printProfiles:[{id:'fine',name:'Fine',layerHeight:.16,notes:'',filePath:'models/fine.3mf'}]};
const data={...seed,collections:[{id:'exclusive-test',name:'Exclusive',published:true,free:false,priceCents:3000,priceUsdCents:1000}],products:[product]};
const items=[{kind:'product',id:product.id}];

test('paid subscriber option requires price and private files; switches preserve prices without enabling free access',()=>{
 assert.equal(productSchema.parse(product).subscriberPurchaseOnly,true);
 for(const patch of [{access:'subscribers'},{includedInSubscription:true},{priceCents:0},{exclusive:true},{allowPhysicalSales:true},{url:'https://example.com/a.3mf'},{filePath:'',printProfiles:[]}])assert.equal(productSchema.safeParse({...product,...patch}).success,false,JSON.stringify(patch));
 assert.equal(productSchema.safeParse({...product,published:false,filePath:'',printProfiles:[]}).success,true);
 const converted=productAvailability({...product,subscriberPurchaseOnly:false,includedInSubscription:true},'subscribers-paid');
 assert.equal(converted.priceCents,1990);assert.equal(converted.priceUsdCents,499);assert.equal(converted.includedInSubscription,false);
 assert.equal(productAvailability(converted,'paid').subscriberPurchaseOnly,false);
 assert.equal(productAvailability(converted,'subscribers').priceCents,0);
 assert.equal(isSubscriptionProduct({...product,includedInSubscription:true}),false);
 assert.equal(canDownloadProduct(product,{annual:true}),false);
 assert.equal(canDownloadProduct(product,{owned:true}),true);
 assert.equal(publicCatalog(data).products[0].subscriberPurchaseOnly,true);
 assert.ok(!JSON.stringify(publicCatalog(data)).includes('models/'));
});

test('single and bundle quotes require active membership; library downloads still require ownership',()=>{
 for(const selection of [items,[{kind:'collection',id:product.collection}]]){
  assert.throws(()=>quoteCart(data,selection),{status:403});
  assert.ok(quoteCart(data,selection,new Set(),true).totalCents>0);
 }
 for(const [annual,owned] of [[false,false],[true,false],[false,true],[true,true]]){
  const view=clubProducts(data,new Set(owned?[product.id]:[]),annual)[0];
  assert.equal(view.canPurchase,annual&&!owned);assert.equal(Boolean(view.downloadUrl),owned);
  assert.ok(view.printProfiles.every(p=>Boolean(p.downloadUrl)===owned));
 }
});

test('an active subscriber cannot read original or profile until paid; expired buyers retain traced downloads',async()=>{
 let owned=false,reads=0,prepared=0;
 const deps={hasAccess:async()=>owned,subscription:async()=>({active:!owned}),record:async()=>{},readBlob:async()=>{reads++;return {stream:Readable.toWeb(Readable.from(['original']))}},prepare:async()=>{prepared++;return {id:'trace-test',stream:Readable.from(['personal-copy']),cleanup:async()=>{},finish:async()=>{}}}};
 const args={member:{id:'m'},data,productId:product.id};
 for(const profileId of [undefined,'fine'])await assert.rejects(()=>serveProductDownload({...args,profileId},deps),{status:403});
 assert.equal(reads,0);owned=true;
 for(const profileId of [undefined,'fine']){
  let content='';const headers={},res=new Writable({write(c,e,cb){content+=c;cb();}});res.setHeader=(k,v)=>headers[k]=v;
  await serveProductDownload({...args,profileId,res},deps);await finished(res);
  assert.equal(content,'personal-copy');assert.equal(headers['X-TioLira-Download-Code'],'trace-test');
 }
 assert.equal(prepared,2);
});

test('checkout checks server membership before new or reused Asaas/PayPal orders, preserves discount and paid license',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'subscriber-paid-')),env={...process.env},fetch0=globalThis.fetch;
 for(const k of ['DATABASE_URL','POSTGRES_URL','VERCEL','BLOB_READ_WRITE_TOKEN','RESEND_API_KEY'])delete process.env[k];
 Object.assign(process.env,{LOCAL_DATA_DIR:dir,ASAAS_ENVIRONMENT:'sandbox',ASAAS_API_KEY:'test-only',ASAAS_WEBHOOK_TOKEN:'test-webhook-secret-at-least-32-characters',SITE_URL:'https://www.tiolira.com.br',PAYPAL_MERCHANT_ID:'merchant-test',PAYPAL_WEBHOOK_ID:'webhook-test',PAYPAL_ENVIRONMENT:'sandbox',PAYPAL_CLIENT_ID:'test-only',PAYPAL_CLIENT_SECRET:'test-only',ADMIN_SESSION_SECRET:'subscriber-paid-test-session-secret-32-characters'});
 const br={id:randomUUID(),version:randomUUID(),name:'Test',email:'test@example.invalid',cpfCnpj:'52998224725',countryCode:'BR'},us={...br,id:randomUUID(),countryCode:'IE'},outsider={...br,id:randomUUID()};
 const period={startsAt:new Date(Date.now()-86400000).toISOString(),endsAt:new Date(Date.now()+86400000).toISOString()};
 let network=0,remotePayment,remotePaypal;
 const request={items,requestId:randomUUID(),billingType:'PIX',expectedTotalCents:1791};
 try{
  await writeRecord('catalog.json',data,null);
  await writeRecord('club-members.json',{members:[br,us,outsider]},null);
  await writeRecord('maker-subscriptions.json',{subscriptions:[br,us].map(m=>({id:randomUUID(),memberId:m.id,environment:'sandbox',provider:'asaas',status:'active',periods:[period]}))},null);
  globalThis.fetch=async()=>{network++;throw Error('Unexpected network');};
  for(const member of [outsider,{...outsider,countryCode:'IE'}])for(const selection of [items,[{kind:'collection',id:product.collection}]]){
   await assert.rejects(()=>quoteCheckout(member,{items:selection,subscriberDiscountActive:true}),{status:403});
   await assert.rejects(()=>checkout(member,{...request,items:selection,subscriberDiscountActive:true}),{status:403});
   await assert.rejects(()=>checkout(member,{...request,items:selection,expectedTotalCents:0}),{status:403});
  }
  assert.equal(network,0);assert.equal(await readRecord('commerce.json'),null);
  assert.equal((await shop(outsider)).products.length,0);assert.equal((await shop(outsider)).collections.length,0);
  for(const [member,total] of [[br,1791],[us,449]]){
   assert.equal((await quoteCheckout(member,{items})).totalCents,total);
   const offer=(await shop(member)).products[0];assert.equal(offer.subscriptionAccess,false);assert.equal(offer.downloadUrl,null);assert.equal(offer.subscriberPurchaseOnly,true);
  }
  globalThis.fetch=async(url,opts={})=>{
   network++;const u=new URL(url),body=opts.body&&u.pathname!=='/v1/oauth2/token'?JSON.parse(opts.body):{};let result;
   if(u.pathname==='/v3/customers')result=opts.method==='POST'?{id:'cus_test',...body}:{data:[]};
   else if(u.pathname==='/v3/payments'&&opts.method==='POST'){assert.equal(body.value,17.91);remotePayment={...body,id:'pay_test',status:'PENDING'};result=remotePayment;}
   else if(u.pathname==='/v1/oauth2/token')result={access_token:'test-token'};
   else if(u.pathname==='/v2/checkout/orders'){assert.equal(body.purchase_units[0].amount.value,'4.49');result={...body,id:'PAYPALTEST00001',status:'CREATED',links:[{rel:'approve',href:'https://www.sandbox.paypal.com/checkoutnow?token=PAYPALTEST00001'}]};remotePaypal=structuredClone(result);}
   else throw Error('Unexpected URL '+u.pathname);
   return {ok:true,status:200,json:async()=>result};
  };
  const order=await checkout(br,request),usRequest={...request,requestId:randomUUID(),expectedTotalCents:449};
  const international=await checkout(us,usRequest);
  assert.equal(order.totalCents,1791);assert.equal(international.totalCents,449);
  assert.equal(await purchaseAccess(br,product.id),false);
  const subscriptions=await readRecord('maker-subscriptions.json');
  await writeRecord('maker-subscriptions.json',{subscriptions:subscriptions.data.subscriptions.map(s=>({...s,periods:[{...period,endsAt:new Date(Date.now()-1000).toISOString()}]}))},subscriptions.etag);
  const before=network;
  for(const [member,req] of [[br,request],[us,usRequest]]){
   await assert.rejects(()=>checkout(member,req),{status:403});
   await assert.rejects(()=>checkout(member,{...req,items:[{kind:'product',id:'different-product'}]}),{status:403});
  }
  assert.equal(network,before);
  await applyPayment(order.id,{...remotePayment,status:'CONFIRMED'});
  assert.equal(await purchaseAccess(br,product.id),true);
  assert.equal((await purchaseLicenses(br))[0].status,'active');
  assert.ok((await shop(br)).products[0].downloadUrl);
  remotePaypal.status='COMPLETED';
  remotePaypal.purchase_units[0].payments={captures:[{id:'CAPTURETEST00001',status:'COMPLETED',amount:remotePaypal.purchase_units[0].amount}]};
  await applyPaypalOrder(international.id,remotePaypal);
  const pdfFor=async(member,code)=>{
   const cookie='tiolira_club='+await makeSession(member.version,{memberId:member.id});let result;
   await handler({method:'GET',url:'/api/club/licenses/download?code='+encodeURIComponent(code),headers:{host:'localhost',cookie},socket:{remoteAddress:'test'}},{statusCode:200,setHeader(){},end(body){result={status:this.statusCode,body};}});
   return result;
  };
  for(const buyer of [br,us]){
   assert.equal(await purchaseAccess(buyer,product.id),true);
   const licenses=await purchaseLicenses(buyer);assert.equal(licenses.length,1);assert.equal(licenses[0].status,'active');assert.equal(licenses[0].productId,product.id);
   const pdf=await pdfFor(buyer,licenses[0].code);assert.equal(pdf.status,200);assert.equal(pdf.body.subarray(0,5).toString(),'%PDF-');assert.equal((await PDFDocument.load(pdf.body)).getPageCount(),1);
   assert.equal((await pdfFor(outsider,licenses[0].code)).status,404);
   for(const profileId of [undefined,'fine']){
    let content='';const res=new Writable({write(c,e,cb){content+=c;cb();}});res.setHeader=()=>{};
    // Use real ownership/subscription checks from the paid order; only storage/bytes are simulated.
    await serveProductDownload({member:buyer,data,productId:product.id,profileId,res},{readBlob:async()=>({stream:Readable.toWeb(Readable.from(['test original']))}),prepare:async()=>({id:'trace-integration',stream:Readable.from(['personal test copy']),cleanup:async()=>{},finish:async()=>{}})});
    await finished(res);assert.equal(content,'personal test copy');
   }
  }
  assert.notEqual((await purchaseLicenses(br))[0].code,(await purchaseLicenses(us))[0].code);
  // Replayed payment confirmations neither duplicate nor replace the purchase license.
  const codes=await Promise.all([br,us].map(async m=>(await purchaseLicenses(m))[0].code));
  await applyPayment(order.id,{...remotePayment,status:'CONFIRMED'});await applyPaypalOrder(international.id,remotePaypal);
  assert.deepEqual(await Promise.all([br,us].map(async m=>(await purchaseLicenses(m))[0].code)),codes);

 }finally{
  globalThis.fetch=fetch0;for(const k of Object.keys(process.env))if(!(k in env))delete process.env[k];Object.assign(process.env,env);await rm(dir,{recursive:true,force:true});
 }
});
