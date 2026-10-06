import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import handler from '../server/handler.mjs';
import {readRecord,writeRecord,updateRecord} from '../server/store.mjs';
import {passwordHash,makeSession,verifyPassword} from '../server/auth.mjs';
import {clubProducts} from '../server/club.mjs';
import seed from '../data/catalog.json' with {type:'json'};

test('partner area protects coupons, licenses and password recovery',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'tiolira-club-test-'));
 const keys=['DATABASE_URL','POSTGRES_URL','BLOB_READ_WRITE_TOKEN','LOCAL_DATA_DIR','ADMIN_SESSION_SECRET','VERCEL','RESEND_API_KEY','EMAIL_FROM','SITE_URL'];
 const env=Object.fromEntries(keys.map(k=>[k,process.env[k]])),originalFetch=globalThis.fetch;
 for(const k of keys)delete process.env[k];
 process.env.LOCAL_DATA_DIR=dir;process.env.ADMIN_SESSION_SECRET='club-tests-only-at-least-32-characters-long';
 const call=async(route,{method='POST',body={},cookie='',origin='http://localhost',ip='test'}={})=>{
  let response;const headers={};
  await handler({url:`/api/${route}`,method,body,headers:{host:'localhost',origin,cookie},socket:{remoteAddress:ip}},{setHeader(k,v){headers[k]=v},set statusCode(v){this.status=v},end(value){response={status:this.status,body:JSON.parse(value),headers}}});return response;
 };
 try{
  const hash=await passwordHash('Original-test-password-123');
  const a={id:randomUUID(),name:'Parceiro A',email:'partner-a@example.invalid',hash,version:randomUUID()},b={id:randomUUID(),name:'Parceiro B',email:'partner-b@example.invalid',hash,version:randomUUID()};
  await writeRecord('club-members.json',{members:[a,b]},null);
  const cookieA=`tiolira_club=${await makeSession(a.version,{memberId:a.id})}`,cookieB=`tiolira_club=${await makeSession(b.version,{memberId:b.id})}`;
  const admin={version:randomUUID()};await writeRecord('admin.json',admin,null);const adminCookie=`tiolira_admin=${await makeSession(admin.version)}`;
  const data=structuredClone(seed),product=data.products.find(p=>p.collection==='presepio'&&p.access==='maker');
  const other={...product,id:'other-test',slug:'other-test',collection:'other-test',allowPhysicalSales:false};
  data.collections.push({id:'other-test',published:true});data.products.push(other,{...product,id:'unpublished-test',published:false},{...product,id:'soon-test',access:'soon'},{...product,id:'paid-test',access:'members',allowPhysicalSales:true});
  await writeRecord('catalog.json',data,null);
  await t.test('licenses persist, are unique per partner and piece, and cannot be forged',async()=>{
   assert.equal((await call('club/licenses',{body:{productId:product.id}})).status,401);
   assert.equal((await call('club/licenses',{cookie:cookieA,origin:'https://evil.invalid',body:{productId:product.id}})).status,403);
   for(const id of ['missing',other.id,'unpublished-test','soon-test','paid-test'])assert.equal((await call('club/licenses',{cookie:cookieA,body:{productId:id,canLicense:true}})).status,403);
   const first=await call('club/licenses',{cookie:cookieA,body:{productId:product.id,memberId:b.id,code:'forged'}});assert.equal(first.status,200);assert.equal(first.body.license.memberId,a.id);
   const again=await call('club/licenses',{cookie:cookieA,body:{productId:product.id}});assert.equal(again.body.license.code,first.body.license.code);
   const second=await call('club/licenses',{cookie:cookieB,body:{productId:product.id}});assert.notEqual(second.body.license.code,first.body.license.code);
   const dashboard=await call('club/me',{method:'GET',cookie:cookieA});assert.equal(dashboard.body.licenses.length,1);assert.equal(dashboard.body.licenses[0].memberId,a.id);assert.ok(!('hash' in dashboard.body.member));assert.ok(dashboard.body.downloads.every(p=>!('filePath' in p)));
   await updateRecord('catalog.json',old=>{old.products.find(p=>p.id===other.id).allowPhysicalSales=true;return old});
   assert.equal((await call('club/licenses',{cookie:cookieA,body:{productId:other.id}})).status,200);
   const hidden=structuredClone(data);hidden.collections.find(c=>c.id===product.collection).published=false;assert.ok(!clubProducts(hidden).some(p=>p.id===product.id));
  });
  await t.test('concurrent requests for one piece do not generate duplicate licenses',async()=>{
   const results=await Promise.all([call('club/licenses',{cookie:cookieB,body:{productId:other.id}}),call('club/licenses',{cookie:cookieB,body:{productId:other.id}})]);
   const success=results.filter(r=>r.status===200);assert.ok(success.length);const retry=await call('club/licenses',{cookie:cookieB,body:{productId:other.id}});assert.ok(success.every(r=>r.body.license.code===retry.body.license.code));
   assert.equal((await readRecord(`club-licenses/${b.id}.json`)).data.licenses.filter(l=>l.productId===other.id).length,1);
  });
  await t.test('only admin can manage coupons; expired and inactive coupons stay private',async()=>{
   const coupon={id:randomUUID(),supplier:'Fornecedor de teste',code:'TESTE',description:'Condição de teste',url:'https://example.invalid',active:true,expiresAt:''};
   assert.equal((await call('admin/coupons',{method:'PUT',cookie:cookieA,body:{item:coupon,revision:null}})).status,401);
   let r=await call('admin/coupons',{method:'PUT',cookie:adminCookie,body:{item:coupon,revision:null}});assert.equal(r.status,200);
   assert.equal((await call('admin/coupons',{method:'PUT',cookie:adminCookie,body:{item:coupon,revision:null}})).status,409);
   for(const update of [{active:false},{expiresAt:'2000-01-01T00:00:00.000Z'}]){r=await call('admin/coupons',{method:'PUT',cookie:adminCookie,body:{item:{...coupon,id:randomUUID(),...update},revision:r.body.revision}});assert.equal(r.status,200)}
   assert.equal((await call('club/me',{method:'GET'})).status,401);
   const dashboard=await call('club/me',{method:'GET',cookie:cookieA});assert.deepEqual(dashboard.body.coupons.map(c=>c.id),[coupon.id]);
   const catalog=await call('catalog',{method:'GET'});assert.ok(!('coupons' in catalog.body));
   assert.equal((await call('admin/coupons',{method:'PUT',cookie:adminCookie,body:{item:{...coupon,url:'javascript:alert(1)'},revision:r.body.revision}})).status,400);
   r=await call('admin/coupons',{method:'DELETE',cookie:adminCookie,body:{id:coupon.id,revision:r.body.revision}});assert.equal(r.status,200);assert.equal((await call('club/me',{method:'GET',cookie:cookieA})).body.coupons.length,0);
  });
  await t.test('reset requires configured mail, hides tokens and changes password once',async()=>{
   assert.equal((await call('club/forgot-password',{body:{email:a.email},ip:'reset-config'})).status,503);
   process.env.RESEND_API_KEY='test-only';process.env.EMAIL_FROM='test@example.invalid';process.env.SITE_URL='https://example.invalid';
   const emails=[];globalThis.fetch=async(url,options)=>{assert.equal(url,'https://api.resend.com/emails');emails.push(JSON.parse(options.body));return {ok:true};};
   const unknown=await call('club/forgot-password',{body:{email:'missing@example.invalid'},ip:'reset-unknown'});assert.equal(unknown.status,200);assert.equal(emails.length,0);
   const response=await call('club/forgot-password',{body:{email:a.email,lang:'pt'},ip:'reset-known'});assert.equal(response.status,200);assert.deepEqual(response.body,unknown.body);assert.equal(emails.length,1);
   const repeated=await call('club/forgot-password',{body:{email:a.email},ip:'reset-cooldown'});assert.deepEqual(repeated.body,response.body);assert.equal(emails.length,1);
   assert.equal(emails[0].to[0],a.email);const token=emails[0].text.match(/#reset=([a-f0-9]{64})/)[1];
   const saved=(await readRecord('club-members.json')).data.members[0];assert.equal(saved.passwordReset.hash,createHash('sha256').update(token).digest('hex'));assert.ok(!JSON.stringify(saved).includes(token));
   assert.ok(!('passwordReset' in (await call('club/me',{method:'GET',cookie:cookieA})).body.member));
   assert.equal((await call('club/reset-password',{body:{token,password:'short'},ip:'reset-short'})).status,400);
   const done=await call('club/reset-password',{body:{token,password:'New-test-password-123'},ip:'reset-valid'});assert.equal(done.status,200);
   assert.equal((await call('club/reset-password',{body:{token,password:'Another-test-password-123'},ip:'reset-replay'})).status,400);
   assert.equal((await call('club/me',{method:'GET',cookie:cookieA})).status,401);
   assert.equal((await call('club/login',{body:{email:a.email,password:'Original-test-password-123'},ip:'old-login'})).status,401);
   const login=await call('club/login',{body:{email:a.email,password:'New-test-password-123'},ip:'new-login'});assert.equal(login.status,200);assert.equal(login.body.licenses.length,2);
   const current=(await readRecord('club-members.json')).data.members[0];assert.equal(current.passwordReset,undefined);assert.equal(await verifyPassword('New-test-password-123',current.hash),true);
  });
  await t.test('expired links and delivery failures never change passwords',async()=>{
   const token='a'.repeat(64);await updateRecord('club-members.json',old=>{old.members[1].passwordReset={hash:createHash('sha256').update(token).digest('hex'),expiresAt:Date.now()-1000,createdAt:0};return old});
   assert.equal((await call('club/reset-password',{body:{token,password:'Unwanted-password-123'},ip:'expired'})).status,400);
   globalThis.fetch=async()=>({ok:false});assert.equal((await call('club/forgot-password',{body:{email:b.email},ip:'failed-mail'})).status,503);
   const current=(await readRecord('club-members.json')).data.members[1];assert.equal(current.hash,b.hash);assert.equal(current.passwordReset,undefined);
  });
 }finally{globalThis.fetch=originalFetch;for(const k of keys){if(env[k]===undefined)delete process.env[k];else process.env[k]=env[k]}await rm(dir,{recursive:true,force:true})}
});
