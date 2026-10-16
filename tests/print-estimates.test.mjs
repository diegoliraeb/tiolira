import test from 'node:test';
import assert from 'node:assert/strict';
import estimates from '../data/print-estimates.json' with {type:'json'};
import {productPrintEstimate} from '../lib/print-estimates.mjs';
import {publicCatalog} from '../server/schema.mjs';
import {clubProducts} from '../server/club.mjs';
import seed from '../data/catalog.json' with {type:'json'};
test('validated print reference is identical publicly and privately and tied to the model revision',()=>{
 for(const [id,e] of Object.entries(estimates)){
  const p={id,name:id,published:true,collection:'print-test',access:e.filePath?'paid':'maker',filePath:e.filePath,url:e.url,priceCents:1290,gallery:[],image:'',releaseAt:''};
  const catalog={...seed,collections:[{id:'print-test',published:true,free:false}],products:[p],stores:[]};
  const pub=publicCatalog(catalog).products[0],privateP=clubProducts(catalog)[0];
  assert.deepEqual(pub.printEstimate,privateP.printEstimate);assert.equal(pub.printEstimate.grams,e.grams);assert.equal(pub.printEstimate.hours,e.seconds/3600);
  assert.equal(productPrintEstimate({...p,filePath:'models/new-version.3mf'}),null);
  assert.equal(productPrintEstimate({...p,url:'https://example.invalid/new-profile'}),null);
  assert.ok(!JSON.stringify(pub.printEstimate).includes('models/'));assert.ok(!JSON.stringify(pub.printEstimate).includes('/Users/'));
 }
 assert.equal(productPrintEstimate({id:'missing'}),null);
});
test('imported totals are complete finite estimates, with profile and source provenance',()=>{
 assert.ok(Object.keys(estimates).length>0,'The verified reference catalog must not be empty');
 for(const e of Object.values(estimates)){assert.ok(Number.isFinite(e.grams)&&e.grams>0);assert.ok(Number.isInteger(e.seconds)&&e.seconds>0);assert.ok(Number.isInteger(e.plates)&&e.plates>0);assert.ok(e.printer&&e.source&&e.checkedAt);}
});
