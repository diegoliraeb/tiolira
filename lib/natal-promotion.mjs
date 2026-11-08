export const NATAL_COLLECTION_ID='natal-brasileiro';
export const BRASILEIRAO_COLLECTION_ID='noeis-brasileirao';
export const NATAL_COLLECTION_IDS=[NATAL_COLLECTION_ID,BRASILEIRAO_COLLECTION_ID];
export const campaignId=collectionId=>`${collectionId}-black-friday-2026`;
export const promotionEntries=promotion=>promotion?.campaigns||(promotion?[promotion]:[]);
export const NATAL_PROMOTION_ID='natal-brasileiro-black-friday-2026';
// Local campaign dates in America/Maceio (UTC−03), end exclusive.
export const NATAL_START='2026-11-07T03:00:00.000Z';
export const NATAL_END='2026-12-01T03:00:00.000Z';
export const campaignStart=collectionId=>collectionId===BRASILEIRAO_COLLECTION_ID?'2026-11-08T03:00:00.000Z':NATAL_START;
export const natalActive=(now=Date.now(),collectionId=NATAL_COLLECTION_ID)=>Number(now)>=Date.parse(campaignStart(collectionId))&&Number(now)<Date.parse(NATAL_END);
export const natalEligible=(item,collectionId=NATAL_COLLECTION_ID)=>item.kind==='product'&&item.collection===collectionId&&item.priceCents>0;
export const pendingNatal=(o,collectionId=NATAL_COLLECTION_ID)=>promotionEntries(o.natalPromotion).some(p=>p.id===campaignId(collectionId))&&['creating','pending','review','overdue'].includes(o.status);
export function natalState(orders,products,memberId,now=Date.now(),collectionId=NATAL_COLLECTION_ID){
 const id=campaignId(collectionId);
 const memberOrders=orders.filter(o=>o.memberId===memberId);
 const used=memberOrders.some(o=>o.status==='paid'&&promotionEntries(o.natalPromotion).some(p=>p.id===id));
 const pending=memberOrders.find(o=>pendingNatal(o,collectionId));
 const eligibleIds=new Set(products.filter(p=>p.collection===collectionId&&p.access==='paid').map(p=>p.id));
 const previous=new Map();
 for(const o of memberOrders){
  if(o.status!=='paid'||promotionEntries(o.natalPromotion).some(p=>p.id===id)||!(o.totalCents>0))continue;
  for(const item of o.items||[]){
   if(item.kind!=='product'||!eligibleIds.has(item.id)||!(item.priceCents>0)||previous.has(item.id))continue;
   // Old orders without per-line allocations count only if the order was undiscounted.
   const full=item.totalCents!==undefined?item.totalCents===item.priceCents&&!(item.discountCents>0):!(o.discountCents>0)&&!o.coupon;
   if(full)previous.set(item.id,{productId:item.id,orderId:o.id});
  }
 }
 return {id,collectionId,active:natalActive(now,collectionId),startsAt:campaignStart(collectionId),endsAt:NATAL_END,used,reserved:Boolean(pending),pendingOrderId:pending?.id||null,previous:[...previous.values()].sort((a,b)=>a.productId.localeCompare(b.productId)),previousCount:previous.size};
}
export function applyNatalPromotion(quote,context,now=Date.now()){
 // Repricing is idempotent; never apply the same campaign twice to a quote.
 if(quote.natalPromotion)return quote;
 const states=context?.campaigns||[context];
 const applied=[];
 for(const state of states){
  if(!state||!NATAL_COLLECTION_IDS.includes(state.collectionId||NATAL_COLLECTION_ID))continue;
  const next=applyCollectionPromotion(quote,state,now);
  if(next.natalPromotion)applied.push(next.natalPromotion);
  quote={...next,natalPromotion:null};
 }
 return {...quote,natalPromotion:applied.length===0?null:applied.length===1?applied[0]:{
  campaigns:applied,discountCents:applied.reduce((n,p)=>n+p.discountCents,0),
  percent:applied.every(p=>p.percent===100)?100:50
 }};
}
function applyCollectionPromotion(quote,context,now){
 const collectionId=context.collectionId||NATAL_COLLECTION_ID;
 if(!context?.active||!natalActive(now,collectionId)||context.used||context.reserved)return {...quote,natalPromotion:null};
 const eligible=quote.items.filter(item=>natalEligible(item,collectionId));
 if(!eligible.length)return {...quote,natalPromotion:null};
 const count=new Set(eligible.map(i=>i.id)).size,prior=context.previousCount||0;
 const percent=prior>=2||count+prior>=3?100:count+prior===2?50:0;
 if(!percent)return {...quote,natalPromotion:null};
 const cheapest=[...eligible].sort((a,b)=>a.priceCents-b.priceCents||a.id.localeCompare(b.id))[0];
 const discountCents=Math.round(cheapest.priceCents*percent/100);
 const items=quote.items.map(item=>item===cheapest?{...item,discountCents:(item.discountCents||0)+discountCents,totalCents:(item.totalCents??item.priceCents)-discountCents}:item);
 const sources=(context.previous||[]).slice(0,prior>=3?3:Math.min(prior,2));
 return {...quote,items,discountCents:(quote.discountCents||0)+discountCents,totalCents:quote.totalCents-discountCents,natalPromotion:{id:campaignId(collectionId),collectionId,percent,discountCents,productId:cheapest.id,quantity:count,previousCount:prior,mode:prior>=3?'loyalty':'bundle',qualifyingPurchases:sources,endsAt:NATAL_END}};
}

// Only the discounted model depends on the earlier purchases. Other fully paid
// items in a mixed order retain access if a qualifying purchase is refunded.
export function natalProductAccess(order,productId,orders){
 const promo=promotionEntries(order.natalPromotion).find(p=>NATAL_COLLECTION_IDS.some(id=>p.id===campaignId(id))&&p.productId===productId);
 if(!promo)return true;
 return (promo.qualifyingPurchases||[]).every(ref=>orders.some(o=>o.id===ref.orderId&&o.memberId===order.memberId&&o.status==='paid'&&o.productIds?.includes(ref.productId)));
}
