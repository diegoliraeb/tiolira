// Stable catalog identifier: Esculturas Sagrada Família. Never match names/slugs.
export const FAMILY_COLLECTION_ID='de1d16c4-5306-4f91-8696-fa0d512a5dbf';
export const FAMILY_PROMOTION_ID='sagrada-familia-progressive-v1';
export const MAX_CART_QUANTITY=100;
export const familyEligible=item=>item.kind==='product'&&item.collection===FAMILY_COLLECTION_ID&&item.priceCents>0;
export const discountPercent=quantity=>Math.min(Math.max(quantity-1,0)*5,40);
export function cartQuantity(item){return Number.isSafeInteger(item.quantity)&&item.quantity>=1&&item.quantity<=MAX_CART_QUANTITY?item.quantity:1;}
// Largest-remainder allocation keeps each line and the payment exact to the cent.
export function allocateDiscount(items,discountCents,eligible=()=>true){
 const subtotal=items.reduce((n,item)=>n+(eligible(item)?item.priceCents:0),0);
 const allocations=items.map((item,index)=>({index,cents:eligible(item)&&subtotal?Math.floor(discountCents*item.priceCents/subtotal):0,remainder:eligible(item)&&subtotal?(discountCents*item.priceCents)%subtotal:-1}));
 let remaining=discountCents-allocations.reduce((n,a)=>n+a.cents,0);
 for(const a of [...allocations].sort((a,b)=>b.remainder-a.remainder||a.index-b.index)){if(!remaining)break;if(a.remainder<0)continue;a.cents++;remaining--;}
 return allocations.map(a=>a.cents);
}
export function applyFamilyDiscount(quote){
 const items=quote.items,eligible=items.filter(familyEligible),quantity=eligible.reduce((n,item)=>n+cartQuantity(item),0);
 const subtotalCents=items.reduce((n,item)=>n+item.priceCents,0),eligibleSubtotalCents=eligible.reduce((n,item)=>n+item.priceCents,0),percent=discountPercent(quantity),discountCents=Math.round(eligibleSubtotalCents*percent/100);
 const allocation=allocateDiscount(items,discountCents,familyEligible);
 return {...quote,items:items.map((item,i)=>({...item,discountCents:allocation[i],totalCents:item.priceCents-allocation[i]})),subtotalCents,discountCents,totalCents:subtotalCents-discountCents,coupon:null,couponDiscountCents:0,promotion:quantity?{id:FAMILY_PROMOTION_ID,collectionId:FAMILY_COLLECTION_ID,quantity,percent,subtotalCents:eligibleSubtotalCents,discountCents,totalCents:eligibleSubtotalCents-discountCents}:null};
}
