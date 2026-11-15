import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {commercialPolicy,yearAfter,subscriptionView,MAKER_VERSION} from '../lib/maker-license.mjs';
import {readRecord,writeRecord} from '../server/store.mjs';
import {startSubscription,refreshSubscription,cancelSubscription,annualLicense,subscriptionWebhook,paymentPeriod} from '../server/maker-subscriptions.mjs';
import {clubProducts,ensureCollectionLicenses,issueLicense} from '../server/club.mjs';
import {migrateMakerCatalog} from '../server/maker-catalog.mjs';
import handler from '../server/handler.mjs';
const product=(id,collection='presepio')=>({id,name:id,access:'maker',url:`https://makerworld.com/pt/models/${id}-x`,collection,allowPhysicalSales:true,published:true});
test('one annual license covers MakerWorld, with explicit exceptions and free downloads',()=>{
 for(const id of ['3497372','3612025','3602435','3614080'])assert.equal(commercialPolicy(product(id),[{id:'presepio',free:true}]),'annual');
 assert.equal(commercialPolicy(product('3524308')),'noncommercial');assert.equal(commercialPolicy(product('3354199')),'free');
 const data={collections:[{id:'presepio',free:true,published:true}],products:[product('3612025'),product('3524308')]};
 assert.equal(clubProducts(data)[0].canLicense,false);assert.ok(clubProducts(data)[0].downloadUrl);assert.equal(clubProducts(data,new Set(),true)[0].canLicense,true);assert.equal(clubProducts(data,new Set(['3524308']),true,new Set(['3524308']))[1].canLicense,false);
 assert.equal(yearAfter('2024-02-29T12:00:00.000Z'),'2025-02-28T12:00:00.000Z');
 assert.equal(subscriptionView({periods:[{startsAt:'2024-01-01',endsAt:'2025-01-01'}]},Date.parse('2025-01-01')).active,false);
 assert.equal(subscriptionView({periods:[{startsAt:'2027-01-01',endsAt:'2028-01-01'}]},Date.parse('2026-01-01')).active,false);
});
test('checkout, verification, replay, cancellation, refunds and access controls',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'tl-maker-test-')),old={...process.env},originalFetch=globalThis.fetch;
 for(const k of ['DATABASE_URL','POSTGRES_URL','VERCEL','BLOB_READ_WRITE_TOKEN'])delete process.env[k];
 Object.assign(process.env,{LOCAL_DATA_DIR:dir,ASAAS_ENVIRONMENT:'sandbox',ASAAS_API_KEY:'test-only',ASAAS_WEBHOOK_TOKEN:'test-token-with-at-least-thirty-two-characters',SITE_URL:'https://www.tiolira.com.br',ADMIN_SESSION_SECRET:'test-session-secret-with-at-least-32-characters'});
 const member={id:'member-a',name:'Test',email:'a@example.invalid'},other={id:'member-b',name:'Other',email:'b@example.invalid'},today=new Date().toISOString().slice(0,10);
 let checkouts=0,payments=[],remote={id:'sub_test',customer:'cus_test',value:49.9,cycle:'YEARLY',billingType:'CREDIT_CARD',status:'ACTIVE'},timeout=false;
 globalThis.fetch=async(url,options)=>{const u=new URL(url);let data;
 if(u.pathname==='/v3/checkouts'){checkouts++;const b=JSON.parse(options.body);assert.equal(b.items.length,1);assert.equal(b.items[0].value,49.9);assert.equal(b.items[0].quantity,1);assert.deepEqual(b.chargeTypes,['RECURRENT']);assert.equal(b.subscription.cycle,'YEARLY');assert.ok(b.callback.successUrl.endsWith('#assinatura'));if(timeout)throw Error('timeout after commit');data={id:'checkout_test_12345'};}
 else if(u.pathname==='/v3/payments'){assert.ok(u.searchParams.get('checkoutSession')==='checkout_test_12345'||u.searchParams.get('subscription')==='sub_test');data={data:payments};}
 else if(u.pathname==='/v3/subscriptions/sub_test'){if(options.method==='DELETE'){remote.deleted=true;data={id:remote.id,deleted:true}}else data=remote;}
 else throw Error('Unexpected request '+u.pathname);
 return {ok:true,status:200,json:async()=>structuredClone(data)};};
 const call=async(route,method='GET',body={})=>{let out;await handler({method,url:'/api/'+route,body,headers:{host:'localhost',origin:'http://localhost'},socket:{remoteAddress:'test'}},{setHeader(){},set statusCode(s){this.status=s},end(value){out={status:this.status,body:JSON.parse(value)}}});return out};
 try{
 for(const path of ['club/maker-subscription','club/maker-subscription/license','admin/maker-subscriptions'])assert.equal((await call(path)).status,401);
 assert.equal((await call('webhooks/maker-subscriptions','POST',{event:'CHECKOUT_PAID'})).status,401);
 await assert.rejects(()=>startSubscription(member,{consent:false}),/Aceite/);
 const input={consent:true,termsVersion:MAKER_VERSION,lang:'pt',priceCents:1};await assert.rejects(()=>startSubscription(member,input),/indisponível/);
 await writeRecord('maker-subscriptions.json',{subscriptions:[],webhookEnvironment:'sandbox'},null);
 const starts=await Promise.allSettled([startSubscription(member,input),startSubscription(member,input)]);assert.equal(checkouts,1);assert.ok(starts.some(r=>r.status==='fulfilled'));
 assert.equal((await refreshSubscription(member)).active,false);await assert.rejects(()=>annualLicense(other),e=>e.status===403);
 payments=[{id:'pay_1',subscription:'sub_test',customer:'cus_test',billingType:'CREDIT_CARD',value:1,dueDate:today,clientPaymentDate:today,status:'CONFIRMED'}];
 await assert.rejects(()=>refreshSubscription(member),/Cobrança/);assert.equal((await readRecord('maker-subscriptions.json')).data.subscriptions[0].subscriptionId,undefined);
 payments[0].value=49.9;const active=await refreshSubscription(member);assert.equal(active.active,true);assert.equal(active.autoRenew,true);
 const snapshot=JSON.stringify((await readRecord('maker-subscriptions.json')).data.subscriptions[0].periods);
 await subscriptionWebhook({event:'PAYMENT_RECEIVED',payment:{id:'pay_1',subscription:'sub_test',value:1}});assert.equal(JSON.stringify((await readRecord('maker-subscriptions.json')).data.subscriptions[0].periods),snapshot);
 const license=await annualLicense(member);assert.ok(license.code.startsWith('TL-MW-'));assert.ok(license.terms.includes('Ayrton Senna'));assert.equal((await refreshSubscription(other)).active,false);
 const row=(await readRecord('maker-subscriptions.json')).data.subscriptions[0];assert.throws(()=>paymentPeriod({...payments[0],customer:'cus_other'},row),/Cobrança/);
 const cancelled=await cancelSubscription(member);assert.equal(cancelled.active,true);assert.equal(cancelled.autoRenew,false);
 payments[0].status='REFUNDED';assert.equal((await refreshSubscription(member)).active,false);payments[0].status='CONFIRMED';assert.equal((await refreshSubscription(member)).active,false,'refund remains revoked after late events');await assert.rejects(()=>annualLicense(member),e=>e.status===403);
 process.env.ASAAS_ENVIRONMENT='production';assert.equal((await refreshSubscription(member)).active,false);process.env.ASAAS_ENVIRONMENT='sandbox';
 timeout=true;await assert.rejects(()=>startSubscription(other,input));const before=checkouts;await assert.rejects(()=>startSubscription(other,input));assert.equal(checkouts,before);
 const catalog={collections:[{id:'presepio',name:'Presépio',free:true,published:true}],products:[product('3612025'),product('3354199'),product('3524308')]};
 const free=await ensureCollectionLicenses(other,catalog);assert.deepEqual(free.collectionLicenses[0].productIds,['3354199']);
 await assert.rejects(()=>issueLicense(other,product('3524308')),e=>e.status===403);await assert.rejects(()=>issueLicense(other,product('3612025')),e=>e.status===403);
 }finally{globalThis.fetch=originalFetch;for(const k of Object.keys(process.env))if(!(k in old))delete process.env[k];Object.assign(process.env,old);await rm(dir,{recursive:true,force:true})}
});
test('catalog migration adds four works once and preserves unrelated files',()=>{const p={id:'96f7f843-b608-4a57-8f27-6ba12e2862da',name:'Senna',access:'maker',url:'https://makerworld.com/pt/models/3524308',filePath:''},data={collections:[],products:[p,{id:'paid-other',filePath:'models/original.3mf',access:'paid'}]},m=migrateMakerCatalog(data);assert.equal(m.products.length,6);assert.equal(migrateMakerCatalog(m),m);assert.equal(m.products[1].filePath,'models/original.3mf');assert.deepEqual(m.products[0],p);assert.equal(data.products.length,2)});
