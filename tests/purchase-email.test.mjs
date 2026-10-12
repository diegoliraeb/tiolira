import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {purchaseApprovedEmail,sendPurchaseEmail} from '../server/purchase-email.mjs';
import {applyPayment,receiveWebhook,shop} from '../server/commerce.mjs';
import {readRecord,writeRecord,updateRecord} from '../server/store.mjs';

test('approved email has a safe account link, escaped content and both download instructions',()=>{
 const email=purchaseApprovedEmail({id:'123',memberName:'<script>alert(1)</script>',items:[{name:'Curupira & Cuca'}]},'https://www.tiolira.com.br');
 assert.ok(email.subject.includes('Pagamento aprovado'));
 assert.ok(email.html.includes('&lt;script&gt;'));assert.ok(!email.html.includes('<script>'));
 assert.ok(email.html.includes('Curupira &amp; Cuca'));
 assert.ok(email.text.includes('https://www.tiolira.com.br/pt/clube?pedido=123#compras'));
 assert.ok(email.html.includes('Acessar meus arquivos e licença'));assert.ok(email.text.includes('licença de venda em PDF'));
 assert.ok(!email.html.includes('/api/download'));assert.throws(()=>purchaseApprovedEmail({items:[]},'http://untrusted.invalid'));
});

test('payment mail is persisted, retryable and sent once per purchase',async t=>{
 const keys=['DATABASE_URL','POSTGRES_URL','VERCEL','BLOB_READ_WRITE_TOKEN','LOCAL_DATA_DIR','ASAAS_ENVIRONMENT','ASAAS_API_KEY','ASAAS_WEBHOOK_TOKEN','RESEND_API_KEY','EMAIL_FROM','SITE_URL'];
 const env=Object.fromEntries(keys.map(k=>[k,process.env[k]])),originalFetch=globalThis.fetch,dir=await mkdtemp(join(tmpdir(),'tiolira-mail-'));
 keys.forEach(k=>delete process.env[k]);Object.assign(process.env,{LOCAL_DATA_DIR:dir,ASAAS_ENVIRONMENT:'sandbox',ASAAS_API_KEY:'test-only',ASAAS_WEBHOOK_TOKEN:'test-webhook-at-least-32-characters',RESEND_API_KEY:'test-email-key',EMAIL_FROM:'Tio Lira <test@example.invalid>',SITE_URL:'https://www.tiolira.com.br'});
 const id=randomUUID(),order={id,memberId:'buyer',memberName:'Parceiro Teste',memberEmail:'buyer@example.invalid',status:'pending',environment:'sandbox',customerId:'cus_test',totalCents:4990,productIds:['saci','cuca'],items:[{name:'Folclore',products:[{id:'saci',name:'Saci'},{id:'cuca',name:'Cuca'}]}]},payment={id:'pay_test',externalReference:id,customer:'cus_test',status:'CONFIRMED',value:49.9};
 let requests=0,deliveries=0,failOnce=true;const deliveriesByKey=new Map();
 globalThis.fetch=async(url,options)=>{
  if(String(url).startsWith('https://api-sandbox.asaas.com'))return {ok:true,json:async()=>payment};
  assert.equal(url,'https://api.resend.com/emails');requests++;
  if(failOnce){failOnce=false;throw Error('temporary timeout');}
  const key=options.headers['Idempotency-Key'],body=options.body;
  if(deliveriesByKey.has(key))assert.equal(deliveriesByKey.get(key),body);else{deliveriesByKey.set(key,body);deliveries++;}
  return {ok:true,json:async()=>({id:'email-accepted'})};
 };
 try{
  await writeRecord('commerce.json',{orders:[order]},null);
  const event={id:'evt-confirmed',event:'PAYMENT_CONFIRMED',payment:{id:payment.id,externalReference:id}};
  await t.test('mail failure keeps payment approved and queued, duplicate event retries',async()=>{
   await receiveWebhook(event); // Main payment queue must acknowledge even when email fails.
   failOnce=true;await assert.rejects(()=>receiveWebhook(event,{emailRequired:true}),/aguardando envio/);
   const o=(await readRecord('commerce.json')).data.orders[0];assert.equal(o.status,'paid');assert.equal(o.licenses.length,2);assert.equal(o.purchaseEmail.status,'pending');assert.deepEqual(o.events,[event.id]);
   process.env.EMAIL_FROM='Changed <different@example.invalid>'; // persisted payload survives config/deploy changes
   await receiveWebhook(event,{emailRequired:true});assert.equal(deliveries,1);assert.ok([...deliveriesByKey.values()][0].includes('test@example.invalid'));
   await receiveWebhook(event,{emailRequired:true});await applyPayment(id,payment);await sendPurchaseEmail(id);assert.equal(requests,3);
   assert.equal((await readRecord('commerce.json')).data.orders[0].purchaseEmail.status,'sent');
   assert.ok(!JSON.stringify(await shop({id:'buyer'})).includes('purchaseEmail'));assert.ok(!JSON.stringify(await shop({id:'buyer'})).includes('buyer@example.invalid'));
  });
  await t.test('parallel retries reuse provider key and payload',async()=>{
   await updateRecord('commerce.json',s=>{s.orders[0].purchaseEmail.status='pending';return s});
   await Promise.all([sendPurchaseEmail(id),sendPurchaseEmail(id)]);assert.equal(deliveries,1);
  });
  await t.test('revoked and wrong-environment purchases never send',async()=>{
   const before=requests;
   await updateRecord('commerce.json',s=>{s.orders[0].purchaseEmail.status='pending';s.orders[0].status='revoked';return s});await sendPurchaseEmail(id);assert.equal(requests,before);
   await updateRecord('commerce.json',s=>{s.orders[0].status='paid';return s});process.env.ASAAS_ENVIRONMENT='production';await sendPurchaseEmail(id);assert.equal(requests,before);process.env.ASAAS_ENVIRONMENT='sandbox';
  });
  await t.test('expired ambiguous attempt requires review rather than duplicate delivery',async()=>{
   const before=requests;await updateRecord('commerce.json',s=>{s.orders[0].purchaseEmail.firstAttemptAt=new Date(Date.now()-24*3600000).toISOString();return s});
   await assert.rejects(()=>sendPurchaseEmail(id));assert.equal(requests,before);assert.equal((await readRecord('commerce.json')).data.orders[0].purchaseEmail.status,'review');
  });
  await t.test('old paid orders are not emailed retroactively',async()=>{
   await updateRecord('commerce.json',s=>{delete s.orders[0].purchaseEmail;return s});const before=requests;await applyPayment(id,payment);await sendPurchaseEmail(id);assert.equal(requests,before);assert.equal((await readRecord('commerce.json')).data.orders[0].purchaseEmail,undefined);
  });
 }finally{globalThis.fetch=originalFetch;for(const key of keys){if(env[key]===undefined)delete process.env[key];else process.env[key]=env[key];}await rm(dir,{recursive:true,force:true});}
});
