import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {readRecord,writeRecord,updateRecord} from '../server/store.mjs';
import {activateManualAnnual,searchAnnualMembers} from '../server/admin-member-support.mjs';
import {subscriptionDashboard,refreshSubscription,annualLicense,subscriptionReport} from '../server/maker-subscriptions.mjs';
import {clubProducts} from '../server/club.mjs';
import {makeSession} from '../server/auth.mjs';
import handler from '../server/handler.mjs';
import seed from '../data/catalog.json' with {type:'json'};

test('admin activates registered members without checkout; audited, idempotent, no provider calls, access and revenue correct',async()=>{
 const saved={...process.env},fetch0=globalThis.fetch,dir=await mkdtemp(join(tmpdir(),'tl-manual-'));
 for(const k of ['DATABASE_URL','POSTGRES_URL','VERCEL','BLOB_READ_WRITE_TOKEN'])delete process.env[k];
 Object.assign(process.env,{LOCAL_DATA_DIR:dir,ADMIN_SESSION_SECRET:'manual-test-secret-at-least-32-characters',ASAAS_ENVIRONMENT:'sandbox',PAYPAL_ENVIRONMENT:'sandbox'});
 globalThis.fetch=async()=>{throw Error('Unexpected external call')};
 const admin={email:'admin@example.invalid',version:'admin'},members=['José','Client','Pending','Expired'].map(name=>({id:randomUUID(),name,email:name+'@example.invalid',version:randomUUID(),countryCode:'BR'}));
 const product={...seed.products[0],id:'exclusive-model',slug:'exclusive-model',collection:'collection',access:'subscribers',published:true,filePath:'models/test.3mf',url:'',exclusive:false,allowPhysicalSales:false};
 try{
  await writeRecord('admin.json',admin,null);await writeRecord('club-members.json',{members},null);
  await writeRecord('catalog.json',{...seed,products:[product],collections:[{id:'collection',published:true}]},null);
  const cookie='tiolira_admin='+await makeSession(admin.version);
  const call=async(action,body,c=cookie,origin='http://localhost')=>{let status,data;await handler({method:'POST',url:'/api/admin/maker-subscriptions/'+action,headers:{host:'localhost',origin,cookie:c},body,socket:{remoteAddress:'manual-test'}},{setHeader(){},set statusCode(v){status=v},end(v){data=JSON.parse(v)}});return {status,data};};
  for(const action of ['manual-activation','member-search']){assert.equal((await call(action,{},'')).status,401);assert.equal((await call(action,{},cookie,'https://evil.invalid')).status,403);}
  const search=await searchAnnualMembers({query:'jose'});assert.equal(search.members[0].id,members[0].id);assert.equal(search.members[0].version,undefined);
  const input={memberId:members[0].id,requestId:randomUUID(),confirmed:true,kind:'courtesy',reason:'Parceria autorizada de teste',reference:''};
  assert.equal((await call('manual-activation',{...input,confirmed:false})).status,400);
  assert.equal((await call('manual-activation',input)).status,200);
  const repeat=await activateManualAnnual(admin,input);assert.equal(repeat.alreadyApplied,true);
  await assert.rejects(activateManualAnnual(admin,{...input,reason:'Outro motivo de teste'}),/outros dados/);
  await assert.rejects(activateManualAnnual(admin,{...input,requestId:randomUUID()}),/já possui/);
  const dashboard=await refreshSubscription(members[0]);assert.equal(dashboard.active,true);assert.equal(dashboard.recurring,null);assert.equal(dashboard.autoRenew,false);assert.equal(dashboard.purchase,null);
  assert.ok(clubProducts({products:[product],collections:[{id:'collection',published:true}]},new Set(),dashboard.active)[0].downloadUrl);
  const license=await annualLicense(members[0]);assert.equal(license.status,'active');assert.equal(license.validUntil,dashboard.validUntil);assert.equal(license.memberId,members[0].id);
  let report=await subscriptionReport();assert.equal(report.summary.activeSubscribers,1);assert.equal(report.summary.confirmedPurchases,0);assert.equal(report.summary.totalCents,0);assert.equal(report.subscriptions[0].provider,'manual');assert.equal(report.subscriptions[0].history[0].manualActivation.actor,admin.email);
  const external={...input,memberId:members[1].id,requestId:randomUUID(),kind:'external',reason:'PIX recebido na conta bancária',reference:'bank-reference-test-123'};
  await activateManualAnnual(admin,external);report=await subscriptionReport();assert.equal(report.summary.totalCents,4990);assert.equal(report.summary.confirmedPurchases,1);assert.equal(report.summary.activeSubscribers,2);
  await assert.rejects(activateManualAnnual(admin,{...external,memberId:members[3].id,requestId:randomUUID()}),/comprovante/);
  await updateRecord('maker-license-purchases.json',d=>{d.purchases.push({id:randomUUID(),memberId:members[2].id,provider:'asaas',environment:'sandbox',status:'pending'});return d});
  await assert.rejects(activateManualAnnual(admin,{...input,memberId:members[2].id,requestId:randomUUID()}),/em andamento/);
  await updateRecord('maker-license-purchases.json',d=>{const r=d.purchases.find(r=>r.memberId===members[0].id);r.startsAt='2020-01-01T03:00:00Z';r.endsAt='2021-01-01T03:00:00Z';return d});
  assert.equal((await subscriptionDashboard(members[0])).active,false);await assert.rejects(annualLicense(members[0]),/não está ativa/);
  await activateManualAnnual(admin,{...input,requestId:randomUUID()});assert.equal((await subscriptionDashboard(members[0])).active,true);
  const rows=(await readRecord('maker-license-purchases.json')).data.purchases;assert.equal(rows.filter(r=>r.manualActivation).length,3);assert.ok(rows.every(r=>!r.subscriptionId&&!r.paymentId));
 }finally{globalThis.fetch=fetch0;for(const k of Object.keys(process.env))if(!(k in saved))delete process.env[k];Object.assign(process.env,saved);await rm(dir,{recursive:true,force:true});}
});
