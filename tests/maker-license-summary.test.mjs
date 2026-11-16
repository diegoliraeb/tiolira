import test from 'node:test';
import assert from 'node:assert/strict';
import {licenseSummary} from '../server/maker-renewals.mjs';
test('dashboard separates active subscribers, confirmed renewals and BRL/USD revenue, excluding failed and refunded payments',()=>{
 const people=[{memberId:'a',active:true},{memberId:'a',active:true},{memberId:'b',active:false}];
 const purchases=[{id:'1',provider:'asaas',paymentId:'pay_1',status:'paid',currency:'BRL',totalCents:4990},{id:'2',provider:'asaas',paymentId:'pay_2',status:'paid',currency:'BRL',totalCents:4990},{id:'3',provider:'paypal',paymentId:'usd1',status:'paid',currency:'USD',totalCents:832},...['failed','pending','revoked'].map(status=>({id:status,status,currency:'BRL',totalCents:4990}))];
 const legacy=[{provider:'asaas',confirmedPayments:[{id:'pay_1',currency:'BRL',totalCents:4990},{id:'old',currency:'BRL',totalCents:4990}]}];
 assert.deepEqual(licenseSummary(people,purchases,legacy),{activeSubscribers:1,confirmedPurchases:4,totalCents:14970,totalUsdCents:832});
 assert.deepEqual(licenseSummary([],[],[]),{activeSubscribers:0,confirmedPurchases:0,totalCents:0,totalUsdCents:0});
});
