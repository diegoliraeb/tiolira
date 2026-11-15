import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {writeRecord,readRecord,updateRecord} from '../server/store.mjs';
import {configureMakerPaypal,annualPaypalUrl} from '../server/maker-paypal.mjs';
import {startSubscription,refreshSubscription,cancelSubscription,annualLicense,subscriptionDashboard} from '../server/maker-subscriptions.mjs';
import {receivePaypalWebhook} from '../server/paypal-commerce.mjs';
import {MAKER_VERSION} from '../lib/maker-license.mjs';
test('PayPal annual plan, verified payment, shared ownership, cancellation and sticky refunds',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'tl-maker-paypal-')),saved={...process.env},fetchOriginal=globalThis.fetch;
 for(const k of ['DATABASE_URL','POSTGRES_URL','VERCEL','BLOB_READ_WRITE_TOKEN'])delete process.env[k];
 Object.assign(process.env,{LOCAL_DATA_DIR:dir,PAYPAL_ENVIRONMENT:'sandbox',PAYPAL_CLIENT_ID:'test-only',PAYPAL_CLIENT_SECRET:'test-only',PAYPAL_MERCHANT_ID:'test-merchant',PAYPAL_WEBHOOK_ID:'WH-TEST',SITE_URL:'https://www.tiolira.com.br',ASAAS_ENVIRONMENT:'sandbox',ASAAS_API_KEY:'test-only',ASAAS_WEBHOOK_TOKEN:'test-only-32-characters-long-key-value'});
 let plan,remote,tx=[],createCount=0,products=0,plans=0,signature='SUCCESS',planBad=false,timeout=false;
 let hook={id:'WH-TEST',url:'https://www.tiolira.com.br/api/webhooks/paypal',event_types:[{name:'PAYMENT.CAPTURE.COMPLETED'}]};
 globalThis.fetch=async(url,options={})=>{const u=new URL(url),b=options.body&&options.headers?.['Content-Type']==='application/json'?JSON.parse(options.body):null;let out;
 if(u.pathname==='/v1/oauth2/token')out={access_token:'test-token'};
 else if(u.pathname==='/v1/catalogs/products'){products++;assert.equal(b.type,'SERVICE');out={id:'PROD-TEST'};}
 else if(u.pathname==='/v1/billing/plans'){plans++;assert.equal(b.billing_cycles[0].frequency.interval_unit,'YEAR');assert.equal(b.billing_cycles[0].pricing_scheme.fixed_price.value,'49.90');plan={...b,id:'P-TEST'};out=plan;}
 else if(u.pathname==='/v1/billing/plans/P-TEST'){out=structuredClone(plan);if(planBad)out.billing_cycles[0].frequency.interval_unit='MONTH';}
 else if(u.pathname==='/v1/notifications/webhooks/WH-TEST'){if(options.method==='PATCH'){assert.ok(b[0].value.some(e=>e.name==='PAYMENT.CAPTURE.COMPLETED'),'preserve purchase events');hook.event_types=b[0].value;}out=hook;}
 else if(u.pathname==='/v1/notifications/verify-webhook-signature')out={verification_status:signature};
 else if(u.pathname==='/v1/billing/subscriptions'){createCount++;if(timeout)throw Error('lost response');assert.equal(b.plan_id,'P-TEST');assert.equal(b.application_context.user_action,'SUBSCRIBE_NOW');assert.equal(b.application_context.shipping_preference,'NO_SHIPPING');remote={...b,id:'I-TEST',status:'APPROVAL_PENDING',links:[{rel:'approve',href:'https://www.sandbox.paypal.com/webapps/billing/subscriptions?ba_token=TEST'}]};out=remote;}
 else if(u.pathname==='/v1/billing/subscriptions/I-TEST')out=remote;
 else if(u.pathname==='/v1/billing/subscriptions/I-TEST/transactions')out={transactions:tx,total_pages:1};
 else if(u.pathname==='/v1/billing/subscriptions/I-TEST/cancel'){remote.status='CANCELLED';return {ok:true,status:204,json:async()=>{throw Error('empty')}};}
 else throw Error('Unexpected '+u.pathname);
 return {ok:true,status:200,json:async()=>structuredClone(out)};
 };
 const member={id:'a',name:'Test',email:'test@example.invalid'},other={id:'b',name:'Other',email:'other@example.invalid'},input={provider:'paypal',consent:true,termsVersion:MAKER_VERSION};
 const headers=Object.fromEntries(['auth-algo','cert-url','transmission-id','transmission-sig','transmission-time'].map(k=>['paypal-'+k,'test']));
 const event=(type,resource)=>receivePaypalWebhook(headers,JSON.stringify({id:'evt-'+type,event_type:type,resource}));
 try{
  await configureMakerPaypal();await configureMakerPaypal();assert.equal(products,1);assert.equal(plans,1);
  assert.equal((await subscriptionDashboard(member)).providers.paypal,true);
  await updateRecord('maker-subscriptions.json',d=>({...d,webhookEnvironment:'sandbox'}));
  const result=await Promise.allSettled([startSubscription(member,input),startSubscription(member,input)]);assert.equal(createCount,1);assert.ok(result.some(r=>r.status==='fulfilled'));
  assert.equal((await startSubscription(member,{...input,provider:'asaas'})).provider,'paypal','switching provider resumes the existing subscription');
  assert.equal((await refreshSubscription(member)).active,false);remote.status='ACTIVE';assert.equal((await refreshSubscription(member)).active,false,'approval alone is not payment');
  const time=new Date().toISOString();tx=[{id:'SALE1',status:'COMPLETED',time,amount_with_breakdown:{gross_amount:{value:'49.90',currency_code:'USD'}}}];
  await assert.rejects(()=>refreshSubscription(member),/Valor/);tx[0].amount_with_breakdown.gross_amount.currency_code='BRL';
  const custom=remote.custom_id;remote.custom_id='someone-else';await assert.rejects(()=>refreshSubscription(member),/parceiro/);remote.custom_id=custom;
  planBad=true;await assert.rejects(()=>refreshSubscription(member),/Plano/);planBad=false;
  const active=await refreshSubscription(member);assert.equal(active.active,true);assert.equal(active.provider,'paypal');assert.ok((await annualLicense(member)).validUntil);await assert.rejects(()=>annualLicense(other),e=>e.status===403);
  const until=active.validUntil;await event('PAYMENT.SALE.COMPLETED',{id:'SALE1',billing_agreement_id:'I-TEST'});assert.equal((await refreshSubscription(member)).validUntil,until);
  signature='FAILURE';await assert.rejects(()=>event('PAYMENT.SALE.REFUNDED',{sale_id:'SALE1'}),e=>e.status===401);signature='SUCCESS';assert.equal((await refreshSubscription(member)).active,true);
  const cancelled=await cancelSubscription(member);assert.equal(cancelled.active,true);assert.equal(cancelled.autoRenew,false);
  await event('PAYMENT.SALE.REFUNDED',{id:'REFUND1',sale_id:'SALE1'});assert.equal((await refreshSubscription(member)).active,false,'refund sticky despite stale completed transaction');
  process.env.PAYPAL_ENVIRONMENT='production';assert.equal((await refreshSubscription(member)).active,false);process.env.PAYPAL_ENVIRONMENT='sandbox';
  timeout=true;await assert.rejects(()=>startSubscription(other,input));const calls=createCount;await assert.rejects(()=>startSubscription(other,input));assert.equal(createCount,calls);
  assert.equal(annualPaypalUrl('https://www.paypal.com.evil.test/webapps/billing/subscriptions?ba_token=x','production'),'');
  assert.equal(annualPaypalUrl('https://www.sandbox.paypal.com/webapps/billing/subscriptions?ba_token=x','production'),'');
 }finally{globalThis.fetch=fetchOriginal;for(const k of Object.keys(process.env))if(!(k in saved))delete process.env[k];Object.assign(process.env,saved);await rm(dir,{recursive:true,force:true})}
});
