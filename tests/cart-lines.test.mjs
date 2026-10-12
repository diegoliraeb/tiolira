import test from 'node:test';
import assert from 'node:assert/strict';
import {cartSelection} from '../lib/cart-lines.mjs';

test('cart header and checkout share totals, deduplicate bundles and omit unavailable or owned items',()=>{
 const data={products:[{id:'curupira',priceCents:1790},{id:'saci',priceCents:1490},{id:'owned',priceCents:1490,owned:true}],collections:[{id:'folclore',priceCents:4990,productIds:['curupira','saci']}]};
 const product=id=>({kind:'product',id});
 let result=cartSelection(data,[product('curupira'),product('curupira'),product('missing'),product('owned')]);
 assert.equal(result.lines.length,1);assert.equal(result.total,1790);
 result=cartSelection(data,[product('curupira'),{kind:'collection',id:'folclore'},product('saci')]);
 assert.equal(result.lines.length,1);assert.equal(result.total,4990);
 assert.equal(cartSelection(data,[]).total,0);assert.equal(cartSelection(null,[product('curupira')]).total,0);
});
