import test from 'node:test';
import assert from 'node:assert/strict';
import {filterMakerLicenses,licenseCounts,licenseDateKey} from '../lib/admin-maker-licenses.mjs';
const rows=[{memberId:'a',name:'José',email:'j@example.test',whatsapp:'5582999999999',active:true,status:'active',provider:'asaas',validUntil:'2027-01-02T01:00:00Z',daysRemaining:4},{memberId:'b',name:'Ana',active:true,status:'active',provider:'paypal',validUntil:'2027-02-02T12:00:00Z',daysRemaining:35},{memberId:'c',name:'Caio',active:false,status:'failed',validUntil:null,daysRemaining:null},{memberId:'d',name:'Dani',active:false,status:'expired',validUntil:'2026-10-01T12:00:00Z',daysRemaining:-1},{memberId:'e',name:'Eli',active:false,status:'pending',validUntil:null,daysRemaining:null}];
test('license filters distinguish active, due, expired and failed/pending attempts without mixing missing expiry dates',()=>{
 assert.deepEqual(licenseCounts(rows),{all:5,active:2,due:1,expired:1,attempt:2});
 assert.deepEqual(filterMakerLicenses(rows,{status:'active',provider:'paypal'}).map(r=>r.memberId),['b']);
 assert.deepEqual(filterMakerLicenses(rows,{query:'jose',validity:'7'}).map(r=>r.memberId),['a']);
 assert.deepEqual(filterMakerLicenses(rows,{status:'attempt',validity:'none'}).map(r=>r.memberId),['c','e']);
 assert.deepEqual(filterMakerLicenses(rows,{from:'2027-01-01',to:'2027-01-01'}).map(r=>r.memberId),['a']);
 assert.equal(licenseDateKey(rows[0].validUntil),'2027-01-01');
 assert.deepEqual(filterMakerLicenses(rows,{validity:'expired'}).map(r=>r.memberId),['d']);
 assert.deepEqual(filterMakerLicenses(rows,{status:'active',sort:'name'}).map(r=>r.memberId),['b','a']);
});
