import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {buildPromotionReport,recordPromotionActivity,PROMOTION_ANALYTICS_KEY} from '../server/promotion-analytics.mjs';
import {promotionDownloadRows,recordPromotionDownload} from '../server/promotion-downloads.mjs';
import {PROMOTION_ID,PROMOTION_KEY} from '../server/instagram-promotion-rules.mjs';
import {writeRecord,readRecord} from '../server/store.mjs';
import {makeSession,clubCookieName} from '../server/auth.mjs';
import handler from '../server/handler.mjs';

const now=Date.parse('2026-11-15T16:00:00Z'),stamp='2026-11-15T12:00:00Z';
const member=(id,verified=true)=>({id,version:randomUUID(),name:id,email:id+'@example.invalid',...(verified?{emailVerification:{email:id+'@example.invalid',verifiedAt:stamp}}:{})});
const order=(id,memberId)=>({id,memberId,memberName:memberId,memberEmail:memberId+'@example.invalid',status:'paid',provider:'promotion',environment:'sandbox',currency:'BRL',createdAt:stamp,paidAt:stamp,productIds:['model'],items:[{name:'Noel São Paulo'}],instagramPromotion:{campaignId:PROMOTION_ID,claimId:id+'-claim'}});
const event=(memberId,at='2026-11-15T13:00:00Z')=>({memberId,productId:'model',at});
const activity=(extra={})=>({firstAt:stamp,lastAt:stamp,openedSteps:{email:stamp},events:[{action:'visit',at:stamp,outcome:'ok'}],...extra});

test('promotion reporting uses verified state, exact participant cohorts and download evidence',()=>{
 const old=process.env.ASAAS_ENVIRONMENT;process.env.ASAAS_ENVIRONMENT='sandbox';
 try {
 const members=[member('email-pending',false),member('email-done'),member('linked'),member('claimed'),member('redeemed'),member('unrelated'),member('old')];
 const promotion={config:{version:'v1'},bindings:{linked:{id:'binding',username:'linked',verifiedAt:stamp},old:{id:'old',username:'old',verifiedAt:'2020-01-01T00:00:00Z'}},claims:[{memberId:'claimed',issuedAt:stamp,username:'claimed'},{memberId:'redeemed',issuedAt:stamp,username:'redeemed'}]};
 const tracking={participants:{'email-pending':activity(),'email-done':activity(),linked:activity({lastChecks:{at:stamp,configVersion:'v1',bindingId:'binding',follows:'missing',comment:'complete'}})}};
 const commerce={orders:[order('order','redeemed')],recentDownloads:[event('redeemed'),event('redeemed','2026-11-15T14:00:00Z'),event('redeemed','2026-11-15T11:00:00Z'),event('unrelated')]};
 const input={promotion,tracking,members,commerce,start:'2026-11-15',end:'2026-11-15',pages:{'/pt/promocao':10,'/pt':99},optOut:{'email-done':{at:stamp}}};
 const report=buildPromotionReport(input,now),rows=new Map(report.participants.map(p=>[p.memberId,p]));
 assert.equal(report.summary.participants,5);assert.equal(report.summary.pageViews,10);
 assert.equal(rows.get('email-pending').pendingStage,'email');assert.equal(rows.get('email-done').pendingStage,'instagram');assert.equal(rows.get('email-done').contactBlocked,true);
 assert.equal(rows.get('linked').pendingStage,'follow');assert.equal(rows.get('linked').commentStatus,'complete');
 assert.equal(rows.get('claimed').pendingStage,'redeemed');assert.equal(rows.get('redeemed').pendingStage,'complete');
 assert.equal(report.summary.coupons,2);assert.equal(report.summary.redeemed,1);assert.equal(report.summary.downloaders,1);assert.equal(report.summary.downloads,2);
 assert.equal(rows.has('unrelated'),false);assert.equal(rows.has('old'),false);
 assert.equal(report.historicalDownloadsLimited,true);
 commerce.recentDownloads=[];commerce.downloadPartners=[{memberId:'redeemed',productId:'model',downloads:600,firstAt:'2026-11-15T13:00:00Z',lastAt:'2026-11-15T15:00:00Z'}];
 const recovered=buildPromotionReport(input,now);assert.equal(recovered.summary.downloaders,1);assert.equal(recovered.summary.downloads,600);
 commerce.downloadPartners[0].firstAt='2026-11-14T13:00:00Z';
 const partial=buildPromotionReport(input,now);assert.equal(partial.summary.downloaders,1);assert.equal(partial.summary.downloads,1);

 promotion.config.version='v2';const changed=buildPromotionReport(input,now).participants.find(p=>p.memberId==='linked');assert.equal(changed.commentStatus,'unknown');assert.equal(changed.checksAt,null);
 } finally {if(old===undefined)delete process.env.ASAAS_ENVIRONMENT;else process.env.ASAAS_ENVIRONMENT=old;}
});

test('authorized promotion downloads remain durable after recent event truncation and isolate environments',()=>{
 const old=process.env.ASAAS_ENVIRONMENT;process.env.ASAAS_ENVIRONMENT='sandbox';
 try {
 const state={orders:[order('o','member'),{...order('other','other'),environment:'production'}],recentDownloads:[event('member')],downloads:{model:30}};
 const next=event('member','2026-11-16T12:00:00Z');recordPromotionDownload(state,next);state.recentDownloads=[next];
 recordPromotionDownload(state,event('other'));
 assert.equal(Object.keys(state.promotionDownloads).length,1);assert.equal(state.promotionDownloads.o.count,2);assert.equal(state.promotionDownloads.o.days['2026-11-15'],1);assert.equal(state.promotionDownloads.o.days['2026-11-16'],1);
 assert.equal(state.downloads.model,30);state.recentDownloads=[];
 assert.equal(promotionDownloadRows(state)[0].count,2);
 const report=buildPromotionReport({members:[member('member')],commerce:state,promotion:{claims:[{memberId:'member',issuedAt:stamp}]},start:'2026-11-16',end:'2026-11-16'},now+86400000);
 assert.equal(report.summary.downloaders,1);assert.equal(report.summary.downloads,1);assert.equal(report.participants[0].downloadsTotal,2);
 state.orders[0].status='revoked';assert.equal(promotionDownloadRows(state).length,0);
 } finally {if(old===undefined)delete process.env.ASAAS_ENVIRONMENT;else process.env.ASAAS_ENVIRONMENT=old;}
});

test('tracked milestones are private, do not store tokens and cannot be forged by opening steps',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'tl-promo-report-')),keys=['DATABASE_URL','POSTGRES_URL','VERCEL','BLOB_READ_WRITE_TOKEN','LOCAL_DATA_DIR','ADMIN_SESSION_SECRET'];
 const env=Object.fromEntries(keys.map(k=>[k,process.env[k]]));for(const k of keys)delete process.env[k];process.env.LOCAL_DATA_DIR=dir;process.env.ADMIN_SESSION_SECRET='promotion-report-test-secret-at-least-32-characters';
 const person=member(randomUUID(),false),other=member(randomUUID()),admin={version:randomUUID()};
 const call=async(route,method='GET',body={},cookie='',origin='http://localhost')=>{const r={headers:{}};await handler({method,url:'/api/'+route,body,headers:{host:'localhost',origin,cookie,'user-agent':'Test Browser'},socket:{remoteAddress:'promotion-report-test'}},{setHeader(k,v){r.headers[k]=v;},set statusCode(s){r.status=s;},end(v){r.body=JSON.parse(v);}});return r;};
 try {
 await writeRecord('club-members.json',{members:[person,other]},null);await writeRecord('admin.json',admin,null);
 await recordPromotionActivity(other,'email_request',{onlyExisting:true},now);assert.equal(await readRecord(PROMOTION_ANALYTICS_KEY),null);
 await recordPromotionActivity(person,'visit',{},now);await recordPromotionActivity(person,'visit',{},now+1000);
 let state=(await readRecord(PROMOTION_ANALYTICS_KEY)).data;assert.equal(state.participants[person.id].events.length,1);assert.equal(state.participants[person.id].lastVisitAt,new Date(now).toISOString());
 const cookie=`${clubCookieName}=${await makeSession(person.version,{memberId:person.id})}`;
 assert.equal((await call('admin/analytics')).status,401);assert.equal((await call('admin/analytics','GET',{},cookie)).status,401);
 assert.equal((await call('club/instagram-promotion/activity','POST',{step:'email'})).status,401);
 assert.equal((await call('club/instagram-promotion/activity','POST',{step:'email'},cookie,'https://bad.invalid')).status,403);
 assert.equal((await call('club/instagram-promotion/activity','POST',{step:'not-real'},cookie)).status,400);
 assert.equal((await call('club/instagram-promotion/activity','POST',{step:'coupon',memberId:other.id,complete:true,ticket:'sensitive-test-ticket'},cookie)).status,200);
 state=(await readRecord(PROMOTION_ANALYTICS_KEY)).data;assert.ok(state.participants[person.id].openedSteps.coupon);assert.equal(state.participants[other.id],undefined);assert.ok(!JSON.stringify(state).includes('sensitive-test-ticket'));assert.equal(state.participants[person.id].complete,undefined);
 const day=state.participants[person.id].lastAt.slice(0,10),report=buildPromotionReport({tracking:state,members:[person,other],start:'2020-01-01',end:'2030-12-31'},now);
 assert.equal(report.participants.length,1);assert.equal(report.participants[0].pendingStage,'email');assert.equal(report.participants[0].complete.coupon,false);
 const adminCookie=`tiolira_admin=${await makeSession(admin.version)}`;
 const response=await call('admin/analytics?days=30','GET',{},adminCookie);assert.equal(response.status,200);assert.equal(response.headers['Cache-Control'],'private, no-store');assert.ok(response.body.promotion);
 } finally {for(const [k,v] of Object.entries(env)){if(v===undefined)delete process.env[k];else process.env[k]=v;}await rm(dir,{recursive:true,force:true});}
});
