import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable,Writable} from 'node:stream';
import {finished} from 'node:stream/promises';
import {productSchema,publicCatalog} from '../server/schema.mjs';
import {clubProducts} from '../server/club.mjs';
import {canPurchaseProduct,quoteCart} from '../server/commerce.mjs';
import {serveProductDownload} from '../server/product-download.mjs';
import {commercialPolicy} from '../lib/maker-license.mjs';
import {freeArtworkLabel} from '../lib/free-artwork.mjs';
import {isSubscriptionProduct} from '../lib/subscriber-access.mjs';
import {migrateSubscriptionCatalog,subscriptionLaunchPrices} from '../server/subscription-catalog.mjs';
import seed from '../data/catalog.json' with {type:'json'};
const p={...seed.products[0],id:'included-model',slug:'included-model',collection:'paid-collection',access:'paid',priceCents:1990,priceUsdCents:499,url:'',exclusive:false,allowPhysicalSales:false,published:true,includedInSubscription:true,filePath:'models/main.3mf',printProfiles:[{id:'fine',name:'Fino',layerHeight:0.16,notes:'',filePath:'models/fine.3mf'}]};
const data={...seed,collections:[{id:p.collection,name:'Coleção',published:true,free:false}],products:[p]};
test('dual access keeps a priced cart item and all private profiles for subscribers or permanent purchasers',()=>{
 const parsed=productSchema.parse(p);assert.equal(parsed.includedInSubscription,true);assert.equal(parsed.priceCents,1990);assert.equal(parsed.priceUsdCents,499);
 assert.equal(canPurchaseProduct(p,data),true);
 assert.equal(quoteCart(data,[{kind:'product',id:p.id}]).totalCents,1990);
 const pub=publicCatalog(data).products[0];assert.equal(pub.access,'paid');assert.equal(pub.commercialPolicy,'annual');assert.equal(pub.priceCents,1990);assert.equal(freeArtworkLabel(pub),'Incluído na assinatura');assert.ok(!JSON.stringify(pub).includes('models/'));
 for(const [active,owned,allowed] of [[false,false,false],[true,false,true],[false,true,true],[true,true,true]]){
  const view=clubProducts(data,new Set(owned?[p.id]:[]),active)[0];
  assert.equal(Boolean(view.downloadUrl),allowed);assert.equal(view.canLicense,allowed);assert.equal(view.canPurchase,!owned);
  assert.ok(view.printProfiles.every(profile=>Boolean(profile.downloadUrl)===allowed));
  assert.ok(!JSON.stringify(view).includes('models/'));
 }
 const normal={...p,includedInSubscription:false};assert.equal(commercialPolicy(normal),'purchase');assert.equal(Boolean(clubProducts({...data,products:[normal]},new Set(),true)[0].downloadUrl),false);
});
test('invalid subscription flags cannot turn free, external, unpublished-file or noncommercial models into annual downloads',()=>{
 for(const patch of [{access:'maker',url:'https://makerworld.com/pt/models/123'},{access:'site',priceCents:0},{filePath:'',printProfiles:[]},{allowPhysicalSales:true},{exclusive:true},{collection:'presepio'},{id:'96f7f843-b608-4a57-8f27-6ba12e2862da'}])assert.equal(productSchema.safeParse({...p,...patch}).success,false,JSON.stringify(patch));
 assert.equal(isSubscriptionProduct({...p,includedInSubscription:'true'}),false);
 assert.equal(productSchema.safeParse({...p,includedInSubscription:'true'}).success,false);
});
test('every download rechecks membership, expired members blocked before Blob reads, individual buyers retain access',async()=>{
 let active=false,owned=false,reads=0;
 const deps={prepare:async({stream})=>({id:'access-test',stream:Readable.fromWeb(stream),cleanup:async()=>{},finish:async()=>{}}),hasAccess:async()=>owned,subscription:async()=>({active}),record:async()=>{},readBlob:async path=>{reads++;return {stream:new ReadableStream({start(c){c.enqueue(Buffer.from(path));c.close();}})}}};
 const args={member:{id:'test-member'},data,productId:p.id};
 for(const profileId of [undefined,'fine'])await assert.rejects(()=>serveProductDownload({...args,profileId},deps),{status:403});
 assert.equal(reads,0);
 for(const mode of ['active-subscriber','buyer-with-expired-subscription']){
  active=mode==='active-subscriber';owned=!active;
  for(const profileId of [undefined,'fine']){
   let body='';const res=new Writable({write(c,e,cb){body+=c;cb();}});res.setHeader=()=>{};
   await serveProductDownload({...args,profileId,res},deps);await finished(res);assert.equal(body,profileId?'models/fine.3mf':'models/main.3mf');
  }
 }
 active=false;owned=false;await assert.rejects(()=>serveProductDownload(args,deps),{status:403});assert.equal(reads,4);
 active=true;await assert.rejects(()=>serveProductDownload({...args,profileId:'missing'},deps),{status:404});assert.equal(reads,4);
});
test('approved migration changes only twelve works, restores former prices, preserves files and all unrelated records, runs once',()=>{
 const products=Object.keys(subscriptionLaunchPrices).map((id,i)=>({...p,id,access:i%2?'subscribers':'paid',includedInSubscription:false,priceCents:i%2?0:7777}));
 const untouched={...p,id:'not-selected',includedInSubscription:false};const original={...data,products:[...products,untouched],migrations:{other:true}};
 const next=migrateSubscriptionCatalog(original);
 assert.equal(Object.keys(subscriptionLaunchPrices).length,12);assert.equal(next.products.filter(isSubscriptionProduct).length,12);assert.equal(next.products.at(-1),untouched);
 assert.equal(next.collections,original.collections);assert.deepEqual(original.migrations,{other:true});assert.equal(next.migrations.other,true);
 for(const [i,old] of products.entries()){
  const now=next.products[i];assert.equal(now.access,'paid');assert.equal(now.priceCents,old.priceCents||subscriptionLaunchPrices[old.id]);assert.equal(now.priceUsdCents,old.priceUsdCents);assert.equal(now.filePath,old.filePath);assert.equal(now.printProfiles,old.printProfiles);assert.equal(canPurchaseProduct(now,next),true);
  const {access,includedInSubscription,priceCents,allowPhysicalSales,...rest}=now;const {access:a,includedInSubscription:b,priceCents:c,allowPhysicalSales:d,...before}=old;assert.deepEqual(rest,before);
 }
 assert.equal(migrateSubscriptionCatalog(next),next);
 const manuallyChanged={...next,products:next.products.map(x=>({...x,includedInSubscription:false}))};assert.equal(migrateSubscriptionCatalog(manuallyChanged),manuallyChanged);
});
