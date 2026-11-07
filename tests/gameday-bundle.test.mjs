import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import teams from '../data/gameday-teams.json' with {type:'json'};
import seed from '../data/catalog.json' with {type:'json'};
import {refreshGamedayPrices} from '../server/gameday-pricing.mjs';
import {readRecord,writeRecord} from '../server/store.mjs';
import {shop,quoteCheckout,checkout,purchaseAccess,purchaseLicenses} from '../server/commerce.mjs';
import {applyPaypalOrder} from '../server/paypal-commerce.mjs';
import {cartSelection} from '../lib/cart-lines.mjs';

test('32-team pack: daily BRL, fixed USD, cart/checkout parity and 32 paid entitlements',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'gameday-bundle-'));
 const keys=['DATABASE_URL','POSTGRES_URL','VERCEL','BLOB_READ_WRITE_TOKEN','LOCAL_DATA_DIR','ASAAS_ENVIRONMENT','PAYPAL_ENVIRONMENT','PAYPAL_CLIENT_ID','PAYPAL_CLIENT_SECRET','PAYPAL_MERCHANT_ID','PAYPAL_WEBHOOK_ID','SITE_URL','RESEND_API_KEY'];
 const env=Object.fromEntries(keys.map(k=>[k,process.env[k]])),oldFetch=globalThis.fetch;
 for(const k of keys)delete process.env[k];
 Object.assign(process.env,{LOCAL_DATA_DIR:dir,PAYPAL_ENVIRONMENT:'sandbox',PAYPAL_CLIENT_ID:'test-id',PAYPAL_CLIENT_SECRET:'test-secret',PAYPAL_MERCHANT_ID:'TESTMERCHANT',PAYPAL_WEBHOOK_ID:'test-webhook',SITE_URL:'https://www.tiolira.com.br',ASAAS_ENVIRONMENT:'sandbox'});
 try{
 const products=teams.map(t=>({id:'gameday-santa-'+t.key,slug:'gameday-santa-'+t.key,name:t.team,image:'',gallery:[],collection:'nfl-santas',access:'paid',published:true,priceCents:8000,priceUsdCents:1499,filePath:'models/'+t.key+'.3mf'}));
 const other={...products[0],id:'other',slug:'other',collection:'other',priceCents:1290,priceUsdCents:215};
 const collection={id:'nfl-santas',name:'Gameday Santas',published:true,free:false,priceCents:100000,priceUsdCents:19900};
 const otherCollection={id:'other',name:'Other',published:true,priceCents:1290,priceUsdCents:215};
 await writeRecord('catalog.json',{...structuredClone(seed),products:[...products,other],collections:[collection,otherCollection]},null);
 await writeRecord('commerce.json',{orders:[],downloads:{},recentDownloads:[]},null);
 globalThis.fetch=async()=>Response.json({value:[{cotacaoVenda:5.5013,dataHoraCotacao:'2026-11-06 13:00:00'}]});
 assert.equal((await refreshGamedayPrices()).changed,33);
 let saved=(await readRecord('catalog.json')).data;
 assert(saved.products.slice(0,32).every(p=>p.priceCents===8246&&p.priceUsdCents===1499));
 assert.equal(saved.collections[0].priceCents,109476);assert.equal(saved.collections[0].priceUsdCents,19900);
 assert.deepEqual(saved.collections[1],otherCollection);assert.deepEqual(saved.products[32],other);
 assert.equal((await refreshGamedayPrices()).changed,0);
 const member={id:randomUUID(),name:'Test',email:'test@example.invalid',countryCode:'US'};
 const bundle=[{kind:'collection',id:'nfl-santas'}];
 for(const [countryCode,currency,single,total] of [['US','USD',1499,19900],['BR','BRL',8246,109476]]){
  const buyer={...member,countryCode},offers=await shop(buyer);
  assert.equal(offers.currency,currency);assert.equal(offers.products.find(p=>p.id===products[0].id).priceCents,single);
  for(const items of [bundle,[...bundle,{kind:'product',id:products[0].id}]]){
   const q=await quoteCheckout(buyer,{items});assert.equal(q.totalCents,total);assert.equal(q.productIds.length,32);assert.equal(cartSelection(offers,items).total,total);
  }
  const mixed=[...bundle,{kind:'product',id:'other'}];
  assert.equal((await quoteCheckout(buyer,{items:mixed})).totalCents,total+(currency==='USD'?215:1290));
  assert.equal(cartSelection(offers,mixed).total,total+(currency==='USD'?215:1290));
 }
 let remote,createCalls=0;
 globalThis.fetch=async(url,options={})=>{
  const u=new URL(url);assert.equal(u.origin,'https://api-m.sandbox.paypal.com');
  if(u.pathname==='/v1/oauth2/token')return Response.json({access_token:'test-access'});
  assert.equal(u.pathname,'/v2/checkout/orders');createCalls++;
  remote={...JSON.parse(options.body),id:'TESTPACKORDER',status:'PAYER_ACTION_REQUIRED',links:[{rel:'payer-action',href:'https://www.sandbox.paypal.com/checkoutnow?token=TESTPACKORDER'}]};
  assert.equal(remote.purchase_units[0].amount.value,'199.00');return Response.json(remote);
 };
 const input={items:bundle,requestId:randomUUID(),billingType:'PAYPAL',lang:'en',expectedTotalCents:19900};
 await assert.rejects(()=>checkout(member,{...input,expectedTotalCents:1}),/preço mudou/);assert.equal(createCalls,0);
 const order=await checkout(member,input);assert.equal(order.totalCents,19900);assert.equal(order.productIds.length,32);
 assert.equal(await purchaseAccess(member,products[0].id),false);
 remote.status='COMPLETED';remote.purchase_units[0].payments={captures:[{id:'TESTPACKCAPTURE',status:'COMPLETED',amount:structuredClone(remote.purchase_units[0].amount)}]};
 await applyPaypalOrder(order.id,remote);
 const licenses=await purchaseLicenses(member);assert.equal(licenses.length,32);assert.equal(new Set(licenses.map(l=>l.productId)).size,32);
 for(const p of products)assert.equal(await purchaseAccess(member,p.id),true);
 globalThis.fetch=async()=>Response.json({value:[{cotacaoVenda:5.6,dataHoraCotacao:'2026-11-09 13:00:00'}]});
 await refreshGamedayPrices();assert.equal((await readRecord('catalog.json')).data.collections[0].priceCents,111440);
 assert.equal((await readRecord('commerce.json')).data.orders[0].totalCents,19900);
 saved=await readRecord('catalog.json');saved.data.collections[0].priceCents=0;await writeRecord('catalog.json',saved.data,saved.etag);
 await refreshGamedayPrices();assert.equal((await readRecord('catalog.json')).data.collections[0].priceCents,0);
 }finally{globalThis.fetch=oldFetch;for(const [k,v] of Object.entries(env))v===undefined?delete process.env[k]:process.env[k]=v;await rm(dir,{recursive:true,force:true});}
});
