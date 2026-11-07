import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {closingRate,refreshGamedayPrices} from '../server/gameday-pricing.mjs';
import {readRecord,writeRecord} from '../server/store.mjs';
import {marketCatalog} from '../lib/international-pricing.mjs';
import {quoteCart} from '../server/commerce.mjs';
import {cartSelection} from '../lib/cart-lines.mjs';
import seed from '../data/catalog.json' with {type:'json'};

test('daily PTAX reprices only Gameday BRL and preserves USD, other products and orders',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'gameday-pricing-'));
 const previous=process.env.LOCAL_DATA_DIR,oldFetch=globalThis.fetch;
 process.env.LOCAL_DATA_DIR=dir;
 try{
 const product={id:'gameday-santa-packers',slug:'gameday-santa-packers',name:'Packers',image:'',gallery:[],collection:'nfl-santas',access:'paid',published:true,priceCents:7000,priceUsdCents:1299,filePath:'models/packers.3mf'};
 const other={...product,id:'other',slug:'other',collection:'other',priceCents:1290,priceUsdCents:215};
 const catalog={...structuredClone(seed),products:[product,other],collections:[{id:'nfl-santas',published:true,priceCents:0},{id:'other',published:true,priceCents:0}]};
 await writeRecord('catalog.json',catalog,null);
 await writeRecord('orders.json',{amount:7000},null);
 globalThis.fetch=async url=>{
  assert(!url.href.includes('+'));
  return Response.json({value:[{cotacaoVenda:5.5013,dataHoraCotacao:'2026-11-06 13:00:00'}]});
 };
 assert.deepEqual(await closingRate(),{rate:5.5013,date:'2026-11-06'});
 assert.equal((await refreshGamedayPrices()).changed,1);
 const updated=(await readRecord('catalog.json')).data;
 assert.equal(updated.products[0].priceCents,7146);
 assert.equal(updated.products[0].priceUsdCents,1299);
 assert.deepEqual(updated.products[1],other);
 assert.equal((await readRecord('orders.json')).data.amount,7000);
 assert.equal((await refreshGamedayPrices()).changed,0);
 const selection=[{kind:'product',id:product.id},{kind:'product',id:'other'}];
 for(const [currency,total] of [['BRL',8436],['USD',1514]]){
  const market=marketCatalog(updated,currency);
  const q=quoteCart(market,selection);
  assert.equal(q.totalCents,total);
  assert.equal(cartSelection({...market,collections:market.collections.filter(c=>c.priceCents>0)},selection).total,total);
 }
 globalThis.fetch=async()=>new Response('',{status:503});
 await assert.rejects(refreshGamedayPrices());
 assert.equal((await readRecord('catalog.json')).data.products[0].priceCents,7146);
 globalThis.fetch=async()=>Response.json({value:[{cotacaoVenda:-1}]});
 await assert.rejects(refreshGamedayPrices());
 }finally{
 globalThis.fetch=oldFetch;
 if(previous===undefined)delete process.env.LOCAL_DATA_DIR;else process.env.LOCAL_DATA_DIR=previous;
 await rm(dir,{recursive:true,force:true});
 }
});
