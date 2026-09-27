import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {isAvailable,sortProducts} from '../lib/product-order.mjs';
import handler from '../server/handler.mjs';
import {getCatalog,readRecord,writeRecord} from '../server/store.mjs';

test('available works precede unreleased works regardless of clicks, with popularity within each group',()=>{
 const products=[
  {id:'soon-popular',access:'soon',url:'https://example.com',clickCount:900,order:0},
  {id:'missing-download',access:'site',url:'',clickCount:500},
  {id:'available-less',access:'maker',url:'https://makerworld.com/en',clickCount:3,order:0},
  {id:'available-most',access:'site',hasFile:true,clickCount:20,order:10},
  {id:'new',access:'site',url:'https://example.com',order:1}
 ];
 assert.deepEqual(sortProducts(products).map(p=>p.id),['available-most','available-less','new','soon-popular','missing-download']);
 assert.equal(products[0].id,'soon-popular');assert.equal(isAvailable(products[1]),false);
 assert.deepEqual(sortProducts([{...products[2],id:'b',order:2},{...products[2],id:'a',order:1}]).map(p=>p.id),['a','b']);
});

test('real catalog clicks persist separately, deduplicate, reject hidden products and cannot set arbitrary counts',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'tiolira-clicks-'));
 const keys=['DATABASE_URL','POSTGRES_URL','BLOB_READ_WRITE_TOKEN','LOCAL_DATA_DIR','ADMIN_SESSION_SECRET','VERCEL'];
 const saved=Object.fromEntries(keys.map(k=>[k,process.env[k]]));for(const k of keys)delete process.env[k];
 process.env.LOCAL_DATA_DIR=dir;process.env.ADMIN_SESSION_SECRET='local-test-only-click-secret-at-least-32-characters';
 const call=async(method,body,ip='visitor-one',origin='http://localhost',agent='Test Browser')=>{
  const result={};await handler({url:method==='GET'?'/api/catalog':'/api/products/click',method,body,headers:{host:'localhost',origin,'user-agent':agent},socket:{remoteAddress:ip}},{setHeader(){},set statusCode(v){result.status=v},end(v){result.body=JSON.parse(v)}});return result;
 };
 try{
  const catalog=await getCatalog();const available=catalog.data.products.filter(isAvailable),a=available[0],b=available[1];
  catalog.data.products.push({...a,id:'hidden-test',slug:'hidden-test',published:false});
  const revision=await writeRecord('catalog.json',catalog.data,null);
  assert.equal((await call('POST',{id:b.id,count:9999})).status,200);
  await call('POST',{id:b.id});
  assert.equal((await call('GET')).body.products.find(p=>p.id===b.id).clickCount,1);
  await call('POST',{id:b.id},'visitor-two');await call('POST',{id:a.id});
  let output=(await call('GET')).body;assert.equal(output.products[0].id,b.id);assert.equal(output.products[0].clickCount,2);
  assert.equal((await call('POST',{id:'hidden-test'})).status,404);
  assert.equal((await call('POST',{id:'unknown'})).status,404);
  assert.equal((await call('POST',{id:'../bad'})).status,400);
  assert.equal((await call('POST',{id:b.id},'bad','https://other.test')).status,403);
  await call('POST',{id:b.id},'bot','http://localhost','Googlebot');
  assert.equal((await call('GET')).body.products[0].clickCount,2);
  const stored=await readRecord('analytics/product-clicks.json');assert.ok(!JSON.stringify(stored).includes('visitor-one'));
  assert.ok(!JSON.stringify(output).includes('recent'));assert.equal((await getCatalog()).etag,revision);
  const expired={...stored.data,recent:Object.fromEntries(Object.keys(stored.data.recent).map(k=>[k,0]))};
  await writeRecord('analytics/product-clicks.json',expired,stored.etag);await call('POST',{id:b.id});
  assert.equal((await call('GET')).body.products[0].clickCount,3);
 }finally{for(const k of keys){if(saved[k]===undefined)delete process.env[k];else process.env[k]=saved[k]}await rm(dir,{recursive:true,force:true})}
});
