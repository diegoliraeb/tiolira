import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {readRecord,writeRecord,updateRecord} from '../server/store.mjs';
import {startMakerPurchase,refreshMakerPurchase,applyMakerAsaas,applyMakerPaypal,makerPurchases,makerPaypalPurchaseEvent,PURCHASE_KEY} from '../server/maker-purchases.mjs';
import {startSubscription,subscriptionDashboard,annualLicense,subscriptionReport} from '../server/maker-subscriptions.mjs';
import {makerMarket,purchaseValidity,reminderWindow} from '../lib/maker-purchases.mjs';
import {MAKER_VERSION,yearAfter} from '../lib/maker-license.mjs';
import {clubDashboard} from '../server/club.mjs';
import {getCatalog} from '../server/store.mjs';
import {renewalReport,sendRenewalNotice} from '../server/maker-renewals.mjs';
test('market is derived from member country; paid periods extend without losing days',()=>{
 assert.deepEqual(makerMarket({countryCode:'BR'}),{provider:'asaas',currency:'BRL',totalCents:4990});assert.deepEqual(makerMarket({countryCode:'US'}),{provider:'paypal',currency:'USD',totalCents:832});
 const rows=[{id:'1',status:'paid',startsAt:'2026-01-01',endsAt:'2027-01-01'},{id:'2',status:'paid',startsAt:'2027-01-01',endsAt:'2028-01-01'}];assert.equal(purchaseValidity(rows,Date.parse('2026-12-15')).validUntil,'2028-01-01T00:00:00.000Z');rows[0].status='revoked';assert.equal(purchaseValidity(rows,Date.parse('2026-12-15')).active,false);assert.equal(reminderWindow('2027-01-01',Date.parse('2026-12-05')),'30');assert.equal(reminderWindow('2027-01-01',Date.parse('2026-12-27')),'7');assert.equal(reminderWindow('2027-01-01',Date.parse('2027-01-02')),null);
});
test('existing one-off Asaas purchases retain validation, PDF, refund and renewal reminders',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'tl-maker-legacy-')),saved={...process.env},originalFetch=globalThis.fetch;
 for(const k of ['DATABASE_URL','POSTGRES_URL','VERCEL','BLOB_READ_WRITE_TOKEN'])delete process.env[k];Object.assign(process.env,{LOCAL_DATA_DIR:dir,ASAAS_ENVIRONMENT:'sandbox',ASAAS_API_KEY:'test-only',ASAAS_WEBHOOK_TOKEN:'test-token-32-characters-long-value',SITE_URL:'https://www.tiolira.com.br',RESEND_API_KEY:'test-only',EMAIL_FROM:'Test <test@example.invalid>'});
 const m={id:'buyer',name:'Test',email:'buyer@example.invalid',countryCode:'BR',whatsapp:'82999999999'},near=new Date(Date.now()+5*86400000).toISOString();
 const row={id:'old-checkout',memberId:m.id,name:m.name,email:m.email,whatsapp:m.whatsapp,provider:'asaas',environment:'sandbox',currency:'BRL',totalCents:4990,billingType:'PIX',customerId:'cus_1',status:'pending',createdAt:new Date().toISOString()};
 let remote={id:'pay_old',customer:'cus_1',externalReference:'tl-maker-purchase:'+row.id,billingType:'PIX',value:49.9,status:'PENDING',invoiceUrl:'https://sandbox.asaas.com/i/test'},mails=0;
 globalThis.fetch=async(url,o={})=>{const u=new URL(url);let d;if(u.hostname==='api.resend.com'){mails++;assert.ok(o.headers['Idempotency-Key']);d={id:'email-1'};}else{assert.notEqual(o.method,'POST','existing checkout must not create another payment');d=u.pathname==='/v3/payments'?{data:[remote]}:remote;}return {ok:true,status:200,json:async()=>structuredClone(d)};};
 try{
 await writeRecord(PURCHASE_KEY,{purchases:[row]},null);await writeRecord('club-members.json',{members:[m]},null);
 await assert.rejects(()=>applyMakerAsaas(row.id,{...remote,status:'RECEIVED',value:1}));await assert.rejects(()=>applyMakerAsaas(row.id,{...remote,status:'RECEIVED',customer:'bad'}));await assert.rejects(()=>refreshMakerPurchase({id:'other'},row.id));
 remote.status='RECEIVED';await refreshMakerPurchase(m,row.id);const expiry=(await annualLicense(m)).validUntil;await refreshMakerPurchase(m,row.id);assert.equal((await annualLicense(m)).validUntil,expiry);
 const catalog=(await getCatalog()).data;catalog.collections=[{id:'annual-test',published:true,free:false}];catalog.products=[{id:'annual-test',name:'Test model',collection:'annual-test',published:true,access:'maker',url:'https://makerworld.com/en/models/123456',priceCents:0}];assert.equal((await clubDashboard(m,catalog)).downloads[0].canLicense,true);
 await updateRecord(PURCHASE_KEY,d=>{d.purchases[0].endsAt=near;return d});const report=await subscriptionReport();assert.equal(report.subscriptions[0].eligible,true);assert.equal(report.subscriptions[0].daysRemaining,5);assert.match(report.subscriptions[0].whatsappUrl,/wa.me\/5582999999999/);
 await sendRenewalNotice(m.id,'email');await sendRenewalNotice(m.id,'email');assert.equal(mails,1);assert.equal((await renewalReport()).subscriptions[0].notices[0].status,'sent');assert.equal((await sendRenewalNotice(m.id,'whatsapp')).status,'opened');
 remote.status='REFUNDED';await refreshMakerPurchase(m,row.id);assert.equal((await subscriptionDashboard(m)).active,false);remote.status='RECEIVED';await applyMakerAsaas(row.id,remote);assert.equal((await subscriptionDashboard(m)).active,false);
 }finally{globalThis.fetch=originalFetch;for(const k of Object.keys(process.env))if(!(k in saved))delete process.env[k];Object.assign(process.env,saved);await rm(dir,{recursive:true,force:true})}
});
test('PayPal uses USD order/capture flow, ownership, merchant checks, refunds and no duplicate capture grant',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'tl-maker-usd-')),saved={...process.env},originalFetch=globalThis.fetch;for(const k of ['DATABASE_URL','POSTGRES_URL','VERCEL','BLOB_READ_WRITE_TOKEN'])delete process.env[k];Object.assign(process.env,{LOCAL_DATA_DIR:dir,PAYPAL_ENVIRONMENT:'sandbox',PAYPAL_CLIENT_ID:'test',PAYPAL_CLIENT_SECRET:'test',PAYPAL_MERCHANT_ID:'merchant-test',PAYPAL_WEBHOOK_ID:'WH-TEST',SITE_URL:'https://www.tiolira.com.br'});
 let remote,capture,created=0,captured=0;
 globalThis.fetch=async(url,o={})=>{const u=new URL(url);let d;
 if(u.pathname==='/v1/oauth2/token')d={access_token:'test-token',expires_in:60};
 else if(u.pathname==='/v2/checkout/orders'){created++;const b=JSON.parse(o.body);assert.equal(b.purchase_units[0].amount.currency_code,'USD');assert.equal(b.purchase_units[0].amount.value,'8.32');remote={...b,id:'TESTORDER12345',status:'PAYER_ACTION_REQUIRED',links:[{rel:'payer-action',href:'https://www.sandbox.paypal.com/checkoutnow?token=TESTORDER12345'}]};d=remote;}
 else if(u.pathname==='/v2/checkout/orders/TESTORDER12345/capture'){captured++;capture={id:'CAPTURE12345',status:'COMPLETED',amount:{currency_code:'USD',value:'8.32'}};remote.status='COMPLETED';remote.purchase_units[0].payments={captures:[capture]};d=remote;}
 else if(u.pathname==='/v2/checkout/orders/TESTORDER12345')d=remote;
 else if(u.pathname==='/v2/payments/captures/CAPTURE12345')d=capture;
 else throw Error('Unexpected '+url);return {ok:true,status:200,json:async()=>structuredClone(d)};};
 const member={id:'us-buyer',countryCode:'US',name:'Test',email:'test@example.invalid'},input={consent:true,termsVersion:MAKER_VERSION,billingType:'PIX',provider:'asaas',lang:'en'};
 try{await startSubscription(member,input);assert.equal(created,1);let row=(await makerPurchases(member.id))[0];assert.equal((await subscriptionDashboard(member)).active,false);const bad=structuredClone(remote);bad.purchase_units[0].payee.merchant_id='wrong';await assert.rejects(()=>applyMakerPaypal(row.id,bad));remote.status='APPROVED';await refreshMakerPurchase(member,row.id);assert.equal(captured,1);assert.equal((await subscriptionDashboard(member)).active,true);const expiry=(await annualLicense(member)).validUntil;await refreshMakerPurchase(member,row.id);assert.equal(captured,1);assert.equal((await annualLicense(member)).validUntil,expiry);await makerPaypalPurchaseEvent({event_type:'PAYMENT.CAPTURE.REVERSED',resource:{id:'CAPTURE12345'}});assert.equal((await subscriptionDashboard(member)).active,false);await applyMakerPaypal(row.id,remote);assert.equal((await subscriptionDashboard(member)).active,false);}finally{globalThis.fetch=originalFetch;for(const k of Object.keys(process.env))if(!(k in saved))delete process.env[k];Object.assign(process.env,saved);await rm(dir,{recursive:true,force:true})}
});
