import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {readRecord,writeRecord,updateRecord} from '../server/store.mjs';
import {markSubscriberWelcome,markLegacySubscriberWelcome} from '../lib/subscriber-welcome.mjs';
import {grantPurchase} from '../lib/maker-purchases.mjs';
import {runSubscriberWelcomeEmails,subscriberWelcomeMessage,subscriberWelcomeReport} from '../server/subscriber-welcome.mjs';
const KEY='subscriber-welcome-emails.json';

test('outbox is written only for first confirmed grant, never replay, existing entitlement or renewal',()=>{
 const row={id:'first',memberId:'m',environment:'sandbox',status:'paid'};
 grantPurchase(row,[row]);assert.ok(row.welcomeRequestedAt);const original=row.welcomeRequestedAt;
 grantPurchase(row,[row]);assert.equal(row.welcomeRequestedAt,original);
 const old={...row,id:'old'};delete old.welcomeRequestedAt;grantPurchase(old,[old]);assert.equal(old.welcomeRequestedAt,undefined);
 const renewal={id:'renewal',memberId:'m',environment:'sandbox',status:'paid'};grantPurchase(renewal,[row,renewal]);assert.equal(renewal.welcomeRequestedAt,undefined);
 const pending={...row,status:'pending'};delete pending.welcomeRequestedAt;markSubscriberWelcome(pending,[]);assert.equal(pending.welcomeRequestedAt,undefined);
 const legacy={periods:[{startsAt:row.startsAt,endsAt:row.endsAt}]};markLegacySubscriberWelcome(legacy,true);assert.equal(legacy.welcomeRequestedAt,undefined);markLegacySubscriberWelcome(legacy,false);assert.ok(legacy.welcomeRequestedAt);
});
test('approved HTML has escaped real member/validity, public image and both commercial-code instructions',()=>{
 const m=subscriberWelcomeMessage({name:'<script>x</script> & Joana'},'2027-11-24T15:00:00Z','https://www.tiolira.com.br');
 assert.match(m.html,/&lt;script&gt;/);assert.doesNotMatch(m.html,/<script>|\{\{|cid:/);assert.match(m.html,/24\/11\/2027/);assert.match(m.html,/Click Sanctis I está incluída/);assert.match(m.html,/10% de desconto/);assert.match(m.html,/https:\/\/www.tiolira.com.br\/assets\/email\/click-sanctis-I.jpg/);assert.match(m.text,/Licença comercial: \[seu código\]/);assert.match(m.text,/MakerWorld/);assert.doesNotMatch(m.text,/criptograf/);
 assert.throws(()=>subscriberWelcomeMessage({},'invalid','https://www.tiolira.com.br'));assert.throws(()=>subscriberWelcomeMessage({},'2027-01-01','http://example.invalid'));
});
async function fixture(fn){
 const saved={...process.env},fetch0=globalThis.fetch,dir=await mkdtemp(join(tmpdir(),'tl-welcome-'));
 for(const k of ['DATABASE_URL','POSTGRES_URL','VERCEL','BLOB_READ_WRITE_TOKEN'])delete process.env[k];Object.assign(process.env,{LOCAL_DATA_DIR:dir,ASAAS_ENVIRONMENT:'sandbox',PAYPAL_ENVIRONMENT:'sandbox',RESEND_API_KEY:'test-only',EMAIL_FROM:'Test <test@example.invalid>',SITE_URL:'https://www.tiolira.com.br'});
 const member={id:'m',name:'Joana',email:'joana@example.invalid'},now=Date.now(),row={id:'paid',memberId:'m',provider:'asaas',environment:'sandbox',status:'paid',startsAt:new Date(now-10000).toISOString(),endsAt:new Date(now+86400000*365).toISOString(),welcomeRequestedAt:new Date(now).toISOString()};
 await writeRecord('club-members.json',{members:[member]},null);await writeRecord('maker-license-purchases.json',{purchases:[row]},null);
 try{await fn({member,row,now});}finally{globalThis.fetch=fetch0;for(const k of Object.keys(process.env))if(!(k in saved))delete process.env[k];Object.assign(process.env,saved);await rm(dir,{recursive:true,force:true});}
}
test('concurrent workers send once, record delivery and never backfill old subscribers',()=>fixture(async({row})=>{
 const payloads=[];globalThis.fetch=async(url,opts)=>{assert.equal(url,'https://api.resend.com/emails');payloads.push(opts);return {ok:true,json:async()=>({id:'mail-test'})};};
 await updateRecord('maker-license-purchases.json',d=>{delete d.purchases[0].welcomeRequestedAt;return d});await runSubscriberWelcomeEmails();assert.equal(payloads.length,0);
 await updateRecord('maker-license-purchases.json',d=>{d.purchases[0]=row;return d});
 await Promise.all([runSubscriberWelcomeEmails(),runSubscriberWelcomeEmails()]);await runSubscriberWelcomeEmails();assert.equal(payloads.length,1);
 const sent=JSON.parse(payloads[0].body);assert.deepEqual(sent.to,['joana@example.invalid']);assert.match(sent.html,/Joana/);
 await writeRecord('email-events/mail-test.json',{events:{delivered:'2026-11-24',opened:'2026-11-24'}},null);
 const report=await subscriberWelcomeReport();assert.equal(report.summary.sent,1);assert.equal(report.summary.delivered,1);assert.equal(report.summary.opened,1);assert.doesNotMatch(JSON.stringify(report),/payload|test-only|joana@example/);
}));
test('uncertain delivery retries exact body and key, but stops before provider idempotency expires',()=>fixture(async({now})=>{
 const calls=[];globalThis.fetch=async(url,o)=>{calls.push(o);throw Error('timeout after provider accepted');};
 await runSubscriberWelcomeEmails(now);process.env.EMAIL_FROM='Changed <changed@example.invalid>';await runSubscriberWelcomeEmails(now+300000);
 assert.equal(calls.length,2);assert.equal(calls[0].body,calls[1].body);assert.equal(calls[0].headers['Idempotency-Key'],calls[1].headers['Idempotency-Key']);
 await runSubscriberWelcomeEmails(now+24*3600000);assert.equal(calls.length,2);assert.equal((await subscriberWelcomeReport()).summary.review,1);
}));
test('preview, pending and revoked entitlements do not send; changed recipient requires review',()=>fixture(async({now})=>{
 let calls=0;globalThis.fetch=async()=>{calls++;throw Error('timeout');};
 process.env.VERCEL='1';process.env.VERCEL_ENV='preview';await runSubscriberWelcomeEmails();assert.equal(calls,0);delete process.env.VERCEL;
 await updateRecord('maker-license-purchases.json',d=>{d.purchases[0].status='pending';return d});await runSubscriberWelcomeEmails();assert.equal(calls,0);
 await updateRecord('maker-license-purchases.json',d=>{d.purchases[0].status='paid';return d});await runSubscriberWelcomeEmails(now);assert.equal(calls,1);
 await updateRecord('club-members.json',d=>{d.members[0].email='new@example.invalid';return d});await runSubscriberWelcomeEmails(now+300000);assert.equal(calls,1);assert.equal((await subscriberWelcomeReport()).summary.review,1);
 await updateRecord(KEY,d=>{Object.values(d.jobs)[0].status='pending';return d});await updateRecord('maker-license-purchases.json',d=>{d.purchases[0].status='revoked';return d});await runSubscriberWelcomeEmails(now+600000);assert.equal(calls,1);assert.equal((await subscriberWelcomeReport()).jobs[0].status,'cancelled');
}));
