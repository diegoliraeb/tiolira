import test from 'node:test';
import assert from 'node:assert/strict';
import {validBillingDocument,BILLING_DOCUMENT_ERROR} from '../lib/billing-document.mjs';
import {shopApi} from '../lib/shop-api.mjs';
import {asaas} from '../server/asaas.mjs';

test('billing document validates both check digits and accepts formatting',()=>{
 for(const value of ['52998224725','529.982.247-25','11222333000181','11.222.333/0001-81'])assert.equal(validBillingDocument(value),true,value);
 for(const value of ['',null,'123','12345678901','12345678000199','52998224724','52998224715','00000000000','11111111111111','529a98224725'])assert.equal(validBillingDocument(value),false,String(value));
});

test('checkout request releases a stalled fetch and never repeats the POST',async()=>{
 let calls=0,signal;
 await assert.rejects(shopApi('club/checkout',{requestId:'same-intent'},{timeoutMs:10,fetcher:async(_,options)=>{calls++;signal=options.signal;return new Promise(()=>{});}}),e=>e.uncertain===true&&/demorou/.test(e.message));
 assert.equal(calls,1);assert.equal(signal.aborted,true);
});

test('checkout request also bounds a stalled response body',async()=>{
 await assert.rejects(shopApi('club/checkout',{}, {timeoutMs:10,fetcher:async()=>({ok:true,json:()=>new Promise(()=>{})})}),e=>e.uncertain===true);
});

test('definitive validation errors and uncertain responses remain distinguishable',async()=>{
 await assert.rejects(shopApi('club/checkout',{}, {fetcher:async()=>({ok:false,status:400,json:async()=>({error:BILLING_DOCUMENT_ERROR,code:'BILLING_DOCUMENT_INVALID',uncertain:false})})}),e=>e.uncertain===false&&e.code==='BILLING_DOCUMENT_INVALID'&&e.message===BILLING_DOCUMENT_ERROR);
 for(const fetcher of [async()=>{throw Error('network');},async()=>({ok:false,status:502,json:async()=>{throw Error('HTML gateway error');}})])await assert.rejects(shopApi('club/checkout',{}, {fetcher}),e=>e.uncertain===true);
 assert.deepEqual(await shopApi('club/checkout',{}, {fetcher:async()=>({ok:true,json:async()=>({order:{id:'existing'}})})}),{order:{id:'existing'}});
});

test('Asaas document rejection becomes actionable without exposing provider data',async()=>{
 const originalFetch=globalThis.fetch,keys=['ASAAS_ENVIRONMENT','ASAAS_API_KEY','ASAAS_WEBHOOK_TOKEN'],env=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
 Object.assign(process.env,{ASAAS_ENVIRONMENT:'sandbox',ASAAS_API_KEY:'test-only',ASAAS_WEBHOOK_TOKEN:'test-only-webhook-token-at-least-32-characters'});
 try{
  globalThis.fetch=async()=>({ok:false,status:400,json:async()=>({errors:[{code:'invalid_object',description:'O CPF/CNPJ informado é inválido.'}]})});
  await assert.rejects(asaas('/customers',{method:'POST',body:{}}),e=>e.status===400&&e.uncertain===false&&e.code==='BILLING_DOCUMENT_INVALID'&&e.message===BILLING_DOCUMENT_ERROR);
  globalThis.fetch=async()=>({ok:false,status:400,json:async()=>({errors:[{code:'invalid_object',description:'Private provider detail'}]})});
  await assert.rejects(asaas('/customers',{method:'POST',body:{}}),e=>e.status===502&&e.uncertain===false&&!e.message.includes('Private'));
 }finally{globalThis.fetch=originalFetch;for(const k of keys)if(env[k]===undefined)delete process.env[k];else process.env[k]=env[k];}
});
