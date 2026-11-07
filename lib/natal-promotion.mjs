export const NATAL_COLLECTION_ID='natal-brasileiro';
export const NATAL_PROMOTION_ID='natal-brasileiro-black-friday-2026';
// Local campaign dates in America/Maceio (UTC−03), end exclusive.
export const NATAL_START='2026-11-07T03:00:00.000Z';
export const NATAL_END='2026-12-01T03:00:00.000Z';
export const natalActive=(now=Date.now())=>Number(now)>=Date.parse(NATAL_START)&&Number(now)<Date.parse(NATAL_END);
export const natalEligible=item=>item.kind==='product'&&item.collection===NATAL_COLLECTION_ID&&item.priceCents>0;
export const pendingNatal=o=>o.natalPromotion?.id===NATAL_PROMOTION_ID&&['creating','pending','review','overdue'].includes(o.status);
export function natalState(orders,products,memberId,now=Date.now()){
 const memberOrders=orders.filter(o=>o.memberId===memberId);
 const used=memberOrders.some(o=>o.status==='paid'&&o.natalPromotion?.id===NATAL_PROMOTION_ID);
 const pending=memberOrders.find(pendingNatal);
 const eligibleIds=new Set(products.filter(p=>p.collection===NATAL_COLLECTION_ID&&p.access==='paid').map(p=>p.id));
 const previous=new Map();
 for(const o of memberOrders){
  if(o.status!=='paid'||o.natalPromotion?.id===NATAL_PROMOTION_ID||!(o.totalCents>0))continue;
  for(const item of o.items||[]){
   if(item.kind!=='product'||!eligibleIds.has(item.id)||!(item.priceCents>0)||previous.has(item.id))continue;
   // Old orders without per-line allocations count only if the order was undiscounted.
   const full=item.totalCents!==undefined?item.totalCents===item.priceCents&&!(item.discountCents>0):!(o.discountCents>0)&&!o.coupon;
   if(full)previous.set(item.id,{productId:item.id,orderId:o.id});
  }
 }
 return {id:NATAL_PROMOTION_ID,active:natalActive(now),startsAt:NATAL_START,endsAt:NATAL_END,used,reserved:Boolean(pending),pendingOrderId:pending?.id||null,previous:[...previous.values()].sort((a,b)=>a.productId.localeCompare(b.productId)),previousCount:previous.size};
}
export function applyNatalPromotion(quote,context,now=Date.now()){
 if(!context?.active||!natalActive(now)||context.used||context.reserved)return {...quote,natalPromotion:null};
 const eligible=quote.items.filter(natalEligible);
 if(!eligible.length)return {...quote,natalPromotion:null};
 const count=new Set(eligible.map(i=>i.id)).size,prior=context.previousCount||0;
 const percent=prior>=2||count+prior>=3?100:count+prior===2?50:0;
 if(!percent)return {...quote,natalPromotion:null};
 const cheapest=[...eligible].sort((a,b)=>a.priceCents-b.priceCents||a.id.localeCompare(b.id))[0];
 const discountCents=Math.round(cheapest.priceCents*percent/100);
 const items=quote.items.map(item=>item===cheapest?{...item,discountCents:(item.discountCents||0)+discountCents,totalCents:(item.totalCents??item.priceCents)-discountCents}:item);
 const sources=(context.previous||[]).slice(0,prior>=3?3:Math.min(prior,2));
 return {...quote,items,discountCents:(quote.discountCents||0)+discountCents,totalCents:quote.totalCents-discountCents,natalPromotion:{id:NATAL_PROMOTION_ID,collectionId:NATAL_COLLECTION_ID,percent,discountCents,productId:cheapest.id,quantity:count,previousCount:prior,mode:prior>=3?'loyalty':'bundle',qualifyingPurchases:sources,endsAt:NATAL_END}};
}

// Only the discounted model depends on the earlier purchases. Other fully paid
// items in a mixed order retain access if a qualifying purchase is refunded.
export function natalProductAccess(order,productId,orders){
 const promo=order.natalPromotion;
 if(promo?.id!==NATAL_PROMOTION_ID||promo.productId!==productId)return true;
 return (promo.qualifyingPurchases||[]).every(ref=>orders.some(o=>o.id===ref.orderId&&o.memberId===order.memberId&&o.status==='paid'&&o.productIds?.includes(ref.productId)));
}
