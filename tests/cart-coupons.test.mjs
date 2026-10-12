import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {cartCouponSchema,discountQuote} from '../server/cart-coupons.mjs';
const coupon=cartCouponSchema.parse({id:randomUUID(),code:' folclore10 ',type:'percent',value:10,active:true});
const quote={totalCents:1790,items:[{priceCents:1790}],productIds:['curupira']};
test('cart coupon percentage, fixed amount, normalization and cent allocation',()=>{
 assert.equal(coupon.code,'FOLCLORE10');const q=discountQuote(quote,' folclore10 ',[coupon]);assert.equal(q.discountCents,179);assert.equal(q.totalCents,1611);assert.equal(q.items[0].totalCents,1611);
 assert.equal(discountQuote(quote,coupon.code,[{...coupon,type:'fixed',value:500}]).totalCents,1290);
 const many={totalCents:1039,items:[{priceCents:1000},...Array.from({length:39},()=>({priceCents:1}))]};const discounted=discountQuote(many,coupon.code,[{...coupon,value:99}]);assert.equal(discounted.items.reduce((n,x)=>n+x.totalCents,0),discounted.totalCents);assert.ok(discounted.items.every(x=>x.totalCents>=0));
 assert.equal(discountQuote(quote,'',[]).totalCents,1790);
});
test('reject invalid, expired, inactive, insufficient carts and zero totals',()=>{
 assert.throws(()=>discountQuote(quote,'MISSING',[coupon]),/inválido/);
 assert.throws(()=>discountQuote(quote,coupon.code,[{...coupon,active:false}]),/inativo/);
 assert.throws(()=>discountQuote(quote,coupon.code,[{...coupon,expiresAt:'2020-01-01T00:00:00.000Z'}]),/expirou/);
 assert.throws(()=>discountQuote(quote,coupon.code,[{...coupon,minimumCents:2000}]),/mínima/);
 assert.throws(()=>discountQuote(quote,coupon.code,[{...coupon,type:'fixed',value:1790}]),/maior que zero/);
 assert.equal(cartCouponSchema.safeParse({...coupon,value:100}).success,false);
 assert.equal(cartCouponSchema.safeParse({...coupon,expiresAt:'invalid'}).success,false);
 assert.equal(cartCouponSchema.safeParse({...coupon,value:-1}).success,false);
});
