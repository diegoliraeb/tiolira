import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {readRecord,writeRecord,updateRecord} from '../server/store.mjs';
import {queuePurchaseEmailResend,runPurchaseEmailResends} from '../server/purchase-email-resends.mjs';
test('explicit resends preserve original mail, localize, and retry without duplicate delivery',async()=>{
 const keys=['DATABASE_URL','POSTGRES_URL','VERCEL','VERCEL_ENV','BLOB_READ_WRITE_TOKEN','LOCAL_DATA_DIR','ASAAS_ENVIRONMENT','RESEND_API_KEY','EMAIL_FROM','SITE_URL'];
 const env=Object.fromEntries(keys.map(k=>[k,process.env[k]])),fetchBefore=globalThis.fetch,dir=await mkdtemp(join(tmpdir(),'mail-resends-'));
 keys.forEach(k=>delete process.env[k]);Object.assign(process.env,{LOCAL_DATA_DIR:dir,ASAAS_ENVIRONMENT:'sandbox',RESEND_API_KEY:'test',EMAIL_FROM:'Tio Lira <test@example.invalid>',SITE_URL:'https://www.tiolira.com.br'});
 const original={status:'sent',providerId:'original-pt'},order={id:'paid-order',status:'paid',environment:'sandbox',memberName:'Carlos',memberEmail:'carlos@example.invalid',items:[{name:'Obra'}],purchaseEmail:original};
 let calls=0;const payloads=[];
 globalThis.fetch=async(url,opts)=>{assert.equal(url,'https://api.resend.com/emails');calls++;payloads.push(opts);if(calls===1)throw Error('timeout');return {ok:true,json:async()=>({id:'spanish-email'})};};
 try{
  await writeRecord('commerce.json',{orders:[order]},null);
  assert.deepEqual(await runPurchaseEmailResends(),{sent:0});assert.equal(calls,0);
  await assert.rejects(()=>queuePurchaseEmailResend({orderId:order.id,requestId:'authorized-01',language:'xx',reason:'Requested'}));
  const request={orderId:order.id,requestId:'authorized-01',language:'es',reason:'Customer language correction explicitly requested'};
  await queuePurchaseEmailResend(request);await queuePurchaseEmailResend(request);
  await runPurchaseEmailResends();process.env.EMAIL_FROM='Changed <changed@example.invalid>';await runPurchaseEmailResends();await runPurchaseEmailResends();
  assert.equal(calls,2);assert.equal(payloads[0].body,payloads[1].body);assert.equal(payloads[0].headers['Idempotency-Key'],payloads[1].headers['Idempotency-Key']);
  const mail=JSON.parse(payloads[1].body);assert.deepEqual(mail.to,['carlos@example.invalid']);assert.match(mail.subject,/Pago confirmado/);assert.match(mail.text,/\/es\/clube/);assert.match(mail.text,/licencia de venta/);
  assert.deepEqual((await readRecord('commerce.json')).data.orders[0].purchaseEmail,original);
  assert.equal((await readRecord('purchase-email-resends.json')).data.jobs[request.requestId].providerId,'spanish-email');
  await queuePurchaseEmailResend({...request,requestId:'authorized-02'});await updateRecord('commerce.json',s=>{s.orders[0].status='revoked';return s;});await runPurchaseEmailResends();assert.equal(calls,2);
  await assert.rejects(()=>queuePurchaseEmailResend({...request,requestId:'authorized-03'}));
  await updateRecord('commerce.json',s=>{s.orders[0].status='paid';return s;});await queuePurchaseEmailResend({...request,requestId:'authorized-03'});
  await updateRecord('purchase-email-resends.json',s=>{s.jobs['authorized-03'].firstAttemptAt=new Date(Date.now()-24*3600000).toISOString();return s;});await runPurchaseEmailResends();assert.equal(calls,2);assert.equal((await readRecord('purchase-email-resends.json')).data.jobs['authorized-03'].status,'review');
 }finally{globalThis.fetch=fetchBefore;for(const k of keys){if(env[k]===undefined)delete process.env[k];else process.env[k]=env[k];}await rm(dir,{recursive:true,force:true});}
});
