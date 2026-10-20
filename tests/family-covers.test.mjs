import test from 'node:test';
import assert from 'node:assert/strict';
import {access} from 'node:fs/promises';
import sharp from 'sharp';
import covers from '../data/family-covers-v1.json' with {type:'json'};
import {FAMILY_COLLECTION_ID} from '../lib/family-discount.mjs';
import {migrateFamilyCovers} from '../server/family-covers.mjs';

const first=covers[0];
const product={id:first.id,collection:FAMILY_COLLECTION_ID,image:first.previous,gallery:[first.previous,'/assets/another-angle.png'],priceCents:1290,filePath:'models/private.3mf',printProfiles:[{id:'fine',filePath:'models/fine.3mf'}],license:'Physical sales allowed'};

test('family cover migration only replaces the expected cover and preserves the original gallery and commerce fields',()=>{
 const other={...product,id:'other',collection:'presepio'};
 const edited={...product,id:covers[1].id,image:'/assets/new-admin-cover.png'};
 const input={products:[product,other,edited],settings:{storesOpen:true},stores:[],mediaMigrations:['earlier']};
 const result=migrateFamilyCovers(input);
 assert.equal(result.products[0].image,first.image);
 assert.deepEqual(result.products[0].gallery,[first.image,...product.gallery]);
 for(const key of ['priceCents','filePath','printProfiles','license'])assert.deepEqual(result.products[0][key],product[key]);
 assert.equal(result.products[1],other);assert.equal(result.products[2],edited);
 assert.equal(result.settings,input.settings);assert.equal(result.stores,input.stores);
 assert.deepEqual(product.gallery,[first.previous,'/assets/another-angle.png']);
 assert.equal(migrateFamilyCovers(result),result);
 // Selecting the old cover again in the admin after migration is intentional.
 const changed={...result,products:[{...result.products[0],image:first.previous}]};
 assert.equal(migrateFamilyCovers(changed),changed);
});

test('migration does not overflow full galleries or change unrelated catalogs',()=>{
 const full={...product,gallery:[first.previous,...Array.from({length:20},(_,i)=>`/assets/${i}.png`)]};
 assert.equal(migrateFamilyCovers({products:[full]}).products[0],full);
 const other={products:[{...product,collection:'other'}]};assert.equal(migrateFamilyCovers(other),other);
});

test('all 39 replacement assets exist, decode, and share the landscape 4:3 format',async()=>{
 assert.equal(covers.length,39);assert.equal(new Set(covers.map(c=>c.id)).size,39);
 for(const cover of covers){
  const file=new URL('../public'+cover.image,import.meta.url);await access(file);
  const {width,height,format}=await sharp(file.pathname).metadata();
  assert.equal(format,'webp');assert.ok(width>=1000);assert.ok(Math.abs(width/height-4/3)<.002,cover.image);
 }
});
