import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {readRecord,writeRecord,updateRecord} from '../server/store.mjs';
import {makeSession,passwordHash,requireClub} from '../server/auth.mjs';
import handler from '../server/handler.mjs';
import seed from '../data/catalog.json' with {type:'json'};

test('temporary password is admin-only, scoped, one-use, expiring and cannot bypass mandatory replacement',async()=>{
 const env={...process.env},dir=await mkdtemp(join(tmpdir(),'tl-temp-password-'));for(const k of ['DATABASE_URL','POSTGRES_URL','VERCEL','BLOB_READ_WRITE_TOKEN'])delete process.env[k];Object.assign(process.env,{LOCAL_DATA_DIR:dir,ADMIN_SESSION_SECRET:'temporary-password-test-secret-only-32characters'});
 let count=0;async function api(route,body={},cookie='',method='POST',origin='http://localhost'){let result;const headers={};await handler({url:'/api/'+route,method,body,headers:{host:'localhost',origin,cookie},socket:{remoteAddress:'temp-test-'+count++}},{setHeader(k,v){headers[k]=v},set statusCode(v){this.status=v},end(v){result={status:this.status,data:JSON.parse(v),headers}}});return result;}
 const cookie=r=>r.headers['Set-Cookie'].split(';')[0];
 try{
  const admin={email:'admin@example.invalid',version:randomUUID()},member={id:randomUUID(),name:'Teste',email:'partner@example.invalid',version:randomUUID(),hash:await passwordHash('original-password-123'),countryCode:'BR'},other={id:'other',email:'other@example.invalid',hash:'untouched',version:'other'};
  const catalog=structuredClone(seed);catalog.stores=[{id:member.id,email:member.email,name:member.name},{id:'legacy',email:'legacy@example.invalid',name:'Legacy'}];await writeRecord('catalog.json',catalog,null);await writeRecord('admin.json',admin,null);await writeRecord('club-members.json',{members:[member,other]},null);
  const a='tiolira_admin='+await makeSession(admin.version),original='tiolira_club='+await makeSession(member.version,{memberId:member.id}),body={storeId:member.id,email:member.email};
  assert.equal((await api('admin/partners/temporary-password',body)).status,401);
  assert.equal((await api('admin/partners/temporary-password',body,a,'POST','https://evil.invalid')).status,403);
  assert.equal((await api('admin/partners/temporary-password',{...body,email:'wrong@example.invalid'},a)).status,409);
  let issued=await api('admin/partners/temporary-password',body,a);assert.equal(issued.status,200);const password=issued.data.password;assert.ok(password.length>=20);
  assert.ok(!JSON.stringify((await readRecord('club-members.json')).data).includes(password));assert.ok(!JSON.stringify((await readRecord('catalog.json')).data).includes(password));assert.deepEqual((await readRecord('club-members.json')).data.members[1],other);
  await assert.rejects(requireClub({headers:{cookie:original}}));
  assert.equal((await api('club/login',{email:member.email,password:'original-password-123'})).status,401);
  const login=await api('club/login',{email:member.email,password});assert.equal(login.status,200);assert.deepEqual(login.data,{passwordChangeRequired:true});const restricted=cookie(login);
  assert.equal((await api('club/login',{email:member.email,password})).status,401);
  assert.deepEqual((await api('club/me',{},restricted,'GET')).data,{passwordChangeRequired:true});
  assert.equal((await api('club/licenses',{productId:'anything'},restricted)).status,403);
  assert.equal((await api('club/profile',{},restricted,'PUT')).status,403);
  assert.equal((await api('club/change-temporary-password',{password,confirmPassword:password},restricted)).status,400);
  assert.equal((await api('club/change-temporary-password',{password:'new-personal-password',confirmPassword:'different'},restricted)).status,400);
  const changed=await api('club/change-temporary-password',{password:'new-personal-password',confirmPassword:'new-personal-password'},restricted);assert.equal(changed.status,200);
  assert.equal((await requireClub({headers:{cookie:cookie(changed)}})).id,member.id);await assert.rejects(requireClub({headers:{cookie:restricted}},{allowPasswordChange:true}));
  assert.equal((await api('club/change-temporary-password',{password:'another-personal-password',confirmPassword:'another-personal-password'},restricted)).status,401);
  assert.equal((await api('club/login',{email:member.email,password})).status,401);
  assert.equal((await api('club/login',{email:member.email,password:'new-personal-password'})).status,200);
  const next=await api('admin/partners/temporary-password',body,a);assert.equal(next.status,200);
  await updateRecord('club-members.json',old=>{old.members[0].temporaryPassword.expiresAt=Date.now()-1;return old});
  assert.equal((await api('club/login',{email:member.email,password:next.data.password})).status,401);
  const last=await api('admin/partners/temporary-password',body,a);const concurrent=await Promise.all([api('club/login',{email:member.email,password:last.data.password}),api('club/login',{email:member.email,password:last.data.password})]);assert.deepEqual(concurrent.map(r=>r.status).sort(),[200,401]);
  const legacy=await api('admin/partners/temporary-password',{storeId:'legacy',email:'legacy@example.invalid'},a);assert.equal(legacy.status,200);assert.equal((await readRecord('club-members.json')).data.members.filter(m=>m.email==='legacy@example.invalid').length,1);
  assert.deepEqual((await readRecord('catalog.json')).data.stores,catalog.stores);
 }finally{for(const k of Object.keys(process.env))if(!(k in env))delete process.env[k];Object.assign(process.env,env);await rm(dir,{recursive:true,force:true})}
});
