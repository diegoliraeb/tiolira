import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {readRecord,writeRecord} from '../server/store.mjs';
import {correctMemberEmail,recordDirectAnnualPayment,inspectAnnualPayment} from '../server/admin-member-support.mjs';
import {applyAnnualPayment} from '../server/maker-asaas-annual.mjs';
import {annualLicense} from '../server/maker-subscriptions.mjs';
import {makeSession,requireClub} from '../server/auth.mjs';
import handler from '../server/handler.mjs';

test('admin support preserves account identity, prevents duplicate emails and sends once; external receipt settles only matched pending payment',async()=>{
 const saved={...process.env},fetch0=globalThis.fetch,dir=await mkdtemp(join(tmpdir(),'tl-support-'));
 for(const k of ['DATABASE_URL','POSTGRES_URL','VERCEL','BLOB_READ_WRITE_TOKEN'])delete process.env[k];
 Object.assign(process.env,{LOCAL_DATA_DIR:dir,ADMIN_SESSION_SECRET:'support-test-32-characters-never-production',ASAAS_API_KEY:'test',ASAAS_ENVIRONMENT:'sandbox',ASAAS_WEBHOOK_TOKEN:'test-webhook-32-characters-long-token',RESEND_API_KEY:'test',EMAIL_FROM:'Test <test@example.invalid>',SITE_URL:'https://www.tiolira.com.br'});
 const a={id:randomUUID(),name:'Client',email:'client@gmai.com',version:randomUUID(),hash:'keep-hash',countryCode:'BR'},b={id:randomUUID(),email:'other@example.com',version:'other'},admin={email:'admin@example.com',version:'admin'};
 const root={id:randomUUID(),memberId:a.id,name:a.name,email:a.email,provider:'asaas',environment:'sandbox',annual:true,annualState:'active',subscriptionId:'sub_test',customerId:'cus_test',paymentId:'pay_test',billingType:'PIX',status:'pending',currency:'BRL',totalCents:4990,firstDueDate:'2026-11-21',createdAt:'2026-11-21T09:00:00Z'};
 let remote={id:'pay_test',customer:'cus_test',subscription:'sub_test',billingType:'PIX',value:49.9,status:'PENDING',dueDate:'2026-11-21'},emails=0,cashPosts=0,allPosts=[];
 globalThis.fetch=async(url,o={})=>{const u=new URL(url);let data;allPosts.push([u.hostname,u.pathname,o.method||'GET']);
  if(u.hostname==='api.resend.com'){emails++;const body=JSON.parse(o.body);assert.deepEqual(body.to,['client@gmail.com']);assert.match(body.text,/mesma senha/);data={id:'email_test'};}
  else if(u.pathname==='/v3/payments/pay_test/receiveInCash'){cashPosts++;assert.deepEqual(JSON.parse(o.body),{paymentDate:'2026-11-21',value:49.9,notifyCustomer:false});remote={...remote,billingType:'RECEIVED_IN_CASH',status:'RECEIVED_IN_CASH',paymentDate:'2026-11-21'};data=remote;}
  else if(u.pathname==='/v3/payments/pay_test')data=remote;
  else if(u.pathname==='/v3/subscriptions/sub_test')data={id:'sub_test',customer:'cus_test',externalReference:'tl-maker-annual:'+root.id,billingType:'PIX',cycle:'YEARLY',value:49.9,status:'ACTIVE',nextDueDate:'2027-11-21'};
  else if(u.pathname==='/v3/subscriptions/sub_test/payments')data={data:[remote],hasMore:false};
  else throw Error('Unexpected provider call '+u.pathname);return {ok:true,json:async()=>data};};
 try{
  await writeRecord('admin.json',admin,null);await writeRecord('club-members.json',{members:[a,b]},null);await writeRecord('catalog.json',{stores:[{id:'store',email:a.email}],products:[],collections:[],settings:{}},null);await writeRecord('maker-license-purchases.json',{purchases:[root]},null);
  const session=await makeSession(a.version,{memberId:a.id}),adminCookie='tiolira_admin='+await makeSession(admin.version);
  async function api(route,body,{cookie='',origin='http://localhost'}={}){let status,data;await handler({url:'/api/'+route,method:'POST',headers:{host:'localhost',origin,cookie},body,socket:{remoteAddress:'test'}},{setHeader(){},set statusCode(v){status=v},end(v){data=JSON.parse(v)}});return {status,data}}
  for(const path of ['admin/member-email','admin/maker-subscriptions/inspect','admin/maker-subscriptions/direct-receipt']){
   assert.equal((await api(path,{})).status,401);assert.equal((await api(path,{}, {cookie:adminCookie,origin:'https://evil.invalid'})).status,403);
  }
  const change={memberId:a.id,oldEmail:a.email,newEmail:'client@gmail.com',requestId:randomUUID()};
  await assert.rejects(correctMemberEmail(admin,{...change,newEmail:b.email}),/outro cadastro/);assert.equal(emails,0);
  assert.equal((await correctMemberEmail(admin,change)).emailStatus,'sent');await correctMemberEmail(admin,change);assert.equal(emails,1);
  const record=(await readRecord('club-members.json')).data,member=record.members[0];assert.equal(member.id,a.id);assert.equal(member.hash,a.hash);assert.equal(member.email,'client@gmail.com');assert.deepEqual(record.members[1],b);assert.equal(record.emailCorrections.length,1);assert.equal((await readRecord('catalog.json')).data.stores[0].email,member.email);
  await assert.rejects(requireClub({headers:{cookie:'tiolira_club='+session}}));assert.equal((await readRecord('maker-license-purchases.json')).data.purchases.length,1);
  const receipt={memberId:a.id,confirmed:true,paymentDate:'2026-11-21',reference:'bank-reference-12345',valueCents:4990};
  await assert.rejects(recordDirectAnnualPayment(admin,{...receipt,confirmed:false}));
  const original={...remote};remote.customer='cus_other';await assert.rejects(recordDirectAnnualPayment(admin,receipt),/conferência/);remote=original;assert.equal(cashPosts,0);
  // An unapproved external payment cannot be accepted by the normal webhook path.
  await assert.rejects(applyAnnualPayment(root.id,{...remote,billingType:'RECEIVED_IN_CASH',status:'RECEIVED_IN_CASH',paymentDate:'2026-11-21'}),/corresponde/);
  const pending=await inspectAnnualPayment(a.id);assert.equal(pending.active,false);assert.equal(pending.payments[0].status,'PENDING');
  const result=await recordDirectAnnualPayment(admin,receipt);assert.equal(result.active,true);assert.equal(result.validUntil,'2027-11-21T03:00:00.000Z');assert.equal(cashPosts,1);
  await recordDirectAnnualPayment(admin,receipt);assert.equal(cashPosts,1);const paid=(await readRecord('maker-license-purchases.json')).data.purchases;assert.equal(paid.length,1);assert.equal(paid[0].status,'paid');assert.equal(paid[0].directReceipt.status,'confirmed');
  assert.equal((await annualLicense(member)).status,'active');assert.equal((await annualLicense(member)).validUntil,result.validUntil);
  await assert.rejects(recordDirectAnnualPayment(admin,{...receipt,memberId:b.id}),/outro cadastro/);
  remote={...remote,status:'PENDING',billingType:'PIX'};const undone=await inspectAnnualPayment(a.id);assert.equal(undone.active,false);
  assert.ok(!allPosts.some(([,path,method])=>method==='POST'&&['/v3/subscriptions','/v3/payments','/v3/customers'].includes(path)));
 }finally{globalThis.fetch=fetch0;for(const k of Object.keys(process.env))if(!(k in saved))delete process.env[k];Object.assign(process.env,saved);await rm(dir,{recursive:true,force:true});}
});
