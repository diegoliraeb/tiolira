import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {writeRecord} from '../server/store.mjs';
import {renewalReport,sendRenewalNotice,checkoutRecoveryMessage} from '../server/maker-renewals.mjs';
test('checkout correction sends only for failed legacy buyers, once per email, and excludes new purchases',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'tl-recovery-')),saved={...process.env},oldFetch=globalThis.fetch;let sent=0;
 for(const k of ['DATABASE_URL','POSTGRES_URL','VERCEL','BLOB_READ_WRITE_TOKEN'])delete process.env[k];
 Object.assign(process.env,{LOCAL_DATA_DIR:dir,ASAAS_ENVIRONMENT:'sandbox',SITE_URL:'https://www.tiolira.com.br',RESEND_API_KEY:'test-only',EMAIL_FROM:'Test <test@example.invalid>'});
 const legacy={subscriptions:[{memberId:'failed',name:'Cliente',email:'client@example.invalid',provider:'asaas',status:'failed',active:false,autoRenew:false},{memberId:'paid',name:'Paid',email:'paid@example.invalid',status:'subscribed',active:true,autoRenew:true},{memberId:'none',name:'No',email:'none@example.invalid',status:'none'}]};
 globalThis.fetch=async(url,options)=>{assert.equal(url,'https://api.resend.com/emails');const body=JSON.parse(options.body);assert.deepEqual(body.to,['client@example.invalid']);assert.match(body.text,/https:\/\/www.tiolira.com.br\/pt\/clube#assinatura/);assert.match(body.text,/corrigimos/);assert.ok(options.headers['Idempotency-Key']);sent++;return {ok:true,json:async()=>({id:'test-email'})}};
 try{
 assert.match(checkoutRecoveryMessage('Cliente','https://www.tiolira.com.br').text,/mesmo e-mail/);
 let report=await renewalReport(legacy);assert.equal(report.subscriptions.find(r=>r.memberId==='failed').recoveryEligible,true);
 for(const id of ['paid','none','unknown'])await assert.rejects(()=>sendRenewalNotice(id,'recovery-email',legacy));assert.equal(sent,0);
 await sendRenewalNotice('failed','recovery-email',legacy);await sendRenewalNotice('failed','recovery-email',legacy);assert.equal(sent,1);
 report=await renewalReport(legacy);assert.equal(report.subscriptions.find(r=>r.memberId==='failed').notices[0].purpose,'checkout-fix');assert.equal(report.subscriptions.find(r=>r.memberId==='failed').notices[0].status,'sent');assert.ok(!JSON.stringify(report).includes('test-only'));
 await writeRecord('maker-license-purchases.json',{purchases:[{id:'new',memberId:'failed',provider:'asaas',environment:'sandbox',status:'pending'}]},null);
 await assert.rejects(()=>sendRenewalNotice('failed','recovery-email',legacy));assert.equal(sent,1);
 }finally{globalThis.fetch=oldFetch;for(const k of Object.keys(process.env))if(!(k in saved))delete process.env[k];Object.assign(process.env,saved);await rm(dir,{recursive:true,force:true})}
});
