import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import handler from '../server/handler.mjs';
import {encodeLogo} from '../server/store-logo.mjs';
import {readRecord,writeRecord} from '../server/store.mjs';
import {makeSession,cookieName} from '../server/auth.mjs';

const png=async()=>`data:image/png;base64,${(await sharp({create:{width:1000,height:600,channels:4,background:{r:64,g:73,b:52,alpha:0.5}}}).png().toBuffer()).toString('base64')}`;
test('logos are resized to a bounded raster while keeping transparency',async()=>{
 const output=await encodeLogo(await png());const meta=await sharp(Buffer.from(output.base64,'base64')).metadata();
 assert.equal(output.contentType,'image/webp');assert.equal(meta.format,'webp');assert.equal(meta.width,512);assert.ok(meta.height<=512);assert.equal(meta.hasAlpha,true);
});
test('logos reject SVG disguised as PNG, corrupt images, oversized data and oversized pixel dimensions',async()=>{
 for(const data of ['data:image/svg+xml;base64,PHN2Zy8+','data:image/png;base64,PHN2Zy8+','data:image/png;base64,AAAA','data:image/png;base64,'+'A'.repeat(2_800_000)])await assert.rejects(encodeLogo(data),{code:'INVALID_LOGO'});
 const huge=await sharp({create:{width:5000,height:4000,channels:3,background:'white'}}).png().toBuffer();
 await assert.rejects(encodeLogo(`data:image/png;base64,${huge.toString('base64')}`),{code:'INVALID_LOGO'});
});
test('registration stores logos outside the catalog and only serves pending logos to the admin',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'tiolira-logo-'));
 const keys=['DATABASE_URL','POSTGRES_URL','BLOB_READ_WRITE_TOKEN','LOCAL_DATA_DIR','ADMIN_SESSION_SECRET','VERCEL'];
 const saved=Object.fromEntries(keys.map(k=>[k,process.env[k]]));for(const k of keys)delete process.env[k];
 process.env.LOCAL_DATA_DIR=dir;process.env.ADMIN_SESSION_SECRET='local-test-only-logo-secret-at-least-32-characters';
 const call=async(url,method='GET',body,cookie='')=>{
  const result={headers:{}};
  await handler({url,method,body,headers:{host:'localhost',origin:'http://localhost',cookie},socket:{remoteAddress:'logo-test'}},{setHeader(k,v){result.headers[k]=v},set statusCode(v){result.status=v},end(v){result.body=Buffer.isBuffer(v)?v:JSON.parse(v)}});
  result.status??=200;return result;
 };
 try{
  const body={name:'Logo Test',city:'Maceió',state:'AL',country:'Brasil',email:'test@example.invalid',whatsapp:'5582000000000',description:'Teste',delivery:'Retirada',consent:true,logoData:await png()};
  const response=await call('/api/stores/apply','POST',body);assert.equal(response.status,201);
  let catalog=await readRecord('catalog.json');const store=catalog.data.stores[0];assert.ok(store.logo.startsWith('/api/store-logo?id='));assert.ok(!JSON.stringify(catalog.data).includes('base64'));assert.ok(!('logoData' in store));
  assert.equal((await call(store.logo)).status,404);
  await writeRecord('admin.json',{version:'logo-test-admin'},null);const cookie=`${cookieName}=${await makeSession('logo-test-admin')}`;
  const privateLogo=await call(store.logo,'GET',undefined,cookie);assert.equal(privateLogo.status,200);assert.equal(privateLogo.headers['Cache-Control'],'private, no-store');
  let result=await call('/api/admin/stores','PUT',{item:{...store,status:'approved'},revision:catalog.etag},cookie);assert.equal(result.status,200);
  const publicLogo=await call(store.logo);assert.equal(publicLogo.status,200);assert.equal(publicLogo.headers['Content-Type'],'image/webp');assert.ok(Buffer.isBuffer(publicLogo.body));
  catalog=await readRecord('catalog.json');assert.equal(catalog.data.stores[0].logo,store.logo);
  result=await call('/api/admin/stores','PUT',{item:{...catalog.data.stores[0],logo:''},revision:catalog.etag},cookie);assert.equal(result.status,200);assert.equal((await call(store.logo)).status,404);
  const invalid=await call('/api/stores/apply','POST',{...body,logoData:'data:image/png;base64,AAAA'});assert.equal(invalid.status,400);assert.equal(invalid.body.code,'INVALID_LOGO');assert.equal((await readRecord('catalog.json')).data.stores.length,1);
 }finally{for(const k of keys){if(saved[k]===undefined)delete process.env[k];else process.env[k]=saved[k]}await rm(dir,{recursive:true,force:true})}
});
