import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {readJsonBody,requestBodyLimit} from '../server/request-security.mjs';
import {contentSecurityPolicy} from '../lib/content-security-policy.mjs';
import {rateLimit,makeSession,requireAdmin,requireClub} from '../server/auth.mjs';
import {writeRecord} from '../server/store.mjs';
import handler from '../server/handler.mjs';

const stream=(chunks,headers={})=>Object.assign(Readable.from(chunks),{headers});
test('streamed JSON enforces actual bytes even without or with a false Content-Length',async()=>{
 assert.deepEqual(await readJsonBody(stream(['{"name":"','José"}']),32),{name:'José'});
 await assert.rejects(readJsonBody(stream(['{"x":"','é'.repeat(20),'"}']),20),e=>e.status===413);
 await assert.rejects(readJsonBody(stream(['{"x":"','x'.repeat(20),'"}'],{'content-length':'1'}),20),e=>e.status===413);
 await assert.rejects(readJsonBody(stream([],{'content-length':'999999'}),20),e=>e.status===413);
 await assert.rejects(readJsonBody({headers:{},body:{name:'é'.repeat(20)}},20),e=>e.status===413);
 for(const raw of ['null','[]','"string"','true'])await assert.rejects(readJsonBody(stream([raw])),e=>e.status===400);
 await assert.rejects(readJsonBody(stream(['{invalid'])),SyntaxError);
});
test('small anonymous requests cannot consume the upload allowance; existing photo workflows still fit',async()=>{
 const photo={logoData:'data:image/jpeg;base64,'+'a'.repeat(2_800_000)};
 await readJsonBody({headers:{},body:photo},requestBodyLimit('club/profile'));
 await assert.rejects(readJsonBody({headers:{},body:photo},requestBodyLimit('club/login')),e=>e.status===413);
 assert.ok(requestBodyLimit('admin/upload')>30_000_000);
 assert.equal(requestBodyLimit('analytics/event'),8192);
});
test('production CSP restricts scripts to per-request nonces while permitting existing images and uploads',()=>{
 const nonce='abcdef1234567890abcdef1234567890',policy=contentSecurityPolicy(nonce);
 const scripts=policy.split('; ').find(x=>x.startsWith('script-src'));
 assert.ok(scripts.includes(`'nonce-${nonce}'`));assert.ok(scripts.includes("'strict-dynamic'"));
 assert.ok(!scripts.includes('unsafe-inline'));assert.ok(!scripts.includes('unsafe-eval'));
 assert.ok(policy.includes("object-src 'none'"));assert.ok(policy.includes("frame-ancestors 'none'"));
 assert.ok(policy.includes('connect-src \'self\' https:'));
 assert.ok(policy.includes('upgrade-insecure-requests'));
 assert.ok(!contentSecurityPolicy(nonce,{https:false}).includes('upgrade-insecure-requests'));
 assert.throws(()=>contentSecurityPolicy("injected'; script-src *"));
});
test('account limits survive IP rotation, login sessions cannot cross roles, and admin uploads authenticate before reading',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'tiolira-security-'));
 const keys=['DATABASE_URL','POSTGRES_URL','BLOB_READ_WRITE_TOKEN','LOCAL_DATA_DIR','ADMIN_SESSION_SECRET','VERCEL'];
 const saved=Object.fromEntries(keys.map(k=>[k,process.env[k]]));for(const k of keys)delete process.env[k];
 process.env.LOCAL_DATA_DIR=dir;process.env.ADMIN_SESSION_SECRET='test-security-only-secret-32-characters';
 try{
  const req=ip=>({headers:{host:'localhost',origin:'http://localhost'},socket:{remoteAddress:ip}});
  await rateLimit(req('one'),'account-test',2,600000,'member-one');
  await rateLimit(req('two'),'account-test',2,600000,'member-one');
  await assert.rejects(rateLimit(req('three'),'account-test',2,600000,'member-one'),e=>e.status===429&&e.retryAfter>0);
  await rateLimit(req('one'),'account-test',2,600000,'member-two');
  // Deliberately collide versions: a member token must still never be an admin token.
  await writeRecord('admin.json',{email:'admin@example.invalid',version:'shared-test-version'},null);
  await writeRecord('club-members.json',{members:[{id:'member-one',version:'shared-test-version'}]},null);
  const memberToken=await makeSession('shared-test-version',{memberId:'member-one'});
  await assert.rejects(requireAdmin({headers:{cookie:`tiolira_admin=${memberToken}`}}),e=>e.status===401);
  assert.equal((await requireClub({headers:{cookie:`tiolira_club=${memberToken}`}})).id,'member-one');
  assert.ok(await requireAdmin({headers:{cookie:`tiolira_admin=${await makeSession('shared-test-version')}`}}));
  let consumed=false;const headers={},response={};
  await handler({...req('anon'),url:'/api/admin/upload',method:'POST',async *[Symbol.asyncIterator](){consumed=true;yield Buffer.alloc(1_000_000)}},{setHeader(k,v){headers[k]=v},set statusCode(v){response.status=v},end(v){response.body=JSON.parse(v)}});
  assert.equal(response.status,401);assert.equal(consumed,false);assert.equal(headers['X-Robots-Tag'],'noindex, nofollow');
 }finally{for(const k of keys){if(saved[k]===undefined)delete process.env[k];else process.env[k]=saved[k]}await rm(dir,{recursive:true,force:true})}
});
