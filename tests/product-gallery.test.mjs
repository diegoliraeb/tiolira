import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import seed from '../data/catalog.json' with {type:'json'};
import {MAX_GALLERY_IMAGES,normalizeProductGallery,selectGalleryCover} from '../lib/product-gallery.mjs';
import {productSchema,publicCatalog} from '../server/schema.mjs';
import {getCatalog,readRecord,writeRecord,Conflict} from '../server/store.mjs';
import {makeSession} from '../server/auth.mjs';
import handler from '../server/handler.mjs';

const cover='/assets/cover.jpg',a='/assets/a.jpg',b='/assets/b.jpg';
test('legacy covers become the first gallery photo without losing or repeating photos',()=>{
 const original={...seed.products[0],image:cover,gallery:[a,cover,a,b,'']};
 const normalized=normalizeProductGallery(original);
 assert.deepEqual(normalized.gallery,[cover,a,b]);
 assert.equal(normalized.image,cover);
 assert.deepEqual(original.gallery,[a,cover,a,b,'']);
 assert.equal(normalizeProductGallery(normalized),normalized);
 assert.deepEqual(normalizeProductGallery({image:cover}).gallery,[cover]);
 assert.equal(normalizeProductGallery({image:'',gallery:[a,b]}).image,a);
 assert.deepEqual(normalizeProductGallery({image:'',gallery:[]}).gallery,[]);
});

test('selecting and removing covers keeps gallery order and the card image synchronized',()=>{
 const gallery=selectGalleryCover([cover,a,b],2);
 assert.deepEqual(gallery,[b,cover,a]);
 const product={...seed.products[0],image:gallery[0],gallery};
 assert.deepEqual(productSchema.parse(product).gallery,gallery);
 const remaining=gallery.slice(1);
 assert.equal(productSchema.parse({...product,image:remaining[0],gallery:remaining}).image,cover);
 const empty=productSchema.parse({...product,image:'',gallery:[]});
 assert.equal(empty.image,'');assert.deepEqual(empty.gallery,[]);
 const uploaded=productSchema.parse({...empty,gallery:[a,b]});
 assert.equal(uploaded.image,a);
 const publicProduct=publicCatalog({...seed,products:[product]}).products[0];
 assert.equal(publicProduct.image,b);assert.deepEqual(publicProduct.gallery,gallery);
 assert.ok(!('filePath' in publicProduct));
});

test('a full legacy gallery retains all 20 photos plus the cover and still validates',()=>{
 const gallery=Array.from({length:20},(_,i)=>`/assets/photo-${i}.jpg`);
 const migrated=productSchema.parse({...seed.products[0],image:cover,gallery});
 assert.equal(migrated.gallery.length,MAX_GALLERY_IMAGES);
 assert.deepEqual(migrated.gallery,[cover,...gallery]);
 assert.equal(productSchema.safeParse({...migrated,gallery:[...migrated.gallery,a]}).success,false);
 assert.equal(productSchema.safeParse({...migrated,gallery:['javascript:alert(1)']}).success,false);
});

test('migration persists once under concurrent reads; authenticated edits survive reload without reviving removed covers',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'tiolira-gallery-'));
 const keys=['DATABASE_URL','POSTGRES_URL','BLOB_READ_WRITE_TOKEN','LOCAL_DATA_DIR','ADMIN_SESSION_SECRET','VERCEL'];
 const saved=Object.fromEntries(keys.map(k=>[k,process.env[k]]));for(const k of keys)delete process.env[k];
 process.env.LOCAL_DATA_DIR=dir;process.env.ADMIN_SESSION_SECRET='local-gallery-test-secret-at-least-32-characters';
 const call=async(method,route,body,cookie)=>{
  const result={};await handler({url:`/api/${route}`,method,body,headers:{host:'localhost',origin:'http://localhost',cookie},socket:{remoteAddress:'gallery-test'}},{setHeader(){},set statusCode(value){result.status=value},end(value){result.body=JSON.parse(value)}});return result;
 };
 try{
  const data=structuredClone(seed);data.products[0]={...data.products[0],image:cover,gallery:[a,b]};
  const originalRevision=await writeRecord('catalog.json',data,null);
  const catalogs=await Promise.all([getCatalog(),getCatalog(),getCatalog()]);
  const migrated=await readRecord('catalog.json');
  assert.notEqual(migrated.etag,originalRevision);
  assert.ok(catalogs.every(c=>c.etag===migrated.etag));
  assert.deepEqual(migrated.data.products[0].gallery,[cover,a,b]);
  assert.deepEqual(migrated.data.stores,data.stores);assert.deepEqual(migrated.data.settings,data.settings);
  assert.equal((await getCatalog()).etag,migrated.etag);
  await assert.rejects(writeRecord('catalog.json',data,originalRevision),Conflict);
  assert.equal((await call('PUT','admin/products',{item:migrated.data.products[0],revision:migrated.etag})).status,401);
  await writeRecord('admin.json',{version:'gallery-test'},null);
  const cookie=`tiolira_admin=${await makeSession('gallery-test')}`;
  const product=migrated.data.products[0];
  const gallery=selectGalleryCover(product.gallery,2);
  let response=await call('PUT','admin/products',{item:{...product,image:gallery[0],gallery},revision:migrated.etag},cookie);
  assert.equal(response.status,200);
  let current=await getCatalog();assert.equal(current.data.products[0].image,b);assert.deepEqual(current.data.products[0].gallery,[b,cover,a]);
  response=await call('PUT','admin/products',{item:{...product,image:cover,gallery:[cover,a]},revision:current.etag},cookie);
  assert.equal(response.status,200);
  current=await getCatalog();assert.deepEqual(current.data.products[0].gallery,[cover,a]);
  response=await call('PUT','admin/products',{item:{...product,image:'',gallery:[]},revision:current.etag},cookie);
  assert.equal(response.status,200);
  current=await getCatalog();assert.equal(current.data.products[0].image,'');assert.deepEqual(current.data.products[0].gallery,[]);
 }finally{
  for(const k of keys){if(saved[k]===undefined)delete process.env[k];else process.env[k]=saved[k];}
  await rm(dir,{recursive:true,force:true});
 }
});
