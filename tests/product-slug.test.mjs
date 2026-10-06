import test from 'node:test';
import assert from 'node:assert/strict';
import seed from '../data/catalog.json' with {type:'json'};
import {productSchema} from '../server/schema.mjs';

const makerUrl='https://makerworld.com/pt/models/3369453-complete-mini-nativity-scene-with-ams-tio-lira';
const product={...seed.products[0],name:'Mini Presépio',access:'maker',url:makerUrl,published:true};

test('publishing an accented address normalizes the slug and preserves the MakerWorld download',()=>{
 for(const slug of ['Mini Presépio','  MINI   PRESÉPIO  ','Mini Prese\u0301pio','mini-presepio']){
  const parsed=productSchema.parse({...product,slug});
  assert.equal(parsed.slug,'mini-presepio');
  assert.equal(parsed.name,'Mini Presépio');
  assert.equal(parsed.id,product.id);
  assert.equal(parsed.url,makerUrl);
 }
});

test('invalid addresses explain the field and where the download link belongs',()=>{
 for(const slug of [makerUrl,'','   ','-mini','../mini','mini/presepio','mini?download=1','🎄','a'.repeat(101)]){
  const result=productSchema.safeParse({...product,slug});
  assert.equal(result.success,false);
  const issue=result.error.issues.find(i=>i.path[0]==='slug');
  assert.match(issue.message,/Endereço da obra/);
  assert.match(issue.message,/Link de download/);
 }
 assert.equal(productSchema.parse({...product,slug:'a'.repeat(100)}).slug.length,100);
});

test('valid existing addresses remain unchanged and internal IDs stay strict',()=>{
 for(const p of seed.products)assert.equal(productSchema.parse(p).slug,p.slug);
 assert.equal(productSchema.safeParse({...product,slug:'mini-presepio',id:'Mini Presépio'}).success,false);
 assert.equal(productSchema.safeParse({...product,slug:'mini-presepio',collection:'Presépio'}).success,false);
});
