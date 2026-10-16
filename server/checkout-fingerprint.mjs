import {createHash} from 'node:crypto';
// Keep legacy hashes for unchanged carts so existing pending payments are reused.
export function checkoutFingerprint(quote,provider='asaas'){
 const items=quote.promotion?.percent?quote.items:quote.items.map(i=>({kind:i.kind,id:i.id,name:i.name,priceCents:i.priceCents,products:i.products,...(quote.coupon?{discountCents:i.discountCents,totalCents:i.totalCents}:{})}));
 const payload=quote.promotion?.percent?{items,coupon:quote.coupon,promotion:quote.promotion}:provider==='paypal'||quote.coupon?{items,coupon:quote.coupon}:items;
 return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}
