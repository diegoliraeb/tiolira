import test from 'node:test';
import assert from 'node:assert/strict';
import {filterLibrary,membershipSummary,subscriberExclusive} from '../lib/club-library.mjs';
import {clubProducts} from '../server/club.mjs';
import seed from '../data/catalog.json' with {type:'json'};
const group={id:'saints',name:'Coração e Fé',published:true};
const base={...seed.products[0],published:true,collection:group.id,exclusive:false,filePath:'models/private.3mf',url:'',printProfiles:[],allowPhysicalSales:false};
const data={...seed,collections:[group],products:[
 {...base,id:'own',name:'São José',access:'paid',includedInSubscription:false,priceCents:1990},
 {...base,id:'included',name:'Santa Rita',access:'paid',includedInSubscription:true,priceCents:1990},
 {...base,id:'exclusive',name:'Nossa Senhora',access:'subscribers',priceCents:0}
]};
test('library search matches accented artwork and collection names; filters distinguish purchase, included and exclusive',()=>{
 const items=clubProducts(data,new Set(['own']),true),opts={purchasedIds:new Set(['own']),availableOnly:true};
 assert.deepEqual(filterLibrary(items,[group],{...opts,query:'sao jose'}).map(p=>p.id),['own']);
 assert.equal(filterLibrary(items,[group],{...opts,query:'coracao e fe'}).length,3);
 assert.deepEqual(filterLibrary(items,[group],{...opts,filter:'purchased'}).map(p=>p.id),['own']);
 assert.deepEqual(filterLibrary(items,[group],{...opts,filter:'included'}).map(p=>p.id),['included','exclusive']);
 assert.deepEqual(filterLibrary(items,[group],{...opts,filter:'exclusive'}).map(p=>p.id),['exclusive']);
 assert.equal(filterLibrary(items,[group],{...opts,collection:'other'}).length,0);
 assert.equal(subscriberExclusive({...data.products[2],exclusive:true}),false);
});
test('an included badge never grants a download: library follows server entitlement and retains purchased files after expiry',()=>{
 const inactive=clubProducts(data,new Set(),false),active=clubProducts(data,new Set(),true),expiredBuyer=clubProducts(data,new Set(['own']),false);
 assert.equal(filterLibrary(inactive,[group],{availableOnly:true}).length,0);
 assert.equal(filterLibrary(inactive,[group],{filter:'included'}).length,2);
 assert.deepEqual(filterLibrary(active,[group],{availableOnly:true}).map(p=>p.id),['included','exclusive']);
 assert.deepEqual(filterLibrary(expiredBuyer,[group],{availableOnly:true}).map(p=>p.id),['own']);
 assert.ok(!JSON.stringify(active).includes('models/private'));
});
test('membership bar exposes only status and validity, distinguishing unpaid attempts from active rights',()=>{
 const secret={purchase:{customerId:'private'},external:{invite:'private'},providers:{asaas:true}};
 assert.deepEqual(membershipSummary({...secret,active:true,validUntil:'2027-11-23T00:00:00Z',status:'paid'}),{active:true,validUntil:'2027-11-23T00:00:00Z',status:'paid',pending:false});
 assert.equal(membershipSummary({...secret,active:false,status:'pending'}).pending,true);
 assert.equal(membershipSummary({...secret,active:false,legacyPending:true}).pending,true);
 assert.equal(membershipSummary({...secret,active:false,status:'paid'}).pending,false);
 assert.equal(membershipSummary({...secret,active:false,status:'none'}).active,false);
});
