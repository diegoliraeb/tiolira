import {createHmac,randomBytes} from 'node:crypto';
import {readRecord,updateRecord} from './store.mjs';
import {securityConfig,safeEqual} from './auth.mjs';
import {promotionDate,promotionDownloadRows} from './promotion-downloads.mjs';

export const BANNER_ANALYTICS_KEY='analytics/promotion-home-banner.json';
export const BANNER_COOKIE='tiolira_promotion_banner';
const DAY=86400000,WINDOW=30*DAY;
const sign=(value,secret)=>createHmac('sha256',secret).update('promotion-home-banner:'+value).digest('hex');
const visitorKey=(id,secret)=>sign('visitor:'+id,secret);
export function bannerTrackingAllowed(req) {
  const h=req.headers||{};
  return h.dnt!=='1' && h['sec-gpc']!=='1' && !/bot|crawler|spider|preview|headless/i.test(String(h['user-agent']||'')) && !/prefetch|prerender/i.test(String(h.purpose||'')+' '+String(h['sec-purpose']||''));
}
function identity(req,secret,now) {
  const cookie=String(req.headers?.cookie||'').split(';').map(v=>v.trim()).find(v=>v.startsWith(BANNER_COOKIE+'='))?.slice(BANNER_COOKIE.length+1);
  if(!cookie || cookie.length>160)return null;
  const [id,expiry,signature,...rest]=cookie.split('.'),expires=Number(expiry);
  if(rest.length || !/^[a-f0-9]{32}$/.test(id||'') || !Number.isSafeInteger(expires) || expires<=now || expires>now+WINDOW || !safeEqual(signature,sign(id+'.'+expiry,secret)))return null;
  return {id,expires,token:cookie,key:visitorKey(id,secret)};
}
export async function recordBannerClick(req,now=Date.now()) {
  if(!bannerTrackingAllowed(req))return null;
  const {sessionSecret}=await securityConfig();if(!sessionSecret)return null;
  let visitor=identity(req,sessionSecret,now);
  if(!visitor){const id=randomBytes(16).toString('hex'),expires=now+WINDOW;visitor={id,expires,key:visitorKey(id,sessionSecret),token:`${id}.${expires}.${sign(id+'.'+expires,sessionSecret)}`};}
  const at=new Date(now).toISOString(),day=promotionDate(at);
  const result=await updateRecord(BANNER_ANALYTICS_KEY,old=>{
    const state=old||{startedAt:at,visitors:{}};
    state.visitors=Object.fromEntries(Object.entries(state.visitors||{}).filter(([,v])=>now-Date.parse(v.lastAt)<90*DAY));
    if(!state.visitors[visitor.key] && Object.keys(state.visitors).length>=20000){state.limited=true;return state;}
    const row=state.visitors[visitor.key] ||= {firstAt:at,lastAt:at,days:{}};
    row.lastAt=at;
    const bucket=row.days[day] ||= {count:0,firstAt:at};bucket.count++;
    return state;
  });
  if(!result.visitors[visitor.key])return null;
  return `${BANNER_COOKIE}=${visitor.token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${Math.floor((visitor.expires-now)/1000)}${process.env.VERCEL?'; Secure':''}`;
}
export async function attributeBannerVisit(req,member,now=Date.now()) {
  if(!member?.id || !bannerTrackingAllowed(req) || !String(req.headers?.cookie||'').includes(BANNER_COOKIE+'='))return;
  const {sessionSecret}=await securityConfig();if(!sessionSecret)return;
  const visitor=identity(req,sessionSecret,now);if(!visitor)return;
  const row=(await readRecord(BANNER_ANALYTICS_KEY))?.data?.visitors?.[visitor.key];
  if(!row || row.memberId)return;
  await updateRecord(BANNER_ANALYTICS_KEY,state=>{
    const current=state?.visitors?.[visitor.key];
    // The first authenticated account owns this attribution; a shared browser cannot reassign it.
    if(current && !current.memberId){current.memberId=member.id;current.identifiedAt=new Date(now).toISOString();}
    return state;
  });
}
export async function safelyAttributeBanner(req,member) {
  try{await attributeBannerVisit(req,member);}catch{console.warn('Promotion banner attribution unavailable');}
}

export function buildBannerReport(state={},commerce={},start,end) {
  const members={},downloadRows=promotionDownloadRows(commerce);
  let clicks=0,visitors=0;
  for(const row of Object.values(state.visitors||{})) {
    const days=Object.entries(row.days||{}).filter(([day])=>day>=start&&day<=end);
    const count=days.reduce((n,[,v])=>n+v.count,0);
    if(count){clicks+=count;visitors++;}
    if(!row.memberId)continue;
    const firstInPeriodAt=days.map(([,v])=>v.firstAt).sort()[0]||null;
    const member=members[row.memberId] ||= {firstAt:row.firstAt,firstInPeriodAt:null,downloaded:false};
    if(row.firstAt<member.firstAt)member.firstAt=row.firstAt;
    if(firstInPeriodAt && (!member.firstInPeriodAt || firstInPeriodAt<member.firstInPeriodAt))member.firstInPeriodAt=firstInPeriodAt;
  }
  for(const [memberId,member] of Object.entries(members)) {
    member.downloaded=Boolean(member.firstInPeriodAt && downloadRows.some(d=>d.memberId===memberId && d.count>0 && d.firstAt && Date.parse(d.firstAt)>=Date.parse(member.firstInPeriodAt) && promotionDate(d.firstAt)<=end));
  }
  return {startedAt:state.startedAt||null,limited:Boolean(state.limited),clicks,visitors,identified:Object.values(members).filter(m=>m.firstInPeriodAt).length,downloaders:Object.values(members).filter(m=>m.downloaded).length,members};
}
