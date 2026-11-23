import test from 'node:test';
import assert from 'node:assert/strict';
import {productPerformance} from '../server/product-performance.mjs';
import {salesDashboardRows,salesDashboardTotals} from '../lib/sales-dashboard.mjs';
test('performance preserves totals, discounted bundle cent rounding, historical downloads, partners and separate currencies',()=>{
 const oldA=process.env.ASAAS_ENVIRONMENT,oldP=process.env.PAYPAL_ENVIRONMENT;process.env.ASAAS_ENVIRONMENT='production';process.env.PAYPAL_ENVIRONMENT='production';
 try{
 const paid=(items,rest={})=>({status:'paid',environment:'production',items,...rest}),item={kind:'collection',quantity:2,totalCents:1001,products:[{id:'a'},{id:'b'}]};
 const state={orders:[paid([item]),paid([{kind:'product',totalCents:77,products:[{id:'b'}]}],{provider:'paypal',currency:'USD'}),paid([item],{status:'revoked'}),paid([item],{environment:'sandbox'})],downloads:{a:8,b:3,deleted:9},recentDownloads:[{productId:'deleted',productName:'Peça retirada'}],downloadPartners:[{productId:'a',memberId:'one',lastAt:'2026-11-20T00:00:00Z'},{productId:'a',memberId:'two',lastAt:'2026-11-22T00:00:00Z'}]};
 const products=productPerformance({products:[{id:'a',name:'São José',collection:'saints'},{id:'b',name:'Jesus',collection:'saints'},{id:'zero',name:'Zero'}],collections:[{id:'saints',name:'Santos'}]},state);
 assert.equal(products.find(p=>p.id==='a').revenueCents,501);assert.equal(products.find(p=>p.id==='b').revenueCents,500);assert.equal(products.find(p=>p.id==='b').revenueUsdCents,77);assert.equal(products.find(p=>p.id==='a').totalSales,2);
 assert.equal(products.find(p=>p.id==='a').uniquePartners,2);assert.equal(products.find(p=>p.id==='a').lastDownloadAt,'2026-11-22T00:00:00Z');assert.equal(products.find(p=>p.id==='deleted').name,'Peça retirada');
 assert.deepEqual(salesDashboardTotals(products),{downloads:20,downloadedWorks:3,totalSales:5,revenueCents:1001,revenueUsdCents:77});
 const before=structuredClone(products);
 assert.deepEqual(salesDashboardRows(products,{query:'sao',collection:'saints'}).map(p=>p.id),['a']);
 assert.deepEqual(salesDashboardRows(products,{activity:'no-downloads'}).map(p=>p.id),['zero']);
 assert.equal(salesDashboardRows(products,{sort:'revenueUsdCents'})[0].id,'b');assert.equal(salesDashboardRows(products,{sort:'downloads',direction:'asc'})[0].id,'zero');assert.equal(salesDashboardRows(products,{sort:'lastDownloadAt'})[0].id,'a');assert.deepEqual(products,before);
 }finally{oldA===undefined?delete process.env.ASAAS_ENVIRONMENT:process.env.ASAAS_ENVIRONMENT=oldA;oldP===undefined?delete process.env.PAYPAL_ENVIRONMENT:process.env.PAYPAL_ENVIRONMENT=oldP;}
});
