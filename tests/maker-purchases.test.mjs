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
test('PIX/card one-off payments: concurrency, amount/customer validation, PDF, replay, refunds, renewal and notices',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'tl-maker-buy-')),saved={...process.env},originalFetch=globalThis.fetch;
 for(const k of ['DATABASE_URL','POSTGRES_URL','VERCEL','BLOB_READ_WRITE_TOKEN'])delete process.env[k];
 Object.assign(process.env,{LOCAL_DATA_DIR:dir,ASAAS_ENVIRONMENT:'sandbox',ASAAS_API_KEY:'test-only',ASAAS_WEBHOOK_TOKEN:'test-token-32-characters-long-value',SITE_URL:'https://www.tiolira.com.br',RESEND_API_KEY:'test-only',EMAIL_FROM:'Test <test@example.invalid>'});
 const m={id:'buyer',name:'Test',email:'buyer@example.invalid',countryCode:'BR',cpfCnpj:'52998224725',whatsapp:'82999999999'},input={consent:true,termsVersion:MAKER_VERSION,billingType:'PIX',lang:'pt',priceCents:1,provider:'paypal'};let posts=0,mails=0,uncertain=false,last;const remote=new Map();
 globalThis.fetch=async(url,o={})=>{const u=new URL(url),body=o.body?JSON.parse(o.body):null;let d;
 if(u.pathname==='/v3/customers')d={data:[{id:'cus_1',externalReference:'tiolira:buyer',cpfCnpj:m.cpfCnpj}]};
 else if(u.pathname==='/v3/payments'&&o.method==='POST'){posts++;assert.equal(body.value,49.9);assert.ok(['PIX','CREDIT_CARD'].includes(body.billingType));assert.equal(body.subscription,undefined);last={...body,id:'pay_'+posts,status:'PENDING',invoiceUrl:'https://sandbox.asaas.com/i/test'};remote.set(last.id,last);if(uncertain)throw Error('lost response');d=last;}
 else if(u.pathname==='/v3/payments')d={data:[...remote.values()].filter(p=>p.externalReference===u.searchParams.get('externalReference'))};
 else if(u.pathname.startsWith('/v3/payments/'))d=remote.get(u.pathname.split('/').at(-1));
 else if(u.hostname==='api.resend.com'){mails++;assert.ok(o.headers['Idempotency-Key']);d={id:'email-1'};}
 else throw Error('Unexpected '+url);return {ok:true,status:200,json:async()=>structuredClone(d)};
 };
 try{
 await assert.rejects(()=>startSubscription(m,{...input,consent:false}));await assert.rejects(()=>startSubscription({...m,cpfCnpj:''},input));assert.equal(posts,0);
 const attempts=await Promise.allSettled([startSubscription(m,input),startSubscription(m,input)]);assert.ok(attempts.some(a=>a.status==='fulfilled'));assert.equal(posts,1);let row=(await makerPurchases(m.id))[0];assert.equal((await subscriptionDashboard(m)).active,false);await assert.rejects(()=>annualLicense(m),e=>e.status===403);
 await assert.rejects(()=>applyMakerAsaas(row.id,{...last,status:'RECEIVED',value:1}));await assert.rejects(()=>applyMakerAsaas(row.id,{...last,status:'RECEIVED',customer:'bad'}));await assert.rejects(()=>refreshMakerPurchase({id:'other'},row.id));
 last.status='RECEIVED';await refreshMakerPurchase(m,row.id);const license=await annualLicense(m);assert.equal(license.status,'active');assert.ok(license.validUntil);const catalog=(await getCatalog()).data;catalog.collections=[{id:'annual-test',published:true,free:false}];catalog.products=[{id:'annual-test',name:'Test model',collection:'annual-test',published:true,access:'maker',url:'https://makerworld.com/en/models/123456',priceCents:0}];const dashboard=await clubDashboard(m,catalog);assert.equal(dashboard.downloads[0].canLicense,true,'paid annual purchase enables commercial license buttons in club');const expiry=license.validUntil;await refreshMakerPurchase(m,row.id);assert.equal((await annualLicense(m)).validUntil,expiry);await assert.rejects(()=>startSubscription(m,input),/últimos 30 dias/);
 const near=new Date(Date.now()+5*86400000).toISOString();await updateRecord(PURCHASE_KEY,d=>{d.purchases[0].endsAt=near;return d});await writeRecord('club-members.json',{members:[m]},null);
 const report=await subscriptionReport();assert.equal(report.subscriptions[0].eligible,true);assert.equal(report.subscriptions[0].daysRemaining,5);assert.match(report.subscriptions[0].whatsappUrl,/wa.me\/5582999999999/);
 await sendRenewalNotice(m.id,'email');await sendRenewalNotice(m.id,'email');assert.equal(mails,1);assert.equal((await renewalReport()).subscriptions[0].notices[0].status,'sent');const wa=await sendRenewalNotice(m.id,'whatsapp');assert.equal(wa.status,'opened');
 await startSubscription(m,{...input,billingType:'CREDIT_CARD'});assert.equal(posts,2);row=(await makerPurchases(m.id)).at(-1);last.status='CONFIRMED';await refreshMakerPurchase(m,row.id);assert.equal((await annualLicense(m)).validUntil,yearAfter(near));assert.equal((await subscriptionReport()).subscriptions[0].eligible,false);
 last.status='REFUNDED';await refreshMakerPurchase(m,row.id);assert.equal((await annualLicense(m)).validUntil,near);last.status='CONFIRMED';await applyMakerAsaas(row.id,last);assert.equal((await makerPurchases(m.id)).at(-1).status,'revoked');
 await updateRecord(PURCHASE_KEY,d=>{d.purchases[0].status='revoked';return d});assert.equal((await subscriptionDashboard(m)).active,false);
 uncertain=true;await assert.rejects(()=>startSubscription(m,input));const before=posts;uncertain=false;await startSubscription(m,input);assert.equal(posts,before,'ambiguous creation reconciles without POST retry');
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
