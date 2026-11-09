import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {verifyEmailEvent,receiveEmailDelivery,attachDeliveryReport,configureDeliveryTracking,deliveryTrackingStatus} from '../server/email-delivery-events.mjs';
import {writeRecord,readRecord} from '../server/store.mjs';
import {courtesyReportCsv} from '../lib/courtesy-report.mjs';
import handler from '../server/handler.mjs';

test('official Svix vector verifies exact body; tampering and expired events rejected',()=>{
 const raw='{"event_type":"ping","data":{"success":true}}',secret='whsec_plJ3nmyCDGBKInavdOK15jsl',headers={'svix-id':'msg_loFOjxBNrRLzqYUf','svix-timestamp':'1731705121','svix-signature':'v1,rAvfW3dJ/X/qxhsaXPOyyCGmRKsaKWcsNccKXlIktD0='};
 assert.equal(verifyEmailEvent(headers,raw,secret,1731705121000).event.data.success,true);
 assert.throws(()=>verifyEmailEvent(headers,raw+' ',secret,1731705121000),/Assinatura/);
 assert.throws(()=>verifyEmailEvent(headers,raw,secret,1731705501000),/expirado/);
});
test('verified provider events, private setup, recipient delivery and actual coupon report',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'tl-delivery-')),keys=['DATABASE_URL','POSTGRES_URL','VERCEL','BLOB_READ_WRITE_TOKEN','LOCAL_DATA_DIR','ASAAS_ENVIRONMENT','RESEND_API_KEY','EMAIL_FROM','SITE_URL'];
 const env=Object.fromEntries(keys.map(k=>[k,process.env[k]])),originalFetch=globalThis.fetch;
 keys.forEach(k=>delete process.env[k]);Object.assign(process.env,{LOCAL_DATA_DIR:dir,ASAAS_ENVIRONMENT:'sandbox',RESEND_API_KEY:'test',EMAIL_FROM:'Tio Lira <oi@mail.example.com>',SITE_URL:'https://example.com'});
 const secret='whsec_'+Buffer.from('test-only-secret-at-least-32-bytes').toString('base64'),emailId='abcdefab-1234-1234-1234-abcdefabcdef';let calls=[];
 globalThis.fetch=async(url,opts)=>{calls.push({url,opts});let data;if(url.endsWith('/webhooks')&&opts.method==='GET')data={data:[]};else if(url.endsWith('/webhooks')&&opts.method==='POST')data={id:'hook-id',signing_secret:secret};else if(url.endsWith('/domains'))data={data:[{id:'domain-id',name:'example.com'}]};else if(url.endsWith('/domains/domain-id'))data={id:'domain-id'};else assert.fail('Unexpected provider call '+url);return {ok:true,json:async()=>data};};
 const call=async(route,body,headers={})=>{let result;await handler({url:'/api/'+route,method:'POST',body,headers:{host:'example.com',origin:'https://example.com',...headers},socket:{remoteAddress:'test'}},{setHeader(){},set statusCode(v){this.status=v},end(v){result={status:this.status||200,body:JSON.parse(v)}}});return result;};
 try{
  assert.equal((await call('admin/brasileirao-update/tracking',{})).status,401);
  const configured=await configureDeliveryTracking();assert.equal(configured.configured,true);assert.equal(configured.openTracking,true);assert.equal(JSON.stringify(configured).includes(secret),false);assert.equal(calls.some(c=>c.url.endsWith('/emails')),false);
  assert.deepEqual(JSON.parse(calls.at(-1).opts.body),{open_tracking:true});
  const emit=async(type,eventId,at)=>{const raw=JSON.stringify({type:'email.'+type,created_at:at,data:{email_id:emailId}}),ts=String(Math.floor(Date.now()/1000)),headers={'svix-id':eventId,'svix-timestamp':ts};headers['svix-signature']='v1,'+createHmac('sha256',Buffer.from(secret.slice(6),'base64')).update(`${eventId}.${ts}.${raw}`).digest('base64');return call('webhooks/email-delivery',raw,headers);};
  assert.equal((await call('webhooks/email-delivery','{}')).status,401);
  assert.equal((await emit('opened','msg-open','2026-11-09T13:02:00Z')).status,200);
  await emit('opened','msg-open','2026-11-09T13:02:00Z');await emit('delivered','msg-delivery','2026-11-09T13:01:00Z');
  assert.equal((await readRecord(`email-events/${emailId}.json`)).data.ids.length,2);
  const campaign={id:'campaign',recipients:[{id:'recipient',email:'a@example.com',status:'sent',providerId:emailId,sentAt:'2026-11-09T13:00:00Z',payload:{private:'omit'}}]};
  const orders=[{id:'other-env',environment:'production',courtesy:{campaignId:'campaign',recipientId:'recipient'}},{id:'redemption',environment:'sandbox',status:'paid',paidAt:'2026-11-09T14:00:00Z',courtesy:{campaignId:'campaign',recipientId:'recipient'},items:[{name:'Noel Motoca'}]}];
  const report=await attachDeliveryReport(campaign,orders);assert.equal(report.summary.delivered,1);assert.equal(report.summary.opened,1);assert.equal(report.summary.redeemed,1);assert.equal(report.recipients[0].redemption.orderId,'redemption');assert.deepEqual(report.recipients[0].redemption.works,['Noel Motoca']);assert.equal(report.recipients[0].payload,undefined);
  const csv=courtesyReportCsv([{...report.recipients[0],name:'=FORMULA()'}]);assert.ok(csv.includes("'=FORMULA()"));assert.ok(csv.includes('Noel Motoca'));assert.ok(csv.includes('Abertura registrada'));
 }finally{globalThis.fetch=originalFetch;keys.forEach(k=>{if(env[k]===undefined)delete process.env[k];else process.env[k]=env[k]});await rm(dir,{recursive:true,force:true});}
});
