import test from 'node:test';
import assert from 'node:assert/strict';
import {NATAL_COLLECTION_ID as N,BRASILEIRAO_COLLECTION_ID as B,NATAL_END,natalActive,natalState,applyNatalPromotion,promotionEntries,natalProductAccess,campaignId} from '../lib/natal-promotion.mjs';
import {memberNatalState,natalReservation} from '../server/natal-promotion.mjs';
import {discountQuote} from '../server/cart-coupons.mjs';
import {quoteCart} from '../server/commerce.mjs';
import {cartSelection} from '../lib/cart-lines.mjs';
const now=Date.parse('2026-11-15T12:00:00Z');
const products=[N,B,'other'].flatMap(collection=>Array.from({length:6},(_,i)=>({id:`${collection}-${i}`,collection,access:'paid',published:true,priceCents:1990,name:'Noel',filePath:'models/noel.3mf',kind:'product'})));
const data={products,collections:[N,B,'other'].map(id=>({id,published:true,free:false,priceCents:0}))};
const selections=(n,b,other=0)=>[...products.filter(p=>p.collection===N).slice(0,n),...products.filter(p=>p.collection===B).slice(0,b),...products.filter(p=>p.collection==='other').slice(0,other)].map(p=>({kind:'product',id:p.id}));
const context=orders=>({campaigns:[N,B].map(c=>natalState(orders,products,'member',now,c))});
const paid=(collection,i)=>({id:`order-${collection}-${i}`,memberId:'member',status:'paid',totalCents:1990,productIds:[`${collection}-${i}`],items:[{...products.find(p=>p.id===`${collection}-${i}`),totalCents:1990,discountCents:0}]});
const coupon={id:'coupon',code:'TEN',active:true,type:'percent',value:10,minimumCents:0};
const quote=(items,orders=[],code='')=>discountQuote(quoteCart(data,items),code,[coupon],now,context(orders));
test('Brasileirão has its own start date and end, without extending Natal',()=>{
 assert.equal(natalActive(Date.parse('2026-11-07T12:00:00Z'),N),true);
 assert.equal(natalActive(Date.parse('2026-11-08T02:59:59Z'),B),false);
 assert.equal(natalActive(Date.parse('2026-11-08T03:00:00Z'),B),true);
 assert.equal(natalActive(Date.parse(NATAL_END),B),false);
});
test('separate cart thresholds, add/remove updates, mixed campaigns and coupon allocation',()=>{
 for(const [n,b,discount] of [[1,1,0],[2,1,995],[1,2,995],[2,2,1990],[3,3,3980],[3,2,2985],[4,1,1990],[0,1,0],[0,2,995],[0,3,1990],[0,4,1990],[0,6,1990]]){
  const items=selections(n,b),q=quote(items),front=cartSelection({...data,collections:[],natalCampaign:context([])},items);
  // cartSelection uses current clock; campaign is active on the launch date.
  assert.equal(q.discountCents,discount,`${n} Natal, ${b} Brasileirão`);
  assert.equal(q.totalCents,(n+b)*1990-discount);
  if(natalActive())assert.equal(front.total,q.totalCents);
  assert.deepEqual(applyNatalPromotion(q,context([]),now),q,'no duplicate application');
 }
 const both=quote(selections(2,3,1),[],'TEN');
 assert.equal(both.couponDiscountCents,199);assert.equal(both.discountCents,995+1990+199);
 assert.equal(both.totalCents,both.items.reduce((s,i)=>s+i.totalCents,0));
 assert.throws(()=>quote(selections(2,3),[],'TEN'),/não acumula/);
 assert.equal(quote(selections(2,1),[],'TEN').couponDiscountCents,199,'non-promoted collection remains coupon-eligible');
});
test('history, redemption and refund access stay isolated by collection including legacy orders',()=>{
 const historical=[paid(N,0),paid(N,1),paid(N,2)];
 assert.equal(context(historical).campaigns[1].previousCount,0);
 assert.equal(quote(selections(0,1),historical).totalCents,1990);
 const used={...paid(N,4),natalPromotion:{id:campaignId(N),collectionId:N,productId:`${N}-4`,qualifyingPurchases:[{orderId:historical[0].id,productId:`${N}-0`}]}};
 const ctx=context([...historical,used]);assert.equal(ctx.campaigns[0].used,true);assert.equal(ctx.campaigns[1].used,false);
 assert.equal(quote(selections(0,3),[...historical,used]).totalCents,3980);
 const bHistory=[paid(B,0),paid(B,1),paid(B,2)],all=[...historical,...bHistory];
 const gifts=quote([{kind:'product',id:`${N}-5`},{kind:'product',id:`${B}-5`}],all);
 assert.equal(gifts.totalCents,0);assert.equal(promotionEntries(gifts.natalPromotion).length,2);
 const giftOrder={id:'gifts',memberId:'member',status:'paid',...gifts};
 assert.equal(natalProductAccess(giftOrder,`${B}-5`,all),true);
 all[0].status='refunded';assert.equal(natalProductAccess(giftOrder,`${N}-5`,all),false);assert.equal(natalProductAccess(giftOrder,`${B}-5`,all),true);
 assert.equal(natalProductAccess(used,`${N}-4`,all),false,'legacy entitlement still validated');
 const reserved={...giftOrder,status:'pending'};
 const states=context([reserved]);assert.ok(states.campaigns.every(s=>s.reserved));
});
test('reservations for one collection do not block the other, mixed reservations block both',()=>{
 const old=process.env.ASAAS_ENVIRONMENT;process.env.ASAAS_ENVIRONMENT='sandbox';
 try{
 const pending={id:'pending',memberId:'member',provider:'asaas',environment:'sandbox',status:'pending',totalCents:2985,items:selections(2,0),natalPromotion:{id:campaignId(N),collectionId:N}};
 assert.equal(natalReservation([pending],'member',data,{items:selections(0,3),expectedTotalCents:3980},'asaas','sandbox'),null);
 assert.equal(natalReservation([pending],'member',data,{items:selections(2,0),expectedTotalCents:2985},'asaas','sandbox').id,'pending');
 assert.throws(()=>natalReservation([pending],'member',data,{items:selections(1,2),expectedTotalCents:4975},'asaas','sandbox'),/reservada/);
 const states=memberNatalState([pending],'member',data,now);assert.equal(states.campaigns[0].reserved,true);assert.equal(states.campaigns[1].reserved,false);
 }finally{if(old===undefined)delete process.env.ASAAS_ENVIRONMENT;else process.env.ASAAS_ENVIRONMENT=old;}
});
