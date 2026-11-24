import {markSubscriberWelcome} from './subscriber-welcome.mjs';
import {MAKER_PRICE,yearAfter} from './maker-license.mjs';
import {internationalBuyer,usdPriceCents} from './international-pricing.mjs';
export function makerMarket(member){const international=internationalBuyer(member);return {provider:international?'paypal':'asaas',currency:international?'USD':'BRL',totalCents:international?usdPriceCents({priceCents:MAKER_PRICE}):MAKER_PRICE};}
export function purchaseValidity(rows,now=Date.now()){
 const periods=rows.filter(r=>r.status==='paid'&&r.startsAt&&r.endsAt).map(r=>({id:r.id,startsAt:r.startsAt,endsAt:r.endsAt})).sort((a,b)=>a.startsAt.localeCompare(b.startsAt));
 let end=0,start=null;
 for(const p of periods){const a=Date.parse(p.startsAt),b=Date.parse(p.endsAt);if(a<=now&&b>now||end>=a&&end>now){start||=p.startsAt;end=Math.max(end,b)}}
 return {active:end>now,validFrom:start,validUntil:end>now?new Date(end).toISOString():null,lastExpiry:periods.map(p=>p.endsAt).sort().at(-1)||null};
}
export function grantPurchase(row,rows,now=new Date().toISOString()){
 if(row.startsAt&&row.endsAt)return;
 const end=purchaseValidity(rows.filter(r=>r.id!==row.id),Date.parse(now)).validUntil;
 row.paidAt||=now;row.startsAt=end||now;row.endsAt=yearAfter(row.startsAt);markSubscriberWelcome(row,rows,now);
}
export function reminderWindow(expiry,now=Date.now()){
 const days=Math.ceil((Date.parse(expiry)-now)/86400000);
 return days>=0&&days<=1?'1':days<=7&&days>1?'7':days<=30&&days>7?'30':null;
}
