const DAY=86400000;
const dateFormat=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Maceio',year:'numeric',month:'2-digit',day:'2-digit'});
export const financeDay=value=>{const date=new Date(value);return Number.isFinite(date.getTime())?dateFormat.format(date):null;};
const start=key=>Date.parse(`${key}T03:00:00Z`);
const shiftDay=(key,n)=>financeDay(start(key)+n*DAY);
function shiftMonth(key,n){const [y,m,d]=key.split('-').map(Number),first=new Date(Date.UTC(y,m-1+n,1)),last=new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth()+1,0)).getUTCDate();return `${first.getUTCFullYear()}-${String(first.getUTCMonth()+1).padStart(2,'0')}-${String(Math.min(d,last)).padStart(2,'0')}`;}
export function financeRange({mode='day',count,currency='BRL'}={},now=Date.now()){
 count=Number(count??(mode==='day'?30:12));
 if(!['day','month'].includes(mode)||!['BRL','USD'].includes(currency)||!(mode==='day'?[7,30,90]:[6,12,24]).includes(count))throw Object.assign(Error('Período ou moeda inválidos.'),{status:400});
 const today=financeDay(now),from=mode==='day'?shiftDay(today,1-count):shiftMonth(today.slice(0,7)+'-01',1-count),previousFrom=mode==='day'?shiftDay(from,-count):shiftMonth(from,-count),previousTo=mode==='day'?shiftDay(today,-count):shiftMonth(today,-count);
 return {mode,count,currency,from,to:today,previousFrom,previousTo,previousEnd:start(previousTo)+now-start(today),keys:Array.from({length:count},(_,i)=>mode==='day'?shiftDay(from,i):shiftMonth(from,i).slice(0,7))};
}
const paymentTime=value=>typeof value==='string'&&value?Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(value)?`${value}T03:00:00Z`:value):NaN;
export function financeLedger(records,environments){
 const candidates=[],diagnostics={undated:0,invalid:0,legacyDates:0,revoked:0,duplicates:0};
 const current=r=>r.environment===environments[r.provider==='paypal'?'paypal':'asaas'];
 for(const r of records.commerce?.orders||[])if(current(r))candidates.push({...r,kind:'pieces'});
 for(const r of records.purchases?.purchases||[])if(current(r))candidates.push({...r,kind:'subscriptions'});
 for(const s of records.legacy?.subscriptions||[])if(current(s))for(const p of s.periods||[])if(p.revoked||(p.startsAt&&p.endsAt))candidates.push({id:p.paymentId,provider:s.provider||'asaas',environment:s.environment,paymentId:p.paymentId,status:p.revoked?'revoked':'paid',currency:'BRL',totalCents:4990,paidAt:p.paidAt||p.startsAt,legacyDate:!p.paidAt,kind:'subscriptions'});
 const unique=new Map();
 for(const r of candidates){
  if(!['paid','revoked'].includes(r.status)||r.provider==='promotion'||r.manualActivation?.kind==='courtesy'||r.totalCents===0)continue;
  const id=r.captureId||r.paymentId||r.id;
  if(!id){diagnostics.invalid++;continue;}
  const key=`${r.provider||'asaas'}:${r.environment||'manual'}:${id}`,old=unique.get(key);
  if(!old){unique.set(key,r);continue;}
  diagnostics.duplicates++;
  if(r.status==='revoked'){unique.set(key,r);continue;}
  if(old.status==='revoked'||old.status==='conflict')continue;
  if(old.kind!==r.kind||old.totalCents!==r.totalCents||(old.currency||'BRL')!==(r.currency||'BRL')){unique.set(key,{...r,status:'conflict'});continue;}
  if((old.legacyDate&&!r.legacyDate)||(!Number.isFinite(paymentTime(old.paidAt))&&Number.isFinite(paymentTime(r.paidAt))))unique.set(key,r);
 }
 const payments=[];
 for(const r of unique.values()){
  if(r.status==='revoked'){diagnostics.revoked++;continue;}
  const currency=r.currency||'BRL';
  if(r.status==='conflict'||!['BRL','USD'].includes(currency)||!Number.isSafeInteger(r.totalCents)||r.totalCents<=0){diagnostics.invalid++;continue;}
  const time=paymentTime(r.paidAt);if(!Number.isFinite(time)){diagnostics.undated++;continue;}
  if(r.legacyDate)diagnostics.legacyDates++;
  payments.push({time,date:financeDay(time),currency,kind:r.kind,cents:r.totalCents});
 }
 return {payments,diagnostics};
}
const empty=()=>({subscriptionsCents:0,piecesCents:0,totalCents:0,subscriptionsCount:0,piecesCount:0});
function add(summary,p){summary[p.kind+'Cents']+=p.cents;summary[p.kind+'Count']++;summary.totalCents+=p.cents;}
export function buildFinancialOverview(records,environments,filters={},now=Date.now()){
 const range=financeRange(filters,now),{payments,diagnostics}=financeLedger(records,environments),summary=empty(),previous=empty(),series=range.keys.map(key=>({key,...empty()})),byKey=new Map(series.map(s=>[s.key,s]));
 for(const p of payments){if(p.currency!==range.currency||p.time>now)continue;if(p.date>=range.from&&p.date<=range.to){add(summary,p);add(byKey.get(range.mode==='day'?p.date:p.date.slice(0,7)),p);}if(p.date>=range.previousFrom&&p.time<=range.previousEnd)add(previous,p);}
 const {keys,previousEnd,...period}=range;
 return {generatedAt:new Date(now).toISOString(),timezone:'America/Maceio',period,summary,previous,changePercent:previous.totalCents?100*(summary.totalCents-previous.totalCents)/previous.totalCents:null,series,diagnostics};
}
