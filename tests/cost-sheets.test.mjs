import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {readRecord,writeRecord,getCatalog} from '../server/store.mjs';
import {makeSession} from '../server/auth.mjs';
import {artworkDefaults,workshopKeys,calculateArtwork} from '../lib/calculator.mjs';
import handler from '../server/handler.mjs';
import seed from '../data/catalog.json' with {type:'json'};
test('private cost sheets persist per account without touching catalog or commerce',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'tiolira-cost-test-'));
 const keys=['DATABASE_URL','POSTGRES_URL','VERCEL','BLOB_READ_WRITE_TOKEN','LOCAL_DATA_DIR','ADMIN_SESSION_SECRET'];
 const env=Object.fromEntries(keys.map(k=>[k,process.env[k]]));for(const k of keys)delete process.env[k];
 Object.assign(process.env,{LOCAL_DATA_DIR:dir,ADMIN_SESSION_SECRET:'cost-sheet-test-secret-not-production-123456'});
 const a={id:randomUUID(),version:randomUUID(),name:'Ana',email:'ana@example.invalid'},b={id:randomUUID(),version:randomUUID(),name:'Bruno',email:'bruno@example.invalid'};
 const ca=`tiolira_club=${await makeSession(a.version,{memberId:a.id})}`,cb=`tiolira_club=${await makeSession(b.version,{memberId:b.id})}`;
 const call=async({method='GET',body={},cookie=ca,origin='http://localhost'}={})=>{let result,headers={};await handler({method,url:'/api/club/cost-sheets',body,headers:{host:'localhost',origin,cookie},socket:{remoteAddress:'cost-test'}},{setHeader(k,v){headers[k]=v;},set statusCode(s){this.status=s;},end(v){result={status:this.status||200,body:JSON.parse(v),headers};}});return result;};
 const post=body=>call({method:'POST',body});
 const product=seed.products.find(p=>p.published&&seed.collections.some(c=>c.id===p.collection&&c.published));
 const sheet={action:'sheet',revision:null,productId:product.id,values:{...artworkDefaults},channel:'card',offer:39.9};
 let revision;
 try{
 await writeRecord('catalog.json',seed,null);await writeRecord('club-members.json',{members:[a,b]},null);await writeRecord('commerce.json',{orders:[],downloads:{},recentDownloads:[]},null);
 await getCatalog();
 const originalCatalog=await readRecord('catalog.json'),originalCommerce=await readRecord('commerce.json');
 await t.test('requires login and same-origin requests',async()=>{
  assert.equal((await call({cookie:''})).status,401);assert.equal((await call({method:'POST',cookie:'',body:sheet})).status,401);
  assert.equal((await call({method:'POST',origin:'https://evil.invalid',body:sheet})).status,403);
  const r=await call();assert.equal(r.status,200);assert.deepEqual(r.body,{profile:null,sheets:[],revision:null});assert.match(r.headers['Cache-Control'],/no-store/);
 });
 await t.test('saves values and recomputes result; forged member and price are ignored',async()=>{
  const r=await post({...sheet,memberId:b.id,result:{price:1}});assert.equal(r.status,200);revision=r.body.revision;assert.ok(revision);
  assert.deepEqual(r.body.sheets[0].result,calculateArtwork(artworkDefaults));assert.deepEqual(r.body.sheets[0].values,artworkDefaults);
  assert.equal((await call({cookie:cb})).body.sheets.length,0);assert.equal((await call()).body.sheets[0].productId,product.id);
 });
 await t.test('stale tabs cannot overwrite newer sheets',async()=>{
  assert.equal((await post(sheet)).status,409);assert.equal((await call()).body.revision,revision);
  const r=await post({...sheet,revision,values:{...artworkDefaults,grams:200}});assert.equal(r.status,200);revision=r.body.revision;assert.equal(r.body.sheets.length,1);assert.equal(r.body.sheets[0].values.grams,200);
 });
 await t.test('workshop defaults persist separately and preserve saved calculations',async()=>{
  const profile=Object.fromEntries(workshopKeys.map(k=>[k,artworkDefaults[k]]));profile.kgPrice=150;
  const r=await post({action:'profile',revision,profile});assert.equal(r.status,200);revision=r.body.revision;
  assert.equal(r.body.profile.kgPrice,150);assert.equal(r.body.sheets[0].values.kgPrice,120);
  assert.equal((await call({cookie:cb})).body.profile,null);assert.equal((await call()).body.profile.kgPrice,150);
 });
 await t.test('rejects invalid data, invalid percentages and unavailable works',async()=>{
  for(const values of [{...artworkDefaults,grams:-1},{...artworkDefaults,fee:60},{...artworkDefaults,failure:100},{...artworkDefaults,minutes:null}])assert.equal((await post({...sheet,revision,values})).status,400);
  assert.equal((await post({...sheet,revision,productId:'missing-work'})).status,404);
  assert.equal((await post({...sheet,revision,productId:'../other-account'})).status,400);
  assert.equal((await post({...sheet,revision,offer:-1})).status,400);
  assert.equal((await post({action:'profile',revision,profile:{failure:100}})).status,400);
 });
 await t.test('custom pieces have separate named sheets and remain private',async()=>{
  const r=await post({...sheet,revision,productId:null,customName:'Vaso da oficina'});assert.equal(r.status,200);revision=r.body.revision;const id=r.body.sheets[0].customId;assert.ok(id);assert.equal(r.body.sheets[0].productName,'Vaso da oficina');
  const second=await post({...sheet,revision,productId:null,customName:'Porta-lápis'});assert.equal(second.status,200);revision=second.body.revision;assert.equal(second.body.sheets.length,3);
  const edit=await post({...sheet,revision,productId:null,customId:id,customName:'Vaso grande',values:{...artworkDefaults,grams:300}});assert.equal(edit.status,200);revision=edit.body.revision;assert.equal(edit.body.sheets.length,3);assert.equal(edit.body.sheets[0].values.grams,300);assert.equal(edit.body.sheets[0].productName,'Vaso grande');
  assert.equal((await call({cookie:cb})).body.sheets.length,0);
  assert.equal((await post({...sheet,revision,productId:null,customName:'  '})).status,400);
  assert.equal((await post({...sheet,revision,productId:null})).status,400);
 });
 await t.test('groups save quantities, restore privately and update without replacing individual sheets',async()=>{
  const products=seed.products.filter(p=>p.published&&seed.collections.some(c=>c.id===p.collection&&c.published));
  const items=products.slice(0,2).map((p,i)=>({productId:p.id,quantity:i+2}));
  const before=(await call()).body.sheets.length;
  const r=await post({...sheet,revision,productId:null,items,values:{...artworkDefaults,grams:451.67,hours:27.3592}});assert.equal(r.status,200);revision=r.body.revision;const groupId=r.body.sheets[0].groupId;
  assert.ok(groupId);assert.deepEqual(r.body.sheets[0].items,items);assert.equal(r.body.sheets.length,before+1);assert.equal(r.body.sheets[0].values.grams,451.67);
  assert.deepEqual((await call()).body.sheets[0].items,items);assert.equal((await call({cookie:cb})).body.sheets.length,0);
  const edit=await post({...sheet,revision,productId:null,groupId,items:[items[1]]});assert.equal(edit.status,200);revision=edit.body.revision;assert.equal(edit.body.sheets.length,before+1);assert.deepEqual(edit.body.sheets[0].items,[items[1]]);
  assert.ok(edit.body.sheets.some(s=>s.productId===product.id));
  for(const invalid of [[],[{productId:product.id,quantity:0}],[{productId:product.id,quantity:1.5}],[{productId:product.id,quantity:1000}],[items[0],items[0]]])assert.equal((await post({...sheet,revision,productId:null,items:invalid})).status,400);
  assert.equal((await post({...sheet,revision,productId:null,items:[{productId:'missing',quantity:1}]})).status,404);
  assert.equal((await post({...sheet,revision,items})).status,400);
  assert.equal((await post({...sheet,revision,productId:null,items,customName:'conflict'})).status,400);
  assert.equal((await post({...sheet,revision,groupId})).status,400);
 });
 await t.test('catalog prices, orders, downloads and licenses are unchanged',async()=>{
  assert.deepEqual(await readRecord('catalog.json'),originalCatalog);assert.deepEqual(await readRecord('commerce.json'),originalCommerce);
 });
 }finally{for(const [k,v] of Object.entries(env)){if(v===undefined)delete process.env[k];else process.env[k]=v;}await rm(dir,{recursive:true,force:true});}
});
