import test from 'node:test';
import assert from 'node:assert/strict';
import {PDFDocument} from 'pdf-lib';
import {costSheetReport,costSheetPdf} from '../server/cost-sheet-pdf.mjs';
import {artworkDefaults,calculateArtwork} from '../lib/calculator.mjs';
import estimates from '../data/print-estimates.json' with {type:'json'};
const products=Object.entries(estimates).slice(0,3).map(([id,e],i)=>({id,name:`Obra ${i} - Família`,published:true,collection:'test',filePath:e.filePath,url:e.url}));
const catalog={products,collections:[{id:'test',published:true}]};
const input={lang:'pt',items:products.map((p,i)=>({productId:p.id,quantity:i+1})),values:{...artworkDefaults,grams:400,hours:24}};
test('PDF uses validated catalog names and recomputed per-piece and total costs',()=>{
 const report=costSheetReport({...input,result:{price:1},lines:[{name:'forged',cost:0}]},catalog);
 assert.equal(report.quantity,6);assert.equal(report.lines[0].name,products[0].name);assert.equal(report.result.price,calculateArtwork(input.values).price);
 assert.ok(Math.abs(report.lines.reduce((n,l)=>n+l.cost,0)-report.result.cost)<1e-8);
 assert.equal(report.individualTotal,Math.round(report.lines.reduce((n,l)=>n+l.subtotal,0)*100)/100);
 assert.throws(()=>costSheetReport({...input,values:{...input.values,grams:-1}},catalog));
 assert.throws(()=>costSheetReport({...input,customName:'conflict'},catalog));
 assert.throws(()=>costSheetReport({...input,items:[{productId:'absent',quantity:1}]},catalog),e=>e.status===404);
 assert.throws(()=>costSheetReport({...input,items:[{productId:products[0].id,quantity:1.5}]},catalog));
 const custom=costSheetReport({customName:'Vaso próprio',values:artworkDefaults},catalog);assert.equal(custom.lines[0].name,'Vaso próprio');assert.equal(custom.lines[0].unit.price,custom.result.price);
});
test('branded PDF is valid, includes an image, supports every language and paginates long groups',async()=>{
 for(const lang of ['pt','en','es','fr']){const bytes=await costSheetPdf(costSheetReport({...input,lang},catalog),{partnerName:'Oficina João',now:new Date('2026-10-16T15:00:00Z')});const doc=await PDFDocument.load(bytes);assert.ok(doc.getPageCount()>=1);assert.match(doc.getTitle(),/Tio Lira/);assert.ok(doc.getPage(0).node.Resources().has((await import('pdf-lib')).PDFName.of('XObject')));}
 const report=costSheetReport(input,catalog);report.lines=Array.from({length:60},(_,i)=>({...report.lines[0],name:`Obra longa ${i} `.repeat(12)}));
 const doc=await PDFDocument.load(await costSheetPdf(report));assert.ok(doc.getPageCount()>3);
});
