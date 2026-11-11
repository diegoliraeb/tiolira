import {readRecord,updateRecord} from './store.mjs';
import {PROMOTION_KEY,PROMOTION_ID} from './instagram-promotion-rules.mjs';
import {emailIsVerified} from './partner-email-verification.mjs';
import {currentOrderEnvironment} from './payment-environment.mjs';
import {promotionDownloadRows,promotionDate} from './promotion-downloads.mjs';
import {promotionStages,promotionPendingLabels,promotionActionLabels} from '../lib/promotion-progress.mjs';

export const PROMOTION_ANALYTICS_KEY='analytics/instagram-promotion.json';
const validSteps=['email','instagram','follow','comment','coupon'];
const statuses=new Set(['complete','missing','unavailable','relink','pending']);
const iso=value=>Number.isFinite(Date.parse(value))?new Date(value).toISOString():null;
const earliest=values=>values.map(iso).filter(Boolean).sort()[0]||null;
const latest=values=>values.map(iso).filter(Boolean).sort().at(-1)||null;

export async function recordPromotionActivity(member,action,{outcome='ok',step,checks,context,onlyExisting=false}={},now=Date.now()) {
  if (!member?.id || !Object.hasOwn(promotionActionLabels,action)) return;
  const existing=(await readRecord(PROMOTION_ANALYTICS_KEY))?.data;
  const prior=existing?.participants?.[member.id];
  if (onlyExisting && !prior) return;
  if (action==='visit' && prior && now-Date.parse(prior.lastVisitAt)<60_000) return;
  const at=new Date(now).toISOString();
  await updateRecord(PROMOTION_ANALYTICS_KEY,old=>{
    const state=old || {startedAt:at,participants:{}};
    state.participants ||= {};
    const row=state.participants[member.id] ||= {firstAt:at,lastAt:at,events:[],openedSteps:{}};
    row.lastAt=at;
    if(action==='visit')row.lastVisitAt=at;
    if(action==='step' && validSteps.includes(step))row.openedSteps[step]=at;
    if(checks) row.lastChecks={at:iso(checks.checkedAt)||at,configVersion:context?.configVersion,bindingId:context?.bindingId,
      follows:checks.follows?.length && checks.follows.every(f=>f.status==='complete')?'complete':checks.follows?.map(f=>f.status).find(s=>statuses.has(s)&&s!=='complete')||'pending',
      comment:statuses.has(checks.comment)?checks.comment:'pending'};
    const event={action,outcome:outcome==='error'?'error':'ok',at,...(action==='step'&&validSteps.includes(step)?{step}:{})};
    // Polls do not fill the timeline; repeated events are coalesced for a minute.
    const last=row.events.at(-1);
    if(action!=='visit' || !row.events.length) {
      if(last?.action===event.action && last?.outcome===event.outcome && last?.step===event.step && now-Date.parse(last.at)<60_000) last.at=at;
      else row.events.push(event);
      row.events=row.events.slice(-40);
    }
    row.lastAction=event;
    return state;
  });
}
export async function safelyRecordPromotion(member,action,details) {
  try {await recordPromotionActivity(member,action,details);} catch {console.warn('Promotion analytics write unavailable');}
}
export async function trackPromotionAction(member,action,run,details) {
  try {const result=await run();await safelyRecordPromotion(member,action,details);return result;}
  catch(error){await safelyRecordPromotion(member,action,{...details,outcome:'error'});throw error;}
}

export function buildPromotionReport({promotion={},tracking={},members=[],commerce={},optOut={},start,end,pages={}},now=Date.now()) {
  const memberMap=new Map(members.map(m=>[m.id,m]));
  const orders=(commerce.orders||[]).filter(o=>o.instagramPromotion?.campaignId===PROMOTION_ID && currentOrderEnvironment(o) && o.status==='paid');
  const downloads=promotionDownloadRows(commerce);
  const claims=new Map((promotion.claims||[]).map(c=>[c.memberId,c]));
  const byOrder=new Map(orders.map(o=>[o.memberId,o]));
  const pending=new Map(Object.values(promotion.challenges||{}).map(c=>[c.memberId,c]));
  const ids=new Set([...Object.keys(tracking.participants||{}),...Object.keys(promotion.bindings||{}),...claims.keys(),...byOrder.keys(),...pending.keys()]);
  const inRange=value=>iso(value) && promotionDate(value)>=start && promotionDate(value)<=end;
  const all=[];
  for(const memberId of ids) {
    const member=memberMap.get(memberId),activity=tracking.participants?.[memberId]||{},binding=promotion.bindings?.[memberId],claim=claims.get(memberId),order=byOrder.get(memberId),challenge=pending.get(memberId);
    const download=downloads.find(d=>d.orderId===order?.id);
    const firstAt=earliest([activity.firstAt,binding?.verifiedAt,claim?.issuedAt,order?.createdAt,challenge?.createdAt?new Date(challenge.createdAt).toISOString():null]);
    const lastAt=latest([activity.lastAt,binding?.verifiedAt,claim?.issuedAt,order?.createdAt,download?.lastAt,challenge?.createdAt?new Date(challenge.createdAt).toISOString():null,member&&activity.firstAt?member.emailVerification?.verifiedAt:null]);
    const currentCheck=activity.lastChecks?.bindingId===binding?.id && activity.lastChecks?.configVersion===promotion.config?.version ? activity.lastChecks : null;
    const complete={visited:true,email:Boolean(claim)||emailIsVerified(member),instagram:Boolean(binding||claim),follow:Boolean(claim)||currentCheck?.follows==='complete',comment:Boolean(claim)||currentCheck?.comment==='complete',coupon:Boolean(claim),redeemed:Boolean(order),download:Boolean(download?.count)};
    const pendingStage=promotionStages.slice(1).find(([key])=>!complete[key])?.[0]||'complete';
    const datedDownloads=Object.entries(download?.days||{}).filter(([day])=>day>=start&&day<=end).reduce((n,[,v])=>n+v,0);
    const downloadsInPeriod=datedDownloads+(inRange(download?.firstAt)&&inRange(download?.lastAt)?download?.undatedCount||0:!datedDownloads&&inRange(download?.lastAt)&&download?.undatedCount?1:0);
    if(!inRange(lastAt) && !downloadsInPeriod) continue;
    all.push({memberId,name:member?.name||order?.memberName||'Cadastro removido',email:member?.email||'',emailVerified:emailIsVerified(member),contactBlocked:Boolean(optOut[memberId]),instagram:binding?.username||claim?.username||'',firstAt,lastAt,registeredAt:member?.createdAt||null,
      pendingStage,pendingLabel:promotionPendingLabels[pendingStage],complete,checksAt:currentCheck?.at||null,followStatus:claim?'complete':currentCheck?.follows||'unknown',commentStatus:claim?'complete':currentCheck?.comment||'unknown',
      emailAt:emailIsVerified(member)?member.emailVerification.verifiedAt:null,instagramAt:binding?.verifiedAt||null,couponAt:claim?.issuedAt||null,couponExpiresAt:claim?.expiresAt||null,redeemedAt:order?.createdAt||null,productName:order?.items?.[0]?.name||'',
      downloads:downloadsInPeriod,downloadsTotal:download?.count||0,downloadFirstAt:download?.firstAt||null,downloadLastAt:download?.lastAt||null,
      openedSteps:activity.openedSteps||{},history:activity.events||[],lastAction:activity.lastAction||null,historical:!activity.firstAt});
  }
  all.sort((a,b)=>(b.lastAt||'').localeCompare(a.lastAt||''));
  const stages=promotionStages.map(([id,label])=>({id,label,count:all.filter(p=>p.complete[id]).length}));
  return {start,end,generatedAt:new Date(now).toISOString(),trackingStartedAt:tracking.startedAt||null,downloadTrackingStartedAt:commerce.promotionDownloadsStartedAt||null,
    historicalDownloadsLimited:downloads.some(d=>d.legacyLimited),stages,participants:all,
    summary:{participants:all.length,pageViews:Object.entries(pages).filter(([path])=>/^\/(pt|en|es|fr)\/promocao$/.test(path)).reduce((n,[,v])=>n+v,0),coupons:all.filter(p=>p.complete.coupon).length,redeemed:all.filter(p=>p.complete.redeemed).length,downloaders:all.filter(p=>p.downloads>0).length,downloads:all.reduce((n,p)=>n+p.downloads,0),incomplete:all.filter(p=>p.pendingStage!=='complete').length,firstStep:all.filter(p=>['email','instagram'].includes(p.pendingStage)).length},
  };
}
export async function promotionAnalyticsReport({start,end,pages},now=Date.now()) {
  const [promotion,tracking,members,commerce,reminders]=await Promise.all([readRecord(PROMOTION_KEY),readRecord(PROMOTION_ANALYTICS_KEY),readRecord('club-members.json'),readRecord('commerce.json'),readRecord('analytics/cart-reminders.json')]);
  return buildPromotionReport({promotion:promotion?.data,tracking:tracking?.data,members:members?.data?.members,commerce:commerce?.data,optOut:reminders?.data?.optOut,start,end,pages},now);
}
