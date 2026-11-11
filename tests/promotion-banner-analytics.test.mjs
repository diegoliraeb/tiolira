import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {BANNER_ANALYTICS_KEY,BANNER_COOKIE,recordBannerClick,attributeBannerVisit,buildBannerReport} from '../server/promotion-banner-analytics.mjs';
import {buildPromotionReport} from '../server/promotion-analytics.mjs';
import {recordPromotionDownload} from '../server/promotion-downloads.mjs';
import {PROMOTION_ID} from '../server/instagram-promotion-rules.mjs';
import {readRecord,writeRecord} from '../server/store.mjs';
import {makeSession} from '../server/auth.mjs';
import handler from '../server/handler.mjs';

const at='2026-11-15T12:00:00Z',now=Date.parse(at),day='2026-11-15';
const req=(cookie='',headers={})=>({headers:{host:'localhost','user-agent':'Test Browser',cookie,...headers},socket:{remoteAddress:'banner-test'}});
const order=(memberId,extra={})=>({id:'order-'+memberId,memberId,status:'paid',provider:'promotion',environment:'sandbox',createdAt:at,paidAt:at,productIds:['noel'],items:[{name:'Noel'}],instagramPromotion:{campaignId:PROMOTION_ID},...extra});

test('banner click identity, later authentication and private reporting work without accepting forged identities',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'tl-banner-')),keys=['DATABASE_URL','POSTGRES_URL','VERCEL','BLOB_READ_WRITE_TOKEN','LOCAL_DATA_DIR','ADMIN_SESSION_SECRET','ASAAS_ENVIRONMENT'];
 const env=Object.fromEntries(keys.map(k=>[k,process.env[k]]));for(const k of keys)delete process.env[k];Object.assign(process.env,{LOCAL_DATA_DIR:dir,ADMIN_SESSION_SECRET:'banner-analytics-test-secret-at-least-32-characters',ASAAS_ENVIRONMENT:'sandbox'});
 try {
  const cookie=(await recordBannerClick(req(),now)).split(';')[0];
  await recordBannerClick(req(cookie),now+1000);
  let state=(await readRecord(BANNER_ANALYTICS_KEY)).data;
  assert.equal(Object.keys(state.visitors).length,1);assert.equal(buildBannerReport(state,{},day,day).clicks,2);
  assert.ok(!JSON.stringify(state).includes(cookie.split('=')[1].split('.')[0]));assert.ok(!JSON.stringify(state).includes('banner-test'));
  await attributeBannerVisit(req(cookie),{id:'a'},now+2000);
  await attributeBannerVisit(req(cookie),{id:'b'},now+3000);
  state=(await readRecord(BANNER_ANALYTICS_KEY)).data;assert.equal(Object.values(state.visitors)[0].memberId,'a');
  const forged=cookie.slice(0,-1)+(cookie.endsWith('a')?'b':'a');
  await attributeBannerVisit(req(forged),{id:'forged'},now+4000);
  assert.equal(Object.values((await readRecord(BANNER_ANALYTICS_KEY)).data.visitors).some(v=>v.memberId==='forged'),false);
  for(const headers of [{dnt:'1'},{'sec-gpc':'1'},{'user-agent':'Googlebot'},{'sec-purpose':'prefetch'}])assert.equal(await recordBannerClick(req('',headers),now),null);
  assert.equal(buildBannerReport((await readRecord(BANNER_ANALYTICS_KEY)).data,{},day,day).clicks,2);
  const expires=Number(cookie.split('.')[1]);await attributeBannerVisit(req(cookie),{id:'expired'},expires+1);
  assert.equal(Object.values((await readRecord(BANNER_ANALYTICS_KEY)).data.visitors).some(v=>v.memberId==='expired'),false);

  const person={id:randomUUID(),version:randomUUID(),name:'Banner Test',email:'banner@example.invalid',countryCode:'BR'},admin={version:randomUUID()};
  await writeRecord('club-members.json',{members:[person]},null);await writeRecord('admin.json',admin,null);
  const call=async(url,cookie='',headers={})=>{const result={headers:{}};await handler({...req(cookie,headers),method:'GET',url:'/api/'+url},{setHeader(k,v){result.headers[k]=v},set statusCode(s){result.status=s},end(v){result.body=v?JSON.parse(v):null}});return result;};
  const redirect=await call('analytics/promotion-banner?lang=fr&memberId=forged&next=https://evil.invalid');
  assert.equal(redirect.status,302);assert.equal(redirect.headers.Location,'/fr/promocao');assert.equal(redirect.headers['Cache-Control'],'private, no-store');assert.match(redirect.headers['Set-Cookie'],/HttpOnly; SameSite=Lax/);
  const browserCookie=redirect.headers['Set-Cookie'].split(';')[0],clubCookie=`tiolira_club=${await makeSession(person.version,{memberId:person.id})}`;
  assert.equal((await call('club/instagram-promotion',browserCookie)).status,401);
  assert.equal((await call('club/instagram-promotion',browserCookie+'; '+clubCookie)).status,200);
  assert.ok(Object.values((await readRecord(BANNER_ANALYTICS_KEY)).data.visitors).some(v=>v.memberId===person.id));
  assert.equal((await call('admin/analytics',clubCookie)).status,401);
  const report=await call('admin/analytics','tiolira_admin='+await makeSession(admin.version));
  assert.equal(report.status,200);assert.ok(report.body.promotion.banner);assert.equal(report.body.promotion.banner.members,undefined);
  const excluded=await call('analytics/promotion-banner?lang=//evil.invalid','',{dnt:'1'});assert.equal(excluded.headers.Location,'/pt/promocao');assert.equal(excluded.headers['Set-Cookie'],undefined);
 } finally {for(const [k,v]of Object.entries(env)){if(v===undefined)delete process.env[k];else process.env[k]=v;}await rm(dir,{recursive:true,force:true});}
});

test('banner conversions count unique people and first downloads only, within the selected click cohort',()=>{
 const old=process.env.ASAAS_ENVIRONMENT;process.env.ASAAS_ENVIRONMENT='sandbox';
 try {
  const visit=(memberId,stamp=at,count=1)=>({memberId,firstAt:stamp,lastAt:stamp,days:{[stamp.slice(0,10)]:{count,firstAt:stamp}}});
  const tracking={startedAt:at,visitors:{a:visit('a',at,3),secondBrowser:visit('a'),anonymous:visit(undefined),before:visit('before','2026-11-15T14:00:00Z'),future:visit('future'),wrong:visit('wrong'),old:visit('old','2026-11-14T12:00:00Z')}};
  const commerce={orders:['a','before','future','wrong','old'].map(id=>order(id,id==='wrong'?{environment:'production'}:{}))};
  for(const [memberId,stamp]of [['a','2026-11-15T13:00:00Z'],['a','2026-11-15T15:00:00Z'],['before','2026-11-15T13:00:00Z'],['before','2026-11-15T16:00:00Z'],['future','2026-11-16T13:00:00Z'],['wrong','2026-11-15T13:00:00Z'],['old','2026-11-15T13:00:00Z']])recordPromotionDownload(commerce,{memberId,productId:'noel',at:stamp});
  const report=buildBannerReport(tracking,commerce,day,day);
  assert.equal(report.clicks,8);assert.equal(report.visitors,6);assert.equal(report.identified,4);assert.equal(report.downloaders,1);
  assert.equal(report.members.a.downloaded,true);assert.equal(report.members.before.downloaded,false);assert.equal(report.members.future.downloaded,false);assert.equal(report.members.wrong.downloaded,false);assert.equal(report.members.old.downloaded,false);
  assert.equal(buildBannerReport(tracking,commerce,'2026-11-14','2026-11-16').downloaders,3);
  const participant=buildPromotionReport({bannerTracking:tracking,commerce,start:day,end:day},now).participants.find(p=>p.memberId==='a');
  assert.equal(participant.bannerConverted,true);assert.equal(participant.bannerFirstAt,at);assert.equal(participant.bannerInPeriod,true);
  assert.equal(buildBannerReport({},commerce,day,day).downloaders,0);
 }finally{if(old===undefined)delete process.env.ASAAS_ENVIRONMENT;else process.env.ASAAS_ENVIRONMENT=old;}
});
