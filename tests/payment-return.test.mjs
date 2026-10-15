import test from 'node:test';
import assert from 'node:assert/strict';
import {returnedPaymentId,reconcilePayment} from '../lib/payment-return.mjs';
const id='a1234567-1234-1234-1234-123456789012';
test('return marker identifies a valid order without treating the URL as approval',()=>{
 assert.equal(returnedPaymentId(`?pedido=${id}&retorno=asaas`),id);
 for(const query of [`?pedido=${id}`,`?pedido=${id}&retorno=other`,'?pedido=evil&retorno=asaas','?pedido=------------------------------------&retorno=asaas'])assert.equal(returnedPaymentId(query),null);
});
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function harness(read){
 const jobs=[],received=[],errors=[];let done=0;
 const stop=reconcilePayment({read,onPayment:r=>received.push(r.order.status),onError:e=>errors.push(e.message),onDone:()=>done++,schedule:(fn,delay)=>{assert.equal(delay,3000);jobs.push(fn);return fn;},cancel:fn=>{const i=jobs.indexOf(fn);if(i>=0)jobs.splice(i,1);}});
 return {jobs,received,errors,stop,get done(){return done;},next:async()=>{await jobs.shift()();await tick();}};
}
test('a delayed approval is reconciled until paid, then polling stops',async()=>{
 const statuses=['pending','review','paid'];const h=harness(async()=>({order:{status:statuses.shift()}}));await tick();
 assert.deepEqual(h.received,['pending']);await h.next();await h.next();
 assert.deepEqual(h.received,['pending','review','paid']);assert.equal(h.done,1);assert.equal(h.jobs.length,0);
});
test('temporary network failure retries, but pending checks have a finite limit',async()=>{
 let calls=0;const h=harness(async()=>{if(++calls===1)throw Error('network');return {order:{status:'pending'}}});await tick();
 while(h.jobs.length)await h.next();
 assert.equal(calls,6);assert.deepEqual(h.errors,['network']);assert.equal(h.done,1);assert.ok(h.received.every(s=>s==='pending'));
});
test('leaving the order cancels scheduled work and ignores a late response',async()=>{
 let resolve;const h=harness(()=>new Promise(r=>resolve=r));h.stop();resolve({order:{status:'paid'}});await tick();
 assert.deepEqual(h.received,[]);assert.equal(h.jobs.length,0);assert.equal(h.done,0);
 const pending=harness(async()=>({order:{status:'pending'}}));await tick();assert.equal(pending.jobs.length,1);pending.stop();assert.equal(pending.jobs.length,0);
});
test('terminal rejection or refund ends reconciliation without granting files',async()=>{
 for(const status of ['failed','revoked','cancelled']){const h=harness(async()=>({order:{status}}));await tick();assert.deepEqual(h.received,[status]);assert.equal(h.jobs.length,0);assert.equal(h.done,1);}
});
