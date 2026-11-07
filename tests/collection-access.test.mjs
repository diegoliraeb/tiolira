import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Writable} from 'node:stream';
import {finished} from 'node:stream/promises';
import seed from '../data/catalog.json' with {type:'json'};
import {writeRecord,readRecord,updateRecord,getCatalog} from '../server/store.mjs';
import {makeSession} from '../server/auth.mjs';
import handler from '../server/handler.mjs';
import {collectionAccess,adminCollectionAccess,saveCollectionAccess} from '../server/collection-access.mjs';
import {memberHasAccess,purchaseAccess,memberLicenses,quoteCheckout,checkout,shop} from '../server/commerce.mjs';
import {clubDashboard} from '../server/club.mjs';
import {serveProductDownload} from '../server/product-download.mjs';
import {freeArtworkLabel} from '../lib/free-artwork.mjs';
import {publicCatalog} from '../server/schema.mjs';

test('individual collection grants: authorization, profiles, licenses, checkout, revocation and paid ownership',async t=>{
 const keys=['DATABASE_URL','POSTGRES_URL','VERCEL','BLOB_READ_WRITE_TOKEN','LOCAL_DATA_DIR','ADMIN_SESSION_SECRET','ASAAS_ENVIRONMENT','ASAAS_API_KEY','ASAAS_WEBHOOK_TOKEN','PAYPAL_ENVIRONMENT','PAYPAL_CLIENT_ID','PAYPAL_CLIENT_SECRET','PAYPAL_MERCHANT_ID','PAYPAL_WEBHOOK_ID','SITE_URL'];
 const env=Object.fromEntries(keys.map(k=>[k,process.env[k]])),dir=await mkdtemp(join(tmpdir(),'collection-access-test-')),originalFetch=globalThis.fetch;
 for(const key of keys)delete process.env[key];
 Object.assign(process.env,{LOCAL_DATA_DIR:dir,ADMIN_SESSION_SECRET:'courtesy-local-test-secret-with-32-characters',ASAAS_ENVIRONMENT:'sandbox',ASAAS_API_KEY:'fake',ASAAS_WEBHOOK_TOKEN:'x'.repeat(32),PAYPAL_ENVIRONMENT:'sandbox',PAYPAL_CLIENT_ID:'fake',PAYPAL_CLIENT_SECRET:'fake',PAYPAL_MERCHANT_ID:'fake',PAYPAL_WEBHOOK_ID:'fake',SITE_URL:'https://example.invalid'});
 globalThis.fetch=async()=>{throw Error('Unexpected external request in courtesy tests');};
 const member={id:randomUUID(),name:'Parceiro de Teste',email:'partner@example.invalid',countryCode:'BR',cpfCnpj:'52998224725',version:'member-v',hash:'must-not-leak'},other={...member,id:randomUUID(),name:'Outro',email:'other@example.invalid'},admin={email:'admin@example.invalid',version:'admin-v'};
 const cookie=`tiolira_club=${await makeSession(member.version,{memberId:member.id})}`,otherCookie=`tiolira_club=${await makeSession(other.version,{memberId:other.id})}`,adminCookie=`tiolira_admin=${await makeSession(admin.version)}`;
 const product={...seed.products[0],id:'grant-piece',slug:'grant-piece',name:'Peça teste',collection:'family',published:true,exclusive:false,access:'paid',url:'',priceCents:1290,priceUsdCents:499,filePath:'models/grant.3mf',printProfiles:[{id:'layer-020',name:'Camada 0,20',layerHeight:0.2,notes:'',filePath:'models/020.3mf'}]};
 const data={...structuredClone(seed),stores:[],collections:[{id:'family',name:'Família',published:true,free:false,priceCents:2000,priceUsdCents:799},{id:'other',name:'Outra',published:true,free:false},{id:'free',name:'Grátis',published:true,free:true}],products:[product,{...product,id:'second',slug:'second'},{...product,id:'unrelated',slug:'unrelated',collection:'other'},{...product,id:'maker',slug:'maker',access:'maker',exclusive:true},{...product,id:'draft',slug:'draft',published:false},{...product,id:'free-piece',slug:'free-piece',collection:'free',access:'site',priceCents:0}]};
 const call=async(route,{method='GET',session=cookie,body={},origin='http://localhost'}={})=>{let result;await handler({method,url:'/api/'+route,body,headers:{host:'localhost',origin,cookie:session},socket:{remoteAddress:'courtesy-test'}},{setHeader(){},set statusCode(s){this.status=s},end(v){result={status:this.status||200,body:Buffer.isBuffer(v)?v:JSON.parse(v)}}});return result;};
 const mutate=async(active,extra={})=>saveCollectionAccess(admin,{memberId:member.id,collectionId:'family',active,revision:(await readRecord('partner-collection-access.json'))?.etag||null,...extra});
 let originalCode,grantId;
 try{
  await writeRecord('catalog.json',data,null);await writeRecord('club-members.json',{members:[member,other]},null);await writeRecord('admin.json',admin,null);await writeRecord('commerce.json',{orders:[]},null);
  await t.test('only admin can search or mutate grants; origin and account validation enforced',async()=>{
   for(const session of ['',cookie])for(const method of ['GET','PUT'])assert.equal((await call('admin/collection-access',{session,method})).status,401);
   assert.equal((await call('admin/collection-access',{session:adminCookie,method:'PUT',origin:'https://evil.invalid'})).status,403);
   const found=await call('admin/collection-access?q=partner%40example.invalid',{session:adminCookie});assert.equal(found.status,200);assert.equal(found.body.members.length,1);assert.equal(JSON.stringify(found).includes('must-not-leak'),false);
   await assert.rejects(()=>mutate(true,{memberId:randomUUID()}),{status:404});
   await assert.rejects(()=>mutate(true,{collectionId:'free'}),/já é gratuita/);
   await assert.rejects(()=>mutate(true,{collectionId:'missing'}),/publicada/);
   const saved=await call('admin/collection-access',{session:adminCookie,method:'PUT',body:{memberId:member.id,collectionId:'family',active:true,revision:null}});assert.equal(saved.status,200,JSON.stringify(saved));
   await assert.rejects(()=>saveCollectionAccess(admin,{memberId:member.id,collectionId:'family',active:false,revision:null}),{status:409});
   await mutate(true);const grants=(await adminCollectionAccess({memberId:member.id})).grants;assert.equal(grants.length,1);grantId=grants[0].id;assert.equal(grants[0].grantedBy,admin.email);
  });
  await t.test('private dashboard shows complimentary access while public prices and other partners stay unchanged',async()=>{
   const granted=await collectionAccess(member);assert.deepEqual([...granted.productIds].sort(),['grant-piece','second']);assert.equal((await collectionAccess(other)).productIds.size,0);
   const view=await clubDashboard(member,data),normal=await clubDashboard(other,data),piece=view.downloads.find(p=>p.id===product.id);
   assert.equal(piece.priceCents,0);assert.equal(piece.complimentary,true);assert.equal(piece.canPurchase,false);assert.ok(piece.downloadUrl);assert.ok(piece.printProfiles.every(p=>p.downloadUrl));assert.equal(freeArtworkLabel(piece,'pt',true),'Sem custo para você');
   assert.equal(view.collections.find(c=>c.id==='family').priceCents,0);assert.equal(normal.downloads.find(p=>p.id===product.id).priceCents,1290);assert.equal(normal.downloads.find(p=>p.id===product.id).downloadUrl,'');
   assert.equal(publicCatalog((await getCatalog()).data).products.find(p=>p.id===product.id).priceCents,1290);assert.equal(await purchaseAccess(member,product.id),false);assert.equal(await memberHasAccess(member,product.id),true);
   assert.equal((await shop(member)).orders.length,0);assert.equal((await readRecord('commerce.json')).data.orders.length,0);
  });
  await t.test('every profile streams for recipient only; licenses bind to recipient and download as PDF',async()=>{
   let reads=0;
   const deps={record:async()=>{},readBlob:async path=>{reads++;return {stream:new ReadableStream({start(c){c.enqueue(Buffer.from(path));c.close();}})};}};
   for(const profileId of ['original','layer-020']){
    const chunks=[],res=new Writable({write(c,e,cb){chunks.push(c);cb();}});res.setHeader=()=>{};
    await serveProductDownload({member,data,productId:product.id,profileId,res},deps);await finished(res);assert.equal(Buffer.concat(chunks).toString(),profileId==='original'?'models/grant.3mf':'models/020.3mf');
   }
   await assert.rejects(()=>serveProductDownload({member:other,data,productId:product.id},deps),{status:403});assert.equal(reads,2);
   const licenses=await memberLicenses(member);assert.equal(licenses.length,2);assert.ok(licenses.every(l=>l.source==='courtesy'&&!l.orderId));originalCode=licenses.find(l=>l.productId===product.id).code;
   const pdf=await call('club/licenses/download?code='+originalCode);assert.equal(pdf.status,200);assert.equal(pdf.body.subarray(0,4).toString(),'%PDF');assert.equal((await call('club/licenses/download?code='+originalCode,{session:otherCookie})).status,404);
  });
  await t.test('BRL and USD quotes and payment creation reject granted pieces without contacting processors',async()=>{
   for(const countryCode of ['BR','US']){
    const buyer={...member,countryCode},input={items:[{kind:'product',id:product.id}],requestId:randomUUID(),billingType:'PIX',expectedTotalCents:countryCode==='BR'?1290:499};
    await assert.rejects(()=>quoteCheckout(buyer,input),/já possui/);await assert.rejects(()=>checkout(buyer,input),/já possui/);
   }
   assert.equal((await quoteCheckout(other,{items:[{kind:'product',id:product.id}]})).totalCents,1290);assert.equal((await readRecord('commerce.json')).data.orders.length,0);
  });
  await t.test('future published pieces included, existing license stable, unpublished collection excluded',async()=>{
   await updateRecord('catalog.json',d=>({...d,products:[...d.products,{...product,id:'future',slug:'future'}]}));assert.equal(await memberHasAccess(member,'future'),true);assert.equal((await memberLicenses(member)).find(l=>l.productId===product.id).code,originalCode);
   await updateRecord('catalog.json',d=>{d.collections[0].published=false;return d;});assert.equal(await memberHasAccess(member,product.id),false);
   await updateRecord('catalog.json',d=>{d.collections[0].published=true;return d;});
  });
  await t.test('revocation invalidates free licenses and downloads but preserves paid purchases',async()=>{
   const license={code:'TL-PAID-TEST',productId:'second',productName:'Second',memberId:member.id,partnerName:member.name,status:'active',issuedAt:new Date().toISOString(),terms:'Licença paga'};
   await updateRecord('commerce.json',d=>({...d,orders:[{id:'paid-order',environment:'sandbox',memberId:member.id,status:'paid',createdAt:new Date().toISOString(),totalCents:1290,productIds:['second'],items:[],licenses:[license]}]}));
   await mutate(false);assert.equal(await memberHasAccess(member,product.id),false);assert.equal(await memberHasAccess(member,'second'),true);assert.equal(await purchaseAccess(member,'second'),true);assert.equal((await memberLicenses(member)).length,1);
   assert.equal((await call('download?id='+product.id)).status,403);assert.equal((await call('club/licenses/download?code='+originalCode)).status,404);assert.equal((await call('club/licenses/download?code=TL-PAID-TEST')).status,200);
   const view=await clubDashboard(member,(await getCatalog()).data);assert.equal(view.downloads.find(p=>p.id===product.id).priceCents,1290);assert.ok(!view.collections[0].complimentary);assert.ok(view.downloads.find(p=>p.id==='second').downloadUrl);
   assert.equal((await readRecord('commerce.json')).data.orders.length,1);
   await mutate(true);const grants=(await adminCollectionAccess({memberId:member.id})).grants;assert.equal(grants.length,2);assert.equal(grants.find(g=>g.id===grantId).active,false);assert.equal(grants.find(g=>g.id===grantId).revokedBy,admin.email);assert.notEqual((await memberLicenses(member)).find(l=>l.productId===product.id).code,originalCode);assert.equal((await call('club/licenses/download?code='+originalCode)).status,404);
  });
 }finally{globalThis.fetch=originalFetch;for(const key of keys)env[key]===undefined?delete process.env[key]:process.env[key]=env[key];await rm(dir,{recursive:true,force:true});}
});
