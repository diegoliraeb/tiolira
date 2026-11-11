import {PROMOTION_ID} from './instagram-promotion-rules.mjs';
import {currentOrderEnvironment} from './payment-environment.mjs';

export const promotionDate = value => new Intl.DateTimeFormat('en-CA', {timeZone:'America/Maceio',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));
const eligibleOrders = state => (state.orders || []).filter(o => o.instagramPromotion?.campaignId === PROMOTION_ID && o.status === 'paid' && currentOrderEnvironment(o));
function add(row, event) {
  row.count++; const day=promotionDate(event.at); row.days[day]=(row.days[day]||0)+1;
  if (!row.firstAt || event.at < row.firstAt) row.firstAt=event.at;
  if (!row.lastAt || event.at > row.lastAt) row.lastAt=event.at;
}
function empty(order) {return {orderId:order.id,memberId:order.memberId,productId:order.productIds?.[0],count:0,days:{},firstAt:null,lastAt:null};}
export function promotionDownloadRows(state) {
  return eligibleOrders(state).map(order => {
    const saved=state.promotionDownloads?.[order.id];
    if (saved) return structuredClone(saved);
    const row={...empty(order),legacyLimited:!state.promotionDownloadsStartedAt || Date.parse(order.createdAt)<Date.parse(state.promotionDownloadsStartedAt)};
    for (const event of state.recentDownloads || []) if (event.memberId===row.memberId && event.productId===row.productId && Date.parse(event.at)>=Date.parse(order.paidAt || order.createdAt)) add(row,event);
    const partner=state.downloadPartners?.find(p=>p.memberId===row.memberId && p.productId===row.productId);
    if(partner && Date.parse(partner.lastAt)>=Date.parse(order.paidAt || order.createdAt)) {
      const allAfter=Date.parse(partner.firstAt)>=Date.parse(order.paidAt || order.createdAt);
      const total=allAfter?partner.downloads:Math.max(1,row.count);
      row.undatedCount=Math.max(0,total-row.count);row.count=Math.max(total,row.count);
      if(allAfter)row.firstAt=partner.firstAt;
      row.lastAt=partner.lastAt;
    }
    return row;
  });
}
// Called inside the same atomic commerce write as the authorized download event.
export function recordPromotionDownload(state,event) {
  const order=eligibleOrders(state).find(o=>o.memberId===event.memberId && o.productIds?.includes(event.productId) && Date.parse(event.at)>=Date.parse(o.paidAt || o.createdAt));
  if (!order) return;
  state.promotionDownloads ||= {};
  if (!state.promotionDownloads[order.id]) {
    state.promotionDownloads[order.id]=promotionDownloadRows(state).find(r=>r.orderId===order.id);
  }
  state.promotionDownloadsStartedAt ||= event.at;
  add(state.promotionDownloads[order.id],event);
}
