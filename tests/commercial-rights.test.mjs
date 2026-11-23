import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {readRecord,writeRecord,updateRecord,getCatalog} from '../server/store.mjs';
import {makeSession} from '../server/auth.mjs';
import handler from '../server/handler.mjs';
import {activateManualAnnual} from '../server/admin-member-support.mjs';
import {annualLicense} from '../server/maker-subscriptions.mjs';
import {issueProductCommercialLicense,adminCommercialRights} from '../server/commercial-rights.mjs';
import {issueLicense} from '../server/club.mjs';
import {commercialEntitlement} from '../lib/maker-license.mjs';
import seed from '../data/catalog.json' with {type:'json'};

test('commercial rights matrix: subscription covers eligible paid files without unlocking them; own/free rights survive expiry; personal-only always blocked',async()=>{
 const saved={...process.env},fetch0=globalThis.fetch,dir=await mkdtemp(join(tmpdir(),'tl-rights-'));
 for(const k of ['DATABASE_URL','POSTGRES_URL','VERCEL','BLOB_READ_WRITE_TOKEN'])delete process.env[k];
 Object.assign(process.env,{LOCAL_DATA_DIR:dir,ADMIN_SESSION_SECRET:'rights-test-secret-at-least-32-characters',ASAAS_ENVIRONMENT:'sandbox',PAYPAL_ENVIRONMENT:'sandbox'});globalThis.fetch=async()=>{throw Error('Unexpected external call')};
 const member={id:randomUUID(),name:'Test',email:'test@example.invalid',version:'member',countryCode:'BR'},admin={email:'admin@example.invalid',version:'admin'};
 const base={...seed.products[0],collection:'test',access:'paid',priceCents:1990,published:true,url:'',filePath:'models/test.3mf',printProfiles:[],exclusive:false,allowPhysicalSales:false,includedInSubscription:false};
 const products=[{...base,id:'paid',name:'Avulsa'},{...base,id:'included',name:'Incluída',includedInSubscription:true},{...base,id:'maker',name:'Maker',access:'maker',priceCents:0,url:'https://makerworld.com/pt/models/3612025'},{...base,id:'free',name:'Grátis',access:'site',priceCents:0,allowPhysicalSales:true},{...base,id:'96f7f843-b608-4a57-8f27-6ba12e2862da',name:'Senna',access:'subscribers',priceCents:0},{...base,id:'restricted',name:'Restrita',access:'site',priceCents:0},{...base,id:'hidden',published:false}];
 try{
  await writeRecord('admin.json',admin,null);await writeRecord('club-members.json',{members:[member]},null);await writeRecord('catalog.json',{...seed,products,collections:[{id:'test',name:'Teste',published:true}]},null);
  const cookie='tiolira_club='+await makeSession(member.version,{memberId:member.id}),adminCookie='tiolira_admin='+await makeSession(admin.version);
  const call=async(path,body,c=cookie)=>{let status,data;await handler({method:'POST',url:'/api/'+path,headers:{host:'localhost',origin:'http://localhost',cookie:c},body,socket:{remoteAddress:'rights-test'}},{setHeader(){},set statusCode(v){status=v},end(v){data=JSON.parse(v)}});return {status,data};};
  const announcement=async(c=cookie)=>{let status,data;await handler({method:'GET',url:'/api/club/maker-subscription/license?format=json',headers:{host:'localhost',cookie:c},socket:{remoteAddress:'rights-test'}},{setHeader(){},set statusCode(v){status=v},end(v){data=JSON.parse(v)}});return {status,data};};
  assert.equal((await announcement('')).status,401);
  assert.equal((await announcement()).status,403);
  assert.equal((await call('admin/maker-subscriptions/rights',{memberId:member.id})).status,401);
  assert.equal((await call('club/licenses',{productId:'paid'})).status,403);
  const free=await issueProductCommercialLicense(member,'free');assert.ok(free.code);
  await assert.rejects(issueLicense(member,products[0]),{status:403});
  await activateManualAnnual(admin,{memberId:member.id,requestId:randomUUID(),confirmed:true,kind:'courtesy',reason:'Teste de licenças e acesso'});
  for(const id of ['paid','included','maker']){const res=await call('club/licenses',{productId:id});assert.equal(res.status,200,id);assert.equal(res.data.license.source,'annual');assert.ok(res.data.license.validUntil);assert.ok(res.data.license.productIds.includes(id));}
  for(const id of ['restricted','hidden','96f7f843-b608-4a57-8f27-6ba12e2862da'])assert.equal((await call('club/licenses',{productId:id})).status,403,id);
  const report=await adminCommercialRights(member.id);assert.equal(report.products.find(p=>p.id==='paid').download,'purchase');assert.equal(report.products.find(p=>p.id==='included').download,'site');assert.equal(report.products.find(p=>p.id==='maker').download,'makerworld');assert.equal(report.products.find(p=>p.id===products[4].id).personalOnly,true);
  assert.equal((await call('admin/maker-subscriptions/rights',{memberId:member.id},adminCookie)).status,200);
  const ad=await announcement();assert.equal(ad.status,200);assert.deepEqual(Object.keys(ad.data.license).sort(),['code','status','validUntil']);assert.equal(ad.data.license.code,(await annualLicense(member)).code);
  let record=(await readRecord(`club-licenses/${member.id}.json`)).data;assert.equal(record.annualCertificates.length,1);assert.ok(!record.annualCertificates[0].productIds.includes('restricted'));assert.ok(!record.annualCertificates[0].productIds.includes(products[4].id));
  const own={code:'TL-COMPRA-TEST',memberId:member.id,productId:'paid',productName:'Avulsa',source:'purchase',issuedAt:new Date().toISOString(),terms:'Original perpetual terms',orderId:'test'};
  await writeRecord('commerce.json',{orders:[{id:'test',memberId:member.id,provider:'asaas',environment:'sandbox',status:'paid',productIds:['paid'],licenses:[own]}]},null);
  assert.equal((await issueProductCommercialLicense(member,'paid')).code,own.code);
  await updateRecord('maker-license-purchases.json',d=>{d.purchases[0].endsAt='2021-01-01T03:00:00Z';d.purchases[0].startsAt='2020-01-01T03:00:00Z';return d});
  assert.equal((await announcement()).status,403);
  await assert.rejects(annualLicense(member),{status:403});assert.equal((await issueProductCommercialLicense(member,'paid')).terms,own.terms);assert.equal((await issueProductCommercialLicense(member,'free')).code,free.code);await assert.rejects(issueProductCommercialLicense(member,'included'),{status:403});
  await updateRecord('commerce.json',d=>{d.orders[0].status='refunded';return d});await assert.rejects(issueProductCommercialLicense(member,'paid'),{status:403});
  assert.equal(commercialEntitlement(products[4],{owned:true,legacy:true,annual:true}),null);
  record=(await readRecord(`club-licenses/${member.id}.json`)).data;assert.equal(record.annualCertificates.length,1,'expired access does not overwrite previous certificate');
 }finally{globalThis.fetch=fetch0;for(const k of Object.keys(process.env))if(!(k in saved))delete process.env[k];Object.assign(process.env,saved);await rm(dir,{recursive:true,force:true});}
});
