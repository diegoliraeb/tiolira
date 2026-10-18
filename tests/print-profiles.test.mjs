import test from 'node:test';
import assert from 'node:assert/strict';
import {Writable} from 'node:stream';
import {finished} from 'node:stream/promises';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {productSchema,publicCatalog} from '../server/schema.mjs';
import {productFiles,publicPrintProfiles,resolveProductFile} from '../lib/print-profiles.mjs';
import {serveProductDownload} from '../server/product-download.mjs';
import {clubProducts} from '../server/club.mjs';
import {shop,quoteCart,purchaseAccess,downloadablePurchaseLicense} from '../server/commerce.mjs';
import {writeRecord,readRecord,updateRecord} from '../server/store.mjs';
import {makeSession} from '../server/auth.mjs';
import handler from '../server/handler.mjs';
import seed from '../data/catalog.json' with {type:'json'};
const profile={id:'layer-020',name:'Impressão otimizada',layerHeight:0.2,notes:'Bico 0,4 mm · PLA',filePath:'models/optimized.3mf'};
const product={...seed.products[0],id:'family-test',slug:'family-test',name:'Família de teste',collection:'family',exclusive:false,access:'paid',url:'',priceCents:1290,filePath:'models/original.3mf',fileProfile:{name:'Mais detalhes',layerHeight:0.16,notes:''},printProfiles:[profile]};
const data={...structuredClone(seed),collections:[{id:'family',name:'Família',published:true,free:false,priceCents:2000}],products:[product]};
function noPaths(value){const text=JSON.stringify(value);assert.ok(!text.includes('models/'));assert.ok(!text.includes('filePath'));}
test('profiles validate without changing price, legacy files, or license',()=>{
 const parsed=productSchema.parse(product);assert.equal(parsed.priceCents,1290);assert.equal(parsed.license,product.license);assert.equal(parsed.filePath,product.filePath);assert.equal(parsed.printProfiles[0].layerHeight,0.2);
 assert.deepEqual(productSchema.parse({...product,printProfiles:undefined}).printProfiles,[]);
 for(const changes of [{id:'original'},{id:'../escape'},{filePath:'https://evil.invalid/file.3mf'},{filePath:'models/../secret.3mf'},{filePath:''},{name:''},{layerHeight:-1},{layerHeight:NaN}])assert.equal(productSchema.safeParse({...product,printProfiles:[{...profile,...changes}]}).success,false);
 assert.equal(productSchema.safeParse({...product,printProfiles:[profile,profile]}).success,false);
 assert.equal(productSchema.safeParse({...product,printProfiles:[{...profile,filePath:product.filePath}]}).success,false);
 for(const access of ['maker','members'])assert.equal(productSchema.safeParse({...product,access,priceCents:0,url:'https://makerworld.com/en/models/123'}).success,false);
 assert.equal(productSchema.safeParse({...product,exclusive:true}).success,false);
 assert.equal(productSchema.safeParse({...product,printProfiles:Array.from({length:21},(_,i)=>({...profile,id:'p'+i,filePath:`models/p${i}.3mf`}))}).success,false);
});
test('public and unowned member catalogs expose metadata, never private file paths or download links',()=>{
 const publicProduct=publicCatalog(data).products[0];noPaths(publicProduct);assert.equal(publicProduct.hasFile,true);assert.equal(publicProduct.printProfiles.length,2);assert.ok(publicProduct.printProfiles.every(p=>!p.downloadUrl));
 const unowned=clubProducts(data)[0];noPaths(unowned);assert.equal(unowned.downloadUrl,'');assert.ok(unowned.printProfiles.every(p=>!p.downloadUrl));
 const owned=clubProducts(data,new Set([product.id]))[0];noPaths(owned);assert.equal(owned.printProfiles.length,2);assert.ok(owned.printProfiles.every(p=>p.downloadUrl.startsWith('/api/download?id=family-test&profile=')));
 const free=clubProducts({...data,products:[{...product,access:'site',priceCents:0}]})[0];assert.equal(free.printProfiles.length,2);assert.ok(free.printProfiles.every(p=>p.downloadUrl));
});
test('legacy links resolve primary file; profiles-only products are purchasable and unknown IDs never fall back',()=>{
 assert.equal(resolveProductFile(product,null).filePath,product.filePath);assert.equal(resolveProductFile(product,'layer-020').filePath,profile.filePath);
 for(const id of ['', '../other','models/optimized.3mf','missing'])assert.equal(resolveProductFile(product,id),undefined);
 const only={...product,filePath:''};assert.equal(resolveProductFile(only,null).id,profile.id);assert.equal(productFiles(only).length,1);
 assert.equal(quoteCart({...data,products:[only]},[{kind:'product',id:only.id}]).totalCents,1290);
 assert.equal(quoteCart(data,[{kind:'collection',id:'family'}]).totalCents,2000);
});
test('protected streaming binds each profile to the purchased work and transfers the correct bytes',async()=>{
 let readPaths=[],records=0,allowed=true;
 const deps={hasAccess:async(member,id)=>{assert.equal(id,product.id);return allowed},record:async()=>records++,readBlob:async path=>{readPaths.push(path);return {stream:new ReadableStream({start(c){c.enqueue(Buffer.from(path));c.close();}})}}};
 for(const profileId of [null,'original','layer-020']){
  const chunks=[],headers={},res=new Writable({write(chunk,encoding,callback){chunks.push(chunk);callback();}});res.setHeader=(k,v)=>headers[k]=v;
  await serveProductDownload({member:{id:'buyer'},data,productId:product.id,profileId,res},deps);await finished(res);
  const expected=profileId==='layer-020'?profile.filePath:product.filePath;assert.equal(Buffer.concat(chunks).toString(),expected);assert.equal(headers['Cache-Control'],'private, no-store');assert.ok(headers['Content-Disposition'].endsWith('.3mf"'));
 }
 assert.equal(records,3);allowed=false;
 await assert.rejects(()=>serveProductDownload({member:{},data,productId:product.id,profileId:'layer-020'},deps),{status:403});assert.equal(readPaths.length,3);
 allowed=true;
 for(const profileId of ['removed','models/optimized.3mf','../another'])await assert.rejects(()=>serveProductDownload({member:{},data,productId:product.id,profileId},deps),{status:404});
 for(const changes of [{published:false},{exclusive:true},{access:'maker'},{access:'members'}])await assert.rejects(()=>serveProductDownload({member:{},data:{...data,products:[{...product,...changes}]},productId:product.id,profileId:'layer-020'},deps),{status:404});
 await assert.rejects(()=>serveProductDownload({member:{},data:{...data,collections:[]},productId:product.id,profileId:'layer-020'},deps),{status:404});assert.equal(readPaths.length,3);
});
test('admin roundtrip, historical singles and bundles, refunds, PDF license and route authentication',async()=>{
 const keys=['DATABASE_URL','POSTGRES_URL','VERCEL','BLOB_READ_WRITE_TOKEN','LOCAL_DATA_DIR','ASAAS_ENVIRONMENT','ADMIN_SESSION_SECRET'],env=Object.fromEntries(keys.map(k=>[k,process.env[k]])),dir=await mkdtemp(join(tmpdir(),'print-profiles-test-'));
 for(const key of keys)delete process.env[key];Object.assign(process.env,{LOCAL_DATA_DIR:dir,ASAAS_ENVIRONMENT:'sandbox',ADMIN_SESSION_SECRET:'print-profiles-testing-secret-32-characters'});
 const member={id:'buyer',name:'Buyer',email:'buyer@example.invalid',countryCode:'BR',version:'member-version'},admin={version:'admin-version'},cookie=`tiolira_club=${await makeSession(member.version,{memberId:member.id})}`,adminCookie=`tiolira_admin=${await makeSession(admin.version)}`;
 const call=async(route,{method='GET',cookie:session=cookie,body={}}={})=>{let result;await handler({method,url:'/api/'+route,body,headers:{host:'localhost',origin:'http://localhost',cookie:session},socket:{remoteAddress:'profile-test'}},{setHeader(){},set statusCode(s){this.status=s},end(v){result={status:this.status||200,body:Buffer.isBuffer(v)?v:JSON.parse(v)}}});return result;};
 try{
  await writeRecord('catalog.json',data,null);await writeRecord('club-members.json',{members:[member]},null);await writeRecord('admin.json',admin,null);
  assert.equal((await call('download?id=family-test&profile=layer-020',{cookie:''})).status,401);
  assert.equal((await call('download?id=family-test&profile=layer-020')).status,403);
  const catalog=await readRecord('catalog.json');
  assert.equal((await call('admin/products',{method:'PUT',body:{item:product,revision:catalog.etag}})).status,401);
  const saved=await call('admin/products',{method:'PUT',cookie:adminCookie,body:{item:product,revision:catalog.etag}});assert.equal(saved.status,200,JSON.stringify(saved));
  assert.equal((await call('admin/catalog',{cookie:adminCookie})).body.products[0].printProfiles[0].filePath,profile.filePath);
  const license={code:'TL-TEST',productId:product.id,productName:product.name,memberId:member.id,partnerName:member.name,status:'active',issuedAt:new Date().toISOString(),terms:'Autorizada a venda das peças físicas.'};
  const order={id:'old-order',environment:'sandbox',memberId:member.id,status:'paid',createdAt:new Date().toISOString(),totalCents:1290,productIds:[product.id],items:[{kind:'product',id:product.id,name:product.name,priceCents:1290,products:[{id:product.id,name:product.name}]}],licenses:[license]};
  await writeRecord('commerce.json',{orders:[order]},null);
  assert.equal(await purchaseAccess(member,product.id),true);
  let library=await shop(member);assert.equal(library.products[0].printProfiles.length,2);noPaths(library);assert.ok(library.products[0].printProfiles.every(p=>p.downloadUrl));assert.equal(library.orders[0].licenses[0].code,license.code);
  assert.equal((await downloadablePurchaseLicense(member,license.code)).code,license.code);
  const pdf=await call('club/licenses/download?code=TL-TEST');assert.equal(pdf.status,200);assert.equal(pdf.body.subarray(0,4).toString(),'%PDF');
  await updateRecord('catalog.json',old=>{old.products[0].printProfiles.push({...profile,id:'layer-024',name:'Novo perfil',layerHeight:0.24,filePath:'models/new.3mf'});return old;});
  library=await shop(member);assert.equal(library.products[0].printProfiles.length,3);assert.equal(library.orders[0].licenses[0].code,license.code);
  await updateRecord('commerce.json',old=>{old.orders[0].items[0].kind='collection';return old;});assert.equal((await shop(member)).products[0].printProfiles.length,3);
  await updateRecord('commerce.json',old=>{old.orders[0].status='revoked';return old;});assert.equal(await purchaseAccess(member,product.id),false);assert.ok((await shop(member)).products[0].printProfiles.every(p=>!p.downloadUrl));assert.equal((await call('download?id=family-test&profile=layer-020')).status,403);assert.equal((await call('club/licenses/download?code=TL-TEST')).status,404);
 }finally{for(const key of keys)env[key]===undefined?delete process.env[key]:process.env[key]=env[key];await rm(dir,{recursive:true,force:true});}
});
