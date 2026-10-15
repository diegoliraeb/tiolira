import test from 'node:test';
import assert from 'node:assert/strict';
import {cartSelection,collectionOffers,collectionUpsells,addCartOffer} from '../lib/cart-lines.mjs';

test('cart header and checkout share totals, deduplicate bundles and omit unavailable or owned items',()=>{
 const data={products:[{id:'curupira',priceCents:1790},{id:'saci',priceCents:1490},{id:'owned',priceCents:1490,owned:true}],collections:[{id:'folclore',priceCents:4990,productIds:['curupira','saci']}]};
 const product=id=>({kind:'product',id});
 let result=cartSelection(data,[product('curupira'),product('curupira'),product('missing'),product('owned')]);
 assert.equal(result.lines.length,1);assert.equal(result.total,1790);
 result=cartSelection(data,[product('curupira'),{kind:'collection',id:'folclore'},product('saci')]);
 assert.equal(result.lines.length,1);assert.equal(result.total,4990);
 assert.equal(cartSelection(data,[]).total,0);assert.equal(cartSelection(null,[product('curupira')]).total,0);
});

test('bundle suggestion uses the full collection saving and upgrade replaces only its singles',()=>{
 const data={products:['saci','curupira','boitata','cuca','mula'].map(id=>({id,priceCents:1690})),collections:[{id:'folclore',priceCents:6990,productIds:['saci','curupira','boitata','cuca','mula']}]};
 data.products.push({id:'other',priceCents:1290});
 const cart=[{kind:'product',id:'saci'},{kind:'product',id:'curupira'},{kind:'product',id:'other'}];
 const [offer]=collectionUpsells(data,cart);
 assert.equal(offer.individualTotalCents,8450);assert.equal(offer.savingsCents,1460);
 const upgraded=addCartOffer(cart,offer);
 assert.deepEqual(upgraded,[{kind:'product',id:'other'},{kind:'collection',id:'folclore'}]);
 assert.equal(cartSelection(data,upgraded).total,8280);
 assert.deepEqual(collectionUpsells(data,upgraded),[]);
 assert.deepEqual(addCartOffer(upgraded,offer),upgraded);
 assert.deepEqual(collectionUpsells(data,[]),[]);
 data.collections[0].owned=true;assert.deepEqual(collectionUpsells(data,cart),[]);
 data.collections[0].owned=false;data.collections[0].priceCents=9000;assert.deepEqual(collectionUpsells(data,cart),[]);
 data.products.pop();data.products.pop();assert.equal(collectionOffers(data)[0].savingsCents,0);
 assert.deepEqual(collectionOffers(null),[]);
});
test('bundle savings respect USD prices and do not invent an exchange rate',()=>{
 const data={products:[{id:'a',priceCents:282},{id:'b',priceCents:282}],collections:[{id:'set',priceCents:490,productIds:['a','b']}]};
 assert.equal(collectionUpsells(data,[{id:'a',kind:'product'}])[0].savingsCents,74);
});
