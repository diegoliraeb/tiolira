import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {writeRecord,readRecord} from '../server/store.mjs';
import {makeSession,requireClub} from '../server/auth.mjs';
import handler from '../server/handler.mjs';
import {startSubscription,subscriptionDashboard} from '../server/maker-subscriptions.mjs';
import {MAKER_VERSION} from '../lib/maker-license.mjs';
import {validBillingDocument} from '../lib/billing-document.mjs';

test('subscription billing validates before provider requests; authenticated private save preserves profile and other members',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'tl-cpf-')),saved={...process.env},original=globalThis.fetch;
 for(const k of ['DATABASE_URL','POSTGRES_URL','VERCEL','BLOB_READ_WRITE_TOKEN'])delete process.env[k];
 Object.assign(process.env,{LOCAL_DATA_DIR:dir,ADMIN_SESSION_SECRET:'test-only-billing-secret-at-least-32-characters',ASAAS_ENVIRONMENT:'sandbox',ASAAS_API_KEY:'test-only',ASAAS_WEBHOOK_TOKEN:'test-token-32-characters-long-value',SITE_URL:'https://www.tiolira.com.br'});
 const member={id:'payer',version:'v1',name:'Test',email:'test@example.invalid',countryCode:'BR',city:'Maceió',profilePending:{description:'Keep me'}},other={id:'other',version:'v2',cpfCnpj:'11222333000181'};
 let requests=0,subscriptionPosts=0,remote;
 globalThis.fetch=async(url,o={})=>{
  requests++;const u=new URL(url),b=o.body?JSON.parse(o.body):null;let d;
  if(u.pathname==='/v3/customers'&&o.method==='POST'){assert.equal(b.cpfCnpj,'52998224725');d={id:'cus_test'};}
  else if(u.pathname==='/v3/customers')d={data:[]};
  else if(u.pathname==='/v3/subscriptions'&&o.method==='POST'){subscriptionPosts++;remote={...b,id:'sub_test',status:'ACTIVE'};d=remote;}
  else if(u.pathname==='/v3/subscriptions')d={data:[]};
  else if(u.pathname==='/v3/subscriptions/sub_test')d=remote;
  else if(u.pathname==='/v3/subscriptions/sub_test/payments')d={data:[{id:'pay_test',customer:'cus_test',subscription:'sub_test',billingType:'PIX',value:49.9,dueDate:remote.nextDueDate,status:'PENDING',invoiceUrl:'https://sandbox.asaas.com/i/test'}]};
  else throw Error('Unexpected request');return {ok:true,status:200,json:async()=>d};
 };
 try{
  await writeRecord('club-members.json',{members:[member,other]},null);
  const catalog={stores:[{id:'store',description:'unchanged'}],products:[],collections:[]};await writeRecord('catalog.json',catalog,null);
  const cookie=`tiolira_club=${await makeSession(member.version,{memberId:member.id})}`;
  async function call(value,{auth=true,origin='http://localhost'}={}){let status,result;await handler({url:'/api/club/billing-document',method:'PUT',headers:{host:'localhost',origin,...(auth?{cookie}:{})},body:{cpfCnpj:value},socket:{remoteAddress:'test'}},{setHeader(){},set statusCode(v){status=v},end(v){result=JSON.parse(v)}});return {status,result};}
  assert.equal((await call('52998224725',{auth:false})).status,401);
  assert.equal((await call('52998224725',{origin:'https://evil.invalid'})).status,403);
  for(const bad of ['', '123', '11111111111', '52998224724', '52998224725x', null]){
   assert.equal((await call(bad)).status,400);
   await assert.rejects(()=>startSubscription({...member,cpfCnpj:bad},{consent:true,termsVersion:MAKER_VERSION,billingType:'PIX'}));
  }
  assert.equal(requests,0);assert.equal(await readRecord('maker-license-purchases.json'),null);
  assert.equal((await call('529.982.247-25')).status,200);
  const records=(await readRecord('club-members.json')).data.members;
  assert.deepEqual(records[0],{...member,cpfCnpj:'52998224725'});assert.deepEqual(records[1],other);
  assert.deepEqual((await readRecord('catalog.json')).data,catalog);
  const fresh=await requireClub({headers:{cookie}});
  assert.equal((await subscriptionDashboard(fresh)).billingDocument,'52998224725');
  assert.equal((await subscriptionDashboard({...fresh,countryCode:'IE'})).billingDocument,null);
  const d=await startSubscription(fresh,{consent:true,termsVersion:MAKER_VERSION,billingType:'PIX',lang:'pt'});
  assert.equal(d.purchase.status,'pending');assert.equal(d.purchase.paymentUrl,'https://sandbox.asaas.com/i/test');assert.equal(subscriptionPosts,1);
  await startSubscription(fresh,{consent:true,termsVersion:MAKER_VERSION,billingType:'PIX',lang:'pt'});assert.equal(subscriptionPosts,1);
  assert.ok(validBillingDocument('11.222.333/0001-81'));
 }finally{globalThis.fetch=original;for(const k of Object.keys(process.env))if(!(k in saved))delete process.env[k];Object.assign(process.env,saved);await rm(dir,{recursive:true,force:true});}
});
