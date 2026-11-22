import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable,Writable} from 'node:stream';
import {finished} from 'node:stream/promises';
import {productSchema,publicCatalog} from '../server/schema.mjs';
import {clubProducts} from '../server/club.mjs';
import {serveProductDownload} from '../server/product-download.mjs';
import {commercialPolicy,subscriptionView} from '../lib/maker-license.mjs';
import {purchaseValidity} from '../lib/maker-purchases.mjs';
import {canPurchaseProduct} from '../server/commerce.mjs';
import seed from '../data/catalog.json' with {type:'json'};
const product={...seed.products[0],id:'subscriber-test',slug:'subscriber-test',collection:'exclusive-test',access:'subscribers',published:true,exclusive:false,allowPhysicalSales:false,priceCents:0,url:'',filePath:'models/member.3mf',printProfiles:[{id:'fine',name:'Fine',layerHeight:0.16,notes:'',filePath:'models/fine.3mf'}]};
const data={...seed,collections:[{id:'exclusive-test',name:'Exclusive',published:true,free:false}],products:[product]};
test('private subscription products validate, require files on publication and cannot offer free commercial grants or public links',()=>{
 assert.equal(productSchema.parse(product).access,'subscribers');
 for(const patch of [{url:'https://example.com/model.3mf'},{exclusive:true},{allowPhysicalSales:true},{priceCents:500},{collection:'presepio'},{filePath:'',printProfiles:[]}])assert.equal(productSchema.safeParse({...product,...patch}).success,false,JSON.stringify(patch));
 assert.equal(productSchema.safeParse({...product,published:false,filePath:'',printProfiles:[]}).success,true);
 assert.equal(commercialPolicy({...product,allowPhysicalSales:true},[{id:product.collection,free:true}]),'annual');
 assert.equal(commercialPolicy({...product,id:'96f7f843-b608-4a57-8f27-6ba12e2862da'}),'noncommercial');
 assert.equal(canPurchaseProduct(product,data),false);
});
test('public and inactive libraries expose no file paths or download URLs, active and historical buyers get all profiles',()=>{
 const pub=publicCatalog(data).products[0];assert.equal(pub.commercialPolicy,'annual');assert.ok(!JSON.stringify(pub).includes('models/'));assert.ok(pub.printProfiles.every(p=>!p.downloadUrl));
 for(const annual of [false,true]){
  const p=clubProducts(data,new Set(),annual)[0];assert.equal(Boolean(p.downloadUrl),annual);assert.equal(p.canLicense,annual);assert.equal(p.canPurchase,false);assert.ok(p.printProfiles.every(p=>Boolean(p.downloadUrl)===annual));assert.ok(!JSON.stringify(p).includes('models/'));
 }
 const old=clubProducts(data,new Set([product.id]),false)[0];assert.ok(old.downloadUrl);assert.equal(old.canLicense,true);assert.ok(old.printProfiles.every(p=>p.downloadUrl));
});
test('download rechecks active paid period and ownership for every private profile, before reading Blob',async()=>{
 let reads=0,records=0,owned=false,active=false;
 const deps={prepare:async({stream})=>({id:'test',stream:Readable.fromWeb(stream),cleanup:async()=>{},finish:async()=>{}}),hasAccess:async()=>owned,subscription:async()=>({active}),record:async()=>records++,readBlob:async path=>{reads++;return {stream:new ReadableStream({start(c){c.enqueue(Buffer.from(path));c.close()}})}}};
 const args={member:{id:'m'},data,productId:product.id};
 for(const profileId of [undefined,'fine'])await assert.rejects(()=>serveProductDownload({...args,profileId},deps),{status:403});assert.equal(reads,0);
 for(const mode of ['subscriber','previous-buyer']){active=mode==='subscriber';owned=!active;for(const profileId of [undefined,'fine']){let body='';const res=new Writable({write(c,e,cb){body+=c;cb()}});res.setHeader=()=>{};await serveProductDownload({...args,profileId,res},deps);await finished(res);assert.equal(body,profileId?'models/fine.3mf':'models/member.3mf')}}
 assert.equal(reads,4);assert.equal(records,4);active=false;owned=false;
 await assert.rejects(()=>serveProductDownload(args,deps),{status:403});assert.equal(reads,4);
 active=true;await assert.rejects(()=>serveProductDownload({...args,profileId:'../other'},deps),{status:404});
 await assert.rejects(()=>serveProductDownload({...args,data:{...data,products:[{...product,published:false}]}},deps),{status:404});assert.equal(reads,4);
});
test('both payment generations expire and revoked payments grant no membership',()=>{
 const now=Date.parse('2026-11-19T12:00:00Z'),startsAt='2026-11-01T00:00:00Z',endsAt='2027-11-01T00:00:00Z';
 assert.equal(subscriptionView({periods:[{startsAt,endsAt}]},now).active,true);
 assert.equal(subscriptionView({periods:[{startsAt,endsAt,revoked:true}]},now).active,false);
 assert.equal(subscriptionView({periods:[{startsAt,endsAt:'2026-11-19T12:00:00Z'}]},now).active,false);
 assert.equal(purchaseValidity([{status:'paid',startsAt,endsAt}],now).active,true);
 assert.equal(purchaseValidity([{status:'revoked',startsAt,endsAt}],now).active,false);
 assert.equal(purchaseValidity([{status:'paid',startsAt,endsAt:'2026-11-19T12:00:00Z'}],now).active,false);
});
