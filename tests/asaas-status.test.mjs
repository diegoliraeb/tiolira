import test from 'node:test';
import assert from 'node:assert/strict';
import {configurePurchaseEmailWebhook,checkAsaasConnection} from '../server/asaas.mjs';

test('connection check reads Asaas without charges or leaking provider secrets',async()=>{
 const originalFetch=globalThis.fetch,keys=['ASAAS_API_KEY','ASAAS_WEBHOOK_TOKEN','ASAAS_ENVIRONMENT'];
 const env=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
 const token='test-only-webhook-token-at-least-32-characters',url='https://shop.example/api/webhooks/asaas';
 let webhook={url,enabled:true,interrupted:false,authToken:token,events:['PAYMENT_CONFIRMED','PAYMENT_RECEIVED','PAYMENT_REFUNDED','PAYMENT_PARTIALLY_REFUNDED','PAYMENT_CHARGEBACK_REQUESTED']},calls=0;
 Object.assign(process.env,{ASAAS_API_KEY:'test-only-key',ASAAS_WEBHOOK_TOKEN:token,ASAAS_ENVIRONMENT:'sandbox'});
 globalThis.fetch=async(endpoint,options)=>{calls++;assert.equal(endpoint,'https://api-sandbox.asaas.com/v3/webhooks?limit=100');assert.equal(options.method,'GET');assert.equal(options.body,undefined);return {ok:true,json:async()=>({data:[webhook]})}};
 try{
  let result=await checkAsaasConnection(url);assert.equal(result.connected,true);assert.equal(result.tokenMatches,true);assert.equal(result.eventsReady,true);assert.equal(JSON.stringify(result).includes(token),false);
  webhook={...webhook,authToken:'wrong',enabled:false,interrupted:true,events:[]};result=await checkAsaasConnection(url);assert.equal(result.tokenMatches,false);assert.equal(result.webhookEnabled,false);assert.equal(result.queueActive,false);assert.equal(result.eventsReady,false);
  assert.equal((await checkAsaasConnection('https://other.example/api/webhooks/asaas')).webhookFound,false);
  webhook.authToken=undefined;assert.equal((await checkAsaasConnection(url)).tokenMatches,null);
  delete process.env.ASAAS_API_KEY;assert.equal((await checkAsaasConnection(url)).configured,false);assert.equal(calls,4);
 }finally{globalThis.fetch=originalFetch;for(const k of keys){if(env[k]===undefined)delete process.env[k];else process.env[k]=env[k]}}
});


test('email notifications use a separate idempotently configured webhook without exposing secrets',async()=>{
 const keys=['ASAAS_API_KEY','ASAAS_WEBHOOK_TOKEN','ASAAS_ENVIRONMENT','RESEND_API_KEY','EMAIL_FROM','SITE_URL'],env=Object.fromEntries(keys.map(k=>[k,process.env[k]])),originalFetch=globalThis.fetch;
 const token='private-test-token-with-at-least-32-chars',origin='https://www.tiolira.com.br';let extra,posts=0,puts=0;
 Object.assign(process.env,{ASAAS_API_KEY:'test',ASAAS_WEBHOOK_TOKEN:token,ASAAS_ENVIRONMENT:'sandbox',RESEND_API_KEY:'test',EMAIL_FROM:'test@example.invalid',SITE_URL:origin});
 globalThis.fetch=async(url,options)=>{
  if(options.method==='GET')return {ok:true,json:async()=>({data:[{url:origin+'/api/webhooks/asaas',email:'owner@example.invalid'},...(extra?[extra]:[])]})};
  const body=JSON.parse(options.body);assert.equal(body.url,origin+'/api/webhooks/purchase-email');assert.equal(body.authToken,token);assert.equal(body.sendType,'NON_SEQUENTIALLY');assert.deepEqual(body.events,['PAYMENT_CONFIRMED','PAYMENT_RECEIVED']);
  if(options.method==='POST')posts++;else{assert.equal(options.method,'PUT');assert.ok(url.endsWith('/webhooks/email-test'));puts++;}
  extra={...body,id:'email-test'};return {ok:true,json:async()=>extra};
 };
 try{assert.deepEqual(await configurePurchaseEmailWebhook(),{ready:true});assert.deepEqual(await configurePurchaseEmailWebhook(),{ready:true});assert.equal(posts,1);assert.equal(puts,1);}finally{globalThis.fetch=originalFetch;for(const k of keys){if(env[k]===undefined)delete process.env[k];else process.env[k]=env[k];}}
});
