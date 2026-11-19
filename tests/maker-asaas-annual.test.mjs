import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {readRecord,writeRecord,updateRecord} from '../server/store.mjs';
import {startSubscription,refreshSubscription,subscriptionDashboard,annualLicense,cancelSubscription,subscriptionWebhook} from '../server/maker-subscriptions.mjs';
import {makerPurchases,PURCHASE_KEY} from '../server/maker-purchases.mjs';
import {migrateAnnual,annualMigrationPreview,applyAnnualPayment,renewalDate} from '../server/maker-asaas-annual.mjs';
import {MAKER_VERSION,yearAfter} from '../lib/maker-license.mjs';
import {annualAsaasTerms} from '../lib/maker-annual-copy.mjs';
test('annual terms in all languages replace one-off billing without removing license exceptions',()=>{
 for(const text of Object.values(annualAsaasTerms)){assert.match(text,/Asaas/);assert.match(text,/Senna/);assert.match(text,/PIX/);assert.doesNotMatch(text,/sem cobrança automática|no automatic charge|sin cobro automático|sans prélèvement automatique|nova compra|new purchase|nueva compra|nouvel achat/);}
 assert.equal(renewalDate('2027-11-16T14:15:22Z'),'2027-11-17');assert.equal(renewalDate('2027-11-16T03:00:00Z'),'2027-11-16');
});
test('native annual Asaas: concurrent creation, safe recovery, ownership, settlement replay, refunds, cancellation and paid migration',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'tl-annual-')),saved={...process.env},original=globalThis.fetch;
 for(const k of ['DATABASE_URL','POSTGRES_URL','VERCEL','BLOB_READ_WRITE_TOKEN'])delete process.env[k];Object.assign(process.env,{LOCAL_DATA_DIR:dir,ASAAS_ENVIRONMENT:'sandbox',ASAAS_API_KEY:'test-only',ASAAS_WEBHOOK_TOKEN:'test-token-32-characters-long-value',SITE_URL:'https://www.tiolira.com.br'});
 const member=id=>({id,name:'Test '+id,email:id+'@example.invalid',countryCode:'BR',cpfCnpj:'52998224725'}),input={consent:true,termsVersion:MAKER_VERSION,billingType:'PIX',lang:'pt'};
 let posts=0,lost=false;const subs=new Map(),payments=new Map(),bodies=[];
 globalThis.fetch=async(url,o={})=>{const u=new URL(url),b=o.body?JSON.parse(o.body):null;let d;
 if(u.pathname==='/v3/customers'){const ref=u.searchParams.get('externalReference');d={data:[{id:'cus_'+ref.split(':')[1],externalReference:ref,cpfCnpj:'52998224725'}]};}
 else if(u.pathname==='/v3/subscriptions'&&o.method==='POST'){posts++;bodies.push(b);assert.equal(b.cycle,'YEARLY');assert.equal(b.value,49.9);assert.match(b.description,/Assinatura anual/);if(b.billingType==='PIX')assert.equal(b.pixAutomaticAuthorizationMode,'DISABLED');const s={...b,id:'sub_'+posts,status:'ACTIVE'};subs.set(s.id,s);payments.set('pay_'+posts,{id:'pay_'+posts,subscription:s.id,externalReference:s.externalReference,customer:s.customer,value:s.value,billingType:s.billingType,dueDate:s.nextDueDate,status:'PENDING',invoiceUrl:'https://sandbox.asaas.com/i/test'});if(lost)throw Error('response lost');d=s;}
 else if(u.pathname==='/v3/subscriptions'){d={data:[...subs.values()].filter(s=>(!u.searchParams.has('externalReference')||s.externalReference===u.searchParams.get('externalReference'))&&(!u.searchParams.has('customer')||s.customer===u.searchParams.get('customer')))};}
 else if(/^\/v3\/subscriptions\/sub_\d+\/payments$/.test(u.pathname)){d={data:[...payments.values()].filter(p=>p.subscription===u.pathname.split('/')[3])};}
 else if(/^\/v3\/subscriptions\/sub_\d+$/.test(u.pathname)){const s=subs.get(u.pathname.split('/').at(-1));if(o.method==='DELETE'){s.deleted=true;for(const p of payments.values())if(p.subscription===s.id&&!['RECEIVED','CONFIRMED'].includes(p.status))p.deleted=true;}d=s;}
 else if(u.pathname.startsWith('/v3/payments/'))d=payments.get(u.pathname.split('/').at(-1));
 else throw Error('Unexpected request '+url);return {ok:true,status:200,json:async()=>structuredClone(d)};};
 try{
 const m=member('new');await assert.rejects(()=>startSubscription(m,{...input,consent:false}));await assert.rejects(()=>startSubscription({...m,cpfCnpj:''},input));assert.equal(posts,0);
 const results=await Promise.allSettled([startSubscription(m,input),startSubscription(m,input)]);assert.ok(results.some(r=>r.status==='fulfilled'));assert.equal(posts,1);let d=await subscriptionDashboard(m);assert.equal(d.active,false);assert.equal(d.recurring.state,'active');assert.ok(d.purchase.paymentUrl);await assert.rejects(()=>annualLicense(m));
 const root=(await makerPurchases(m.id))[0],p=payments.get('pay_1');await assert.rejects(()=>applyAnnualPayment(root.id,{...p,value:1}));await assert.rejects(()=>applyAnnualPayment(root.id,{...p,customer:'cus_wrong'}));await assert.rejects(()=>applyAnnualPayment(root.id,{...p,subscription:'sub_wrong'}));
 p.status='RECEIVED';p.paymentDate=new Date().toISOString();await refreshSubscription(m);const expiry=(await annualLicense(m)).validUntil;await Promise.all([refreshSubscription(m),subscriptionWebhook({event:'PAYMENT_RECEIVED',payment:{id:p.id,subscription:p.subscription,value:1}})]);assert.equal((await annualLicense(m)).validUntil,expiry);assert.equal((await makerPurchases(m.id)).length,1);await startSubscription(m,input);assert.equal(posts,1);
 // A future annual invoice is not another purchase of the current period.
 const renewal={...p,id:'pay_renew',dueDate:renewalDate(expiry),status:'PENDING'};payments.set(renewal.id,renewal);await refreshSubscription(m);assert.equal((await annualLicense(m)).validUntil,expiry);
 renewal.status='RECEIVED';await refreshSubscription(m);assert.equal((await annualLicense(m)).validUntil,yearAfter(expiry));await refreshSubscription(m);assert.equal((await makerPurchases(m.id)).length,2);
 renewal.status='REFUNDED';await refreshSubscription(m);assert.equal((await annualLicense(m)).validUntil,expiry);renewal.status='RECEIVED';await refreshSubscription(m);assert.equal((await annualLicense(m)).validUntil,expiry);
 await cancelSubscription(m);assert.equal((await annualLicense(m)).validUntil,expiry);assert.equal((await subscriptionDashboard(m)).recurring,null);assert.equal(subs.get('sub_1').deleted,true);
 // Lost response is recovered by reference, never by repeating POST.
 lost=true;await assert.rejects(()=>startSubscription(member('lost'),{...input,billingType:'CREDIT_CARD'}));const n=posts;lost=false;await startSubscription(member('lost'),{...input,billingType:'CREDIT_CARD'});assert.equal(posts,n);assert.equal((await subscriptionDashboard(member('lost'))).recurring.autoRenew,true);
 // Migration keeps the old purchase byte-for-byte and creates only a future manual PIX schedule.
 const old=member('old'),validUntil=new Date(Date.now()+200*86400000).toISOString(),seed={id:'old-purchase',memberId:old.id,name:old.name,email:old.email,provider:'asaas',environment:'sandbox',currency:'BRL',totalCents:4990,status:'paid',billingType:'CREDIT_CARD',customerId:'cus_old',paymentId:'pay_old',createdAt:new Date(Date.now()-100*86400000).toISOString(),paidAt:new Date().toISOString(),startsAt:new Date(Date.now()-100*86400000).toISOString(),endsAt:validUntil,terms:'Original one-time terms'};
 await updateRecord(PURCHASE_KEY,d=>{d.purchases.push(seed);return d});payments.set('pay_old',{id:'pay_old',customer:'cus_old',externalReference:'tl-maker-purchase:old-purchase',billingType:'CREDIT_CARD',value:49.9,status:'RECEIVED'});
 assert.equal((await annualMigrationPreview()).candidates.find(x=>x.memberId===old.id).eligible,true);
 const before=posts;const migration=await migrateAnnual(old.id);assert.equal(posts,before+1);assert.equal(migration.annual.billingType,'PIX');assert.ok(Date.parse(migration.annual.firstDueDate+'T03:00:00Z')>=Date.parse(validUntil));assert.deepEqual((await makerPurchases(old.id)).find(x=>x.id===seed.id),seed);assert.equal((await annualLicense(old)).validUntil,validUntil);assert.equal((await subscriptionDashboard(old)).purchase,null,'future renewal invoice must not ask the paid member to pay now');assert.equal((await makerPurchases(old.id)).filter(r=>r.status==='pending').length,1,'Asaas can create the future invoice immediately');await migrateAnnual(old.id);assert.equal(posts,before+1);await startSubscription(old,input);assert.equal(posts,before+1);
 const migrated=(await makerPurchases(old.id)).find(x=>x.annual);await assert.rejects(()=>applyAnnualPayment(migrated.id,{id:'pay_bad',subscription:migrated.subscriptionId,customer:migrated.customerId,billingType:'PIX',value:49.9,dueDate:new Date().toISOString().slice(0,10),status:'RECEIVED'}));
 // Pending old checkout, unconfirmed payment and existing legacy recurrence are blocked.
 for(const [id,extra] of [['pending',{status:'pending'}],['legacy',{}],['unpaid',{}]]){await updateRecord(PURCHASE_KEY,d=>{d.purchases.push({...seed,id:'seed_'+id,memberId:id,customerId:'cus_'+id,paymentId:'pay_'+id,...extra});return d});payments.set('pay_'+id,{id:'pay_'+id,customer:'cus_'+id,externalReference:'tl-maker-purchase:seed_'+id,billingType:'CREDIT_CARD',value:49.9,status:id==='unpaid'?'PENDING':'RECEIVED'});}
 await writeRecord('maker-subscriptions.json',{subscriptions:[{id:'legacy',memberId:'legacy',environment:'sandbox',status:'subscribed',subscriptionId:'sub_legacy'}]},null);
 const count=posts;for(const id of ['pending','legacy','unpaid'])await assert.rejects(()=>migrateAnnual(id));assert.equal(posts,count);
 }finally{globalThis.fetch=original;for(const k of Object.keys(process.env))if(!(k in saved))delete process.env[k];Object.assign(process.env,saved);await rm(dir,{recursive:true,force:true});}
});
