import {cartState} from './cart-state.mjs';
export {cartState} from './cart-state.mjs';
import {reminderReport} from './cart-reminders.mjs';
import {createHmac} from 'node:crypto';
import {z} from 'zod';
import {getCatalog,readRecord,writeRecord,updateRecord,Conflict} from './store.mjs';
import {securityConfig} from './auth.mjs';
import {asaasConfig} from './asaas.mjs';
import {paypalConfig} from './paypal.mjs';
import {quoteCheckout} from './commerce.mjs';
import {currentOrderEnvironment} from './payment-environment.mjs';
import {readClickCounts} from './product-clicks.mjs';
import {activityPage} from '../lib/activity.mjs';
const CARTS='analytics/carts.json',META='analytics/started.json',DAY=86400000;
const fail=(m,status=400)=>{throw Object.assign(new Error(m),{status});};
export const activityDate=(now=Date.now())=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Maceio',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now));
const eventSchema=z.object({eventId:z.string().uuid(),sessionId:z.string().uuid(),type:z.enum(['page','product']),path:z.string().max(240).optional(),productId:z.string().max(100).optional(),lang:z.enum(['pt','en','es','fr']).optional(),source:z.enum(['direct','instagram','facebook','google','youtube','pinterest','tiktok','whatsapp','bing','other','internal']),device:z.enum(['mobile','tablet','desktop'])});
async function started(now){if(await readRecord(META))return;try{await writeRecord(META,{startedAt:new Date(now).toISOString()},null);}catch(e){if(!(e instanceof Conflict))throw e;}}
export async function recordActivity(req,input,now=Date.now()){
 if(/bot|crawler|spider|preview|headless/i.test(String(req.headers['user-agent']||'')))return {ok:true};
 const event=eventSchema.parse(input),{sessionSecret}=await securityConfig();if(!sessionSecret)return {ok:true};
 const page=event.type==='page'?activityPage(event.path):null;
 if(event.type==='page'&&!page)fail('Página inválida.');
 let productId=null,lang=page?.lang||event.lang||'pt';
 if(page?.kind==='product'||event.type==='product'){
  const {data}=await getCatalog(),p=data.products.find(p=>(page?p.slug===page.slug:p.id===event.productId)&&p.published&&data.collections.some(c=>c.id===p.collection&&c.published));
  if(!p)fail('Obra não encontrada.',404);productId=p.id;
 }
 const date=activityDate(now),hash=value=>createHmac('sha256',sessionSecret).update(date+':'+value).digest('hex'),session=hash(event.sessionId),eventId=hash(event.eventId);
 await started(now);
 await updateRecord(`analytics/days/${date}.json`,old=>{
  const d=old||{date,views:0,sessions:{},recent:{},pages:{},products:{},sources:{},devices:{},languages:{},limited:false};
  d.recent=Object.fromEntries(Object.entries(d.recent).filter(([,expires])=>expires>now));
  if(d.recent[eventId])return d;
  if(Object.keys(d.recent).length>=10000||!d.sessions[session]&&Object.keys(d.sessions).length>=5000){d.limited=true;return d;}
  d.recent[eventId]=now+60*60_000;
  if(!d.sessions[session]){d.sessions[session]=true;d.sources[event.source]=(d.sources[event.source]||0)+1;d.devices[event.device]=(d.devices[event.device]||0)+1;d.languages[lang]=(d.languages[lang]||0)+1;}
  if(page){d.views++;d.pages[page.path]=(d.pages[page.path]||0)+1;}
  if(productId)d.products[productId]=(d.products[productId]||0)+1;
  return d;
 });return {ok:true};
}
import {cartItemSchema} from '../lib/cart-schema.mjs';
const cartSchema=z.object({cartId:z.string().uuid(),sequence:z.number().int().positive().max(1_000_000),lang:z.enum(['pt','en','es','fr']).optional(),items:z.array(cartItemSchema).max(40),couponCode:z.string().max(40).optional()});
export async function recordCart(member,input,now=Date.now()){
 const parsed=cartSchema.parse(input),key=member.id+':'+parsed.cartId;
 const previous=(await readRecord(CARTS))?.data?.carts?.[key];if(previous?.sequence>=parsed.sequence)return {ok:true};
 let quote=null;
 if(parsed.items.length){try{quote=await quoteCheckout(member,{items:parsed.items,couponCode:parsed.couponCode||''});}catch(error){if(error.status===400||error.name==='ZodError'){quote=await quoteCheckout(member,{items:parsed.items,couponCode:''});}else throw error;}}
 await started(now);
 await updateRecord(CARTS,old=>{
  const carts=Object.fromEntries(Object.entries(old?.carts||{}).filter(([,c])=>now-Date.parse(c.updatedAt)<90*DAY));
  const current=carts[key];if(current?.sequence>=parsed.sequence)return {...old,carts};
  if(!quote&&!current)return {...old,carts};
  carts[key]={lang:parsed.lang||current?.lang||'pt',cartId:parsed.cartId,memberId:member.id,memberName:member.name,memberEmail:member.email,currency:quote?.currency||current.currency,provider:(quote?.currency||current?.currency)==='USD'?'paypal':'asaas',environment:quote?(quote.currency==='USD'?paypalConfig():asaasConfig()).environment:current.environment,sequence:parsed.sequence,createdAt:current?.createdAt||new Date(now).toISOString(),updatedAt:new Date(now).toISOString(),items:quote?.items||[],productIds:quote?.productIds||[],totalCents:quote?.totalCents||0,coupon:quote?.coupon?.code||null};
  const trimmed=Object.fromEntries(Object.entries(carts).sort(([,a],[,b])=>b.updatedAt.localeCompare(a.updatedAt)).slice(0,5000));
  return {carts:trimmed};
 });return {ok:true};
}
function addCounts(target,source){for(const [key,count] of Object.entries(source||{}))target[key]=(target[key]||0)+count;}
export async function analyticsReport(daysInput=30,now=Date.now()){
 const days=z.coerce.number().refine(n=>[7,30,90].includes(n),'Escolha 7, 30 ou 90 dias.').parse(daysInput);
 const dates=Array.from({length:days},(_,i)=>activityDate(now-(days-1-i)*DAY)),start=dates[0],end=dates.at(-1);
 const [{data:catalog},commerce,meta,cartRecord,clicks,membersRecord,feedbackRecord]=await Promise.all([getCatalog(),readRecord('commerce.json'),readRecord(META),readRecord(CARTS),readClickCounts(),readRecord('club-members.json'),readRecord('feedback.json')]);
 const records=[];for(let i=0;i<dates.length;i+=10)records.push(...await Promise.all(dates.slice(i,i+10).map(d=>readRecord(`analytics/days/${d}.json`))));
 const sources={},devices={},languages={},pages={},products={},series=dates.map((date,i)=>{const d=records[i]?.data;addCounts(sources,d?.sources);addCounts(devices,d?.devices);addCounts(languages,d?.languages);addCounts(pages,d?.pages);addCounts(products,d?.products);return {date,views:d?.views||0,sessions:Object.keys(d?.sessions||{}).length};});
 const inRange=iso=>Number.isFinite(Date.parse(iso))&&activityDate(Date.parse(iso))>=start&&activityDate(Date.parse(iso))<=end;
 const allOrders=(commerce?.data?.orders||[]).filter(currentOrderEnvironment),orders=allOrders.filter(o=>inRange(o.createdAt)),paid=orders.filter(o=>o.status==='paid'),pending=orders.filter(o=>['pending','creating','overdue','review'].includes(o.status));
 const carts=Object.values(cartRecord?.data?.carts||{}).filter(c=>currentOrderEnvironment(c)&&inRange(c.updatedAt)).map(c=>({...c,status:cartState(c,allOrders,now)})),abandoned=carts.filter(c=>c.status==='abandoned');
 const sales={};for(const o of paid)for(const productId of new Set(o.productIds||[]))sales[productId]=(sales[productId]||0)+1;
 const ranking=catalog.products.map(p=>({id:p.id,name:p.name,slug:p.slug,image:p.image,views:products[p.id]||0,clicks:clicks[p.id]||0,sales:sales[p.id]||0,downloads:commerce?.data?.downloads?.[p.id]||0}));
 const members=membersRecord?.data?.members||[],feedback=feedbackRecord?.data;
 const reminders=await reminderReport(Object.values(cartRecord?.data?.carts||{}),allOrders,now);
 return {reminders,days,start,end,startedAt:meta?.data?.startedAt||null,generatedAt:new Date(now).toISOString(),limited:records.some(r=>r?.data?.limited),series,sources,devices,languages,pages,ranking,
 summary:{views:series.reduce((s,d)=>s+d.views,0),sessions:series.reduce((s,d)=>s+d.sessions,0),orders:orders.length,paid:paid.length,pending:pending.length,conversion:orders.length?paid.length/orders.length*100:0,revenueBRL:paid.filter(o=>o.currency!=='USD').reduce((s,o)=>s+o.totalCents,0),revenueUSD:paid.filter(o=>o.currency==='USD').reduce((s,o)=>s+o.totalCents,0),abandoned:abandoned.length,activeCarts:carts.filter(c=>c.status==='active').length,abandonedBRL:abandoned.filter(c=>c.currency!=='USD').reduce((s,c)=>s+c.totalCents,0),abandonedUSD:abandoned.filter(c=>c.currency==='USD').reduce((s,c)=>s+c.totalCents,0),members:members.length,newMembers:members.filter(m=>inRange(m.createdAt)).length,downloadsTotal:Object.values(commerce?.data?.downloads||{}).reduce((s,v)=>s+v,0),reviewsPending:feedback?.reviews.filter(r=>r.status==='pending').length||0,requestsPending:feedback?.threads.filter(t=>t.status==='received').length||0},
 abandoned:abandoned.sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)).map(({sequence,memberId,...c})=>({...c,reminder:reminders.carts[c.cartId+':'+memberId]})),
 pendingOrders:pending.sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).map(o=>({id:o.id,memberName:o.memberName,memberEmail:o.memberEmail,createdAt:o.createdAt,totalCents:o.totalCents,currency:o.currency||'BRL',status:o.status,items:o.items.map(i=>i.name)}))};
}
