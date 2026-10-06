import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import handler from '../server/handler.mjs';
import {readRecord} from '../server/store.mjs';
import {publicCatalog} from '../server/schema.mjs';
import {matchesStore} from '../lib/store-search.mjs';
import seed from '../data/catalog.json' with {type:'json'};

test('registration without models persists pending, preserves privacy and becomes discoverable only after approval',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'tiolira-registration-'));
 const envKeys=['DATABASE_URL','POSTGRES_URL','BLOB_READ_WRITE_TOKEN','LOCAL_DATA_DIR','ADMIN_SESSION_SECRET','VERCEL'];
 const saved=Object.fromEntries(envKeys.map(k=>[k,process.env[k]]));
 for(const key of envKeys)delete process.env[key];
 process.env.LOCAL_DATA_DIR=dir;process.env.ADMIN_SESSION_SECRET='registration-test-only-secret-at-least-32-characters';
 const call=async(body)=>{
  let response;
  await handler({url:'/api/stores/apply',method:'POST',headers:{host:'localhost',origin:'http://localhost'},socket:{remoteAddress:'test'},body},{setHeader(){},set statusCode(value){this.status=value},end(value){response={status:this.status,body:JSON.parse(value)}}});
  return response;
 };
 const input={name:'Teste de cadastro',city:'Maceió',state:'AL',country:'Brasil',email:'test@example.invalid',whatsapp:'5582000000000',description:'Teste',delivery:'Retirada',consent:true};
 try{
  const invalid=await call({...input,consent:false});assert.equal(invalid.status,400);assert.equal(await readRecord('catalog.json'),null);
  const response=await call(input);assert.equal(response.status,201);assert.equal(response.body.ok,true);
  const {data}=await readRecord('catalog.json');assert.equal(data.stores.length,1);
  const store=data.stores[0];assert.deepEqual(store.productIds,[]);assert.equal(store.status,'pending');assert.equal(store.partnershipConsent,false);
  assert.equal(publicCatalog(data).stores.length,0);
  store.status='approved';
  const published=publicCatalog(data).stores[0];assert.equal(published.offeringsUnspecified,true);assert.ok(!('email' in published));assert.ok(!('partnershipConsent' in published));
  assert.equal(matchesStore(published,'maceio','all',seed.products),true);
  assert.equal(matchesStore(published,'maceio','collection:presepio',seed.products),true);
  assert.equal(matchesStore(published,'maceio',seed.products[0].id,seed.products),true);
  assert.equal(matchesStore(published,'Recife','all',seed.products),false);
  assert.equal(matchesStore(published,'','unknown',seed.products),false);
  assert.equal(matchesStore(published,'','collection:unknown',seed.products),false);
  for(const c of data.collections)if(c.id!=='presepio')c.free=false;
  store.productIds=[seed.products.find(p=>p.collection!=='presepio').id];store.licenseProof='';store.licenseUntil='';
  assert.equal(publicCatalog(data).stores.length,0,'expired or unauthorized offerings must not become unspecified');
 }finally{for(const key of envKeys){if(saved[key]===undefined)delete process.env[key];else process.env[key]=saved[key]}await rm(dir,{recursive:true,force:true})}
});
