import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import estimates from '../data/print-estimates.json' with {type:'json'};
import {productPrintEstimate} from '../lib/print-estimates.mjs';
import {artworkGroupTotals,artworkGroupBreakdown} from '../lib/artwork-selection.mjs';
import {artworkDefaults,calculateArtwork} from '../lib/calculator.mjs';
import {saveCostSheet,costSheets} from '../server/cost-sheets.mjs';
import {costSheetReport} from '../server/cost-sheet-pdf.mjs';
import {writeRecord} from '../server/store.mjs';
import seed from '../data/catalog.json' with {type:'json'};
const saintId='52dd5191-1b4c-4a02-8cc1-4ca7cdae65c6',boxId='67b25d33-7d24-4e3d-bf36-e35096cb0fa9';
const fixture=id=>({id,name:id,collection:'sanctis-test',published:true,access:'subscribers',filePath:estimates[id].filePath,url:estimates[id].url,gallery:[]});
const products=[saintId,boxId].map(id=>({...fixture(id),printEstimate:productPrintEstimate(fixture(id))}));
const catalog={...seed,collections:[{id:'sanctis-test',published:true}],products:products.map(({printEstimate,...p})=>p)};
test('saint plus one box uses the selected three plates, not six alternative plates',()=>{
 for(const variantId of ['lisa','canelada']){
  const items=[{productId:saintId,quantity:2},{productId:boxId,quantity:2,variantId}];
  const totals=artworkGroupTotals(items,products),expectedGrams=variantId==='lisa'?514.16:522;
  assert.equal(totals.complete,true);assert.equal(totals.grams,expectedGrams);
  assert.equal(totals.hours,Math.round((31377+(variantId==='lisa'?29439:32374))*2/3600*10000)/10000);
  const values={...artworkDefaults,grams:totals.grams,hours:totals.hours};
  const b=artworkGroupBreakdown(items,products,values),r=calculateArtwork(values);
  assert.ok(Math.abs(b.lines.reduce((s,l)=>s+l.cost,0)-r.cost)<1e-8);
  assert.ok(r.price>0&&Number.isFinite(r.price));
  const report=costSheetReport({items,values,lang:'en'},catalog);
  assert.match(report.lines[1].name,variantId==='lisa'?/Smooth/:/Ribbed/);
 }
 assert.equal(artworkGroupTotals([{productId:boxId,quantity:1,variantId:'wrong'}],products).complete,false);
 assert.throws(()=>costSheetReport({items:[{productId:boxId,quantity:1,variantId:'wrong'}],values:artworkDefaults},catalog),/Versão/);
});
test('box selection survives saving and reopening, and invalid variants cannot be saved',async()=>{
 const keys=['DATABASE_URL','POSTGRES_URL','VERCEL','BLOB_READ_WRITE_TOKEN','LOCAL_DATA_DIR'],old=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
 const dir=await mkdtemp(join(tmpdir(),'sanctis-cost-'));for(const k of keys)delete process.env[k];process.env.LOCAL_DATA_DIR=dir;
 try{
  await writeRecord('catalog.json',catalog,null);
  const member={id:'sanctis-test-member'},items=[{productId:boxId,quantity:1,variantId:'canelada'}];
  const totals=artworkGroupTotals(items,products),values={...artworkDefaults,grams:totals.grams,hours:totals.hours};
  const request={action:'sheet',revision:null,productId:null,items,values,channel:'card',offer:100};
  const saved=await saveCostSheet(member,request),loaded=await costSheets(member);
  assert.deepEqual(loaded.sheets[0].items,items);assert.match(loaded.sheets[0].productName,/Canelada/);
  assert.equal(loaded.sheets[0].result.price,calculateArtwork(values).price);
  await assert.rejects(()=>saveCostSheet(member,{...request,revision:saved.revision,items:[{...items[0],variantId:'wrong'}]}),/Versão/);
 }finally{for(const k of keys)if(old[k]===undefined)delete process.env[k];else process.env[k]=old[k];await rm(dir,{recursive:true,force:true});}
});
