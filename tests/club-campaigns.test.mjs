import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {readRecord,writeRecord,updateRecord} from '../server/store.mjs';
import {campaignAudience,prepareClubCampaign,releaseClubCampaign,runClubCampaign,clubCampaignReport,campaignVisit,campaignUnsubscribe,campaignConversions} from '../server/club-campaigns.mjs';
import {campaignEmail} from '../server/club-campaign-email.mjs';
import {activateManualAnnual} from '../server/admin-member-support.mjs';
import handler from '../server/handler.mjs';

test('localization and international price preserve benefits, unsubscribe and purchase rights',()=>{
 for(const lang of ['pt','en','es','fr']){
  const r=campaignEmail({lang,member:{countryCode:'IE'},origin:'https://example.com',visit:'https://example.com/api/visit?token=x',stop:'https://example.com/api/stop?token=y'});
  assert.ok(r.html.includes('PayPal'));assert.ok(r.html.includes('USD'));assert.ok(!r.html.includes('R$ 49,90'));assert.ok(r.html.includes('href="https://example.com/api/stop?token=y"'));assert.ok(r.html.includes('href="https://example.com/api/visit?token=x"'));assert.ok(r.text.includes('MakerWorld'));
  if(lang!=='pt'){assert.ok(!r.html.includes('Já comprou uma obra'));assert.ok(!r.html.includes('Não quero receber'));}
 }
 const ctx={members:[{id:'a',email:'A@example.com',countryCode:'BR'},{id:'b',email:'a@example.com',countryCode:'BR'},{id:'c',email:'c@example.com',country:'Ireland'},{id:'d',email:'d@example.com',countryCode:'ES'},{id:'e',email:'e@example.com',countryCode:'FR'},{id:'f',email:'bad'}],subscriptions:[{memberId:'a',active:true}],prefs:{},cartOptOut:{},suppressed:{},orders:[]};
 const a=campaignAudience(ctx);assert.equal(a.excluded.active,2);assert.equal(a.excluded.invalid,1);assert.deepEqual(a.recipients.map(r=>r.lang),['en','es','fr']);
});
test('campaign freezes recipients, rechecks active subscribers, sends once, tracks delivery, protects opt-out and admin access',async()=>{
 const saved={...process.env},fetch0=globalThis.fetch,dir=await mkdtemp(join(tmpdir(),'tl-campaign-test-'));
 for(const k of ['DATABASE_URL','POSTGRES_URL','VERCEL','BLOB_READ_WRITE_TOKEN'])delete process.env[k];Object.assign(process.env,{LOCAL_DATA_DIR:dir,ADMIN_SESSION_SECRET:'campaign-test-secret-at-least-32-characters',ASAAS_ENVIRONMENT:'sandbox',PAYPAL_ENVIRONMENT:'sandbox',RESEND_API_KEY:'test',EMAIL_FROM:'Tio Lira <test@example.com>',SITE_URL:'https://example.com'});
 const members=[{id:randomUUID(),name:'First',email:'first@example.com',countryCode:'BR'},{id:randomUUID(),name:'Second',email:'second@example.com',countryCode:'IE'},{id:randomUUID(),name:'Third',email:'third@example.com',countryCode:'BR'}],actor={email:'admin@example.com'};let calls=[];
 globalThis.fetch=async(url,opts)=>{assert.equal(url,'https://api.resend.com/emails');const payload=JSON.parse(opts.body);calls.push({payload,key:opts.headers['Idempotency-Key']});return new Response(JSON.stringify({id:randomUUID()}),{status:200})};
 try{
  await writeRecord('club-members.json',{members},null);await writeRecord('email-delivery-config.json',{secret:'whsec_test',openTracking:true},null);
  let status;await handler({method:'POST',url:'/api/admin/club-campaigns/prepare',headers:{host:'localhost',origin:'http://localhost'},body:{requestId:randomUUID()},socket:{remoteAddress:'test'}},{setHeader(){},set statusCode(v){status=v},end(){}});assert.equal(status,401);
  const {id}=await prepareClubCampaign(actor,{requestId:randomUUID()});assert.equal((await readRecord(`club-campaigns/${id}.json`)).data.recipients.length,3);
  await activateManualAnnual(actor,{memberId:members[2].id,requestId:randomUUID(),confirmed:true,kind:'courtesy',reason:'Test subscription before sending'});
  await releaseClubCampaign(id);await Promise.all([runClubCampaign(id),runClubCampaign(id)]);await runClubCampaign(id);
  assert.equal(calls.length,2);assert.equal(new Set(calls.map(c=>c.key)).size,2);assert.ok(calls.some(c=>c.payload.to[0]===members[1].email&&c.payload.html.includes('PayPal')));
  let run=(await readRecord(`club-campaigns/${id}.json`)).data;assert.equal(run.status,'complete');assert.equal(run.recipients[2].status,'skipped');
  const stop=new URL(calls[0].payload.headers['List-Unsubscribe'].slice(1,-1)).searchParams.get('token');
  await campaignUnsubscribe(stop);assert.ok(!(await readRecord('club-campaigns/preferences.json')).data.optOut);
  await campaignUnsubscribe(stop,true);assert.ok((await readRecord('club-campaigns/preferences.json')).data.optOut[createHash('sha256').update('first@example.com').digest('hex')]);await assert.rejects(campaignUnsubscribe(stop+'x'),{status:410});
  const visit=calls[0].payload.text.match(/https:\/\/example.com\/api\/club-campaigns\/visit\?token=([^\s]+)/)[1];assert.equal(await campaignVisit(visit),' /pt/assinatura'.trim());
  await writeRecord(`email-events/${run.recipients[0].providerId}.json`,{events:{delivered:new Date().toISOString(),opened:new Date().toISOString()}},null);
  const report=await clubCampaignReport(id);assert.equal(report.campaign.summary.sent,2);assert.equal(report.campaign.summary.delivered,1);assert.equal(report.campaign.summary.opened,1);assert.equal(report.campaign.summary.clicked,1);assert.equal(report.campaign.summary.unsubscribed,1);assert.ok(report.campaign.recipients.every(r=>!r.payload));
  run=(await readRecord(`club-campaigns/${id}.json`)).data;const r=run.recipients[0],at=new Date(Date.now()+10000).toISOString(),purchase={id:'paid',memberId:r.memberId,status:'paid',createdAt:at,paidAt:at};assert.equal(campaignConversions([run],[purchase]).size,1);assert.equal(campaignConversions([run],[{...purchase,status:'revoked'}]).size,0);assert.equal(campaignConversions([run],[{...purchase,manualActivation:{kind:'courtesy'}}]).size,0);assert.equal(campaignConversions([run],[{...purchase,memberId:'other'}]).size,0);
  await updateRecord('club-members.json',d=>{d.members.push({id:randomUUID(),name:'Quota test',email:'quota@example.com',countryCode:'BR'});return d});
  const quota=await prepareClubCampaign(actor,{requestId:randomUUID()});await releaseClubCampaign(quota.id);let quotaCalls=0;
  globalThis.fetch=async()=>{quotaCalls++;return new Response(JSON.stringify({name:'daily_quota_exceeded',message:'You have reached your daily email sending quota.'}),{status:429})};
  await runClubCampaign(quota.id);await runClubCampaign(quota.id);assert.equal(quotaCalls,1);
  const held=(await readRecord(`club-campaigns/${quota.id}.json`)).data;assert.ok(Date.parse(held.notBefore)>Date.now());assert.equal(held.recipients[0].status,'retry');assert.equal(held.recipients[0].firstAttemptAt,undefined);
  await updateRecord(`club-campaigns/${quota.id}.json`,d=>{d.notBefore=new Date(Date.now()-1000).toISOString();return d});
  globalThis.fetch=async()=>new Response(JSON.stringify({id:randomUUID()}),{status:200});await runClubCampaign(quota.id);assert.equal((await readRecord(`club-campaigns/${quota.id}.json`)).data.recipients[0].status,'sent');
 }finally{globalThis.fetch=fetch0;for(const k of Object.keys(process.env))if(!(k in saved))delete process.env[k];Object.assign(process.env,saved);await rm(dir,{recursive:true,force:true});}
});
