import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import handler from '../server/handler.mjs';
import {makeSession,clubSessionCookie} from '../server/auth.mjs';
import {writeRecord,updateRecord} from '../server/store.mjs';

test('subscriber group requires login and a current paid license, returns no invite in status, rejects expired/refunded and checks both providers',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'tl-subscriber-group-')),saved={...process.env},oldFetch=globalThis.fetch;
 for(const k of ['DATABASE_URL','POSTGRES_URL','VERCEL','BLOB_READ_WRITE_TOKEN'])delete process.env[k];
 Object.assign(process.env,{LOCAL_DATA_DIR:dir,ADMIN_SESSION_SECRET:'subscriber-group-test-secret-at-least-32-characters',ASAAS_ENVIRONMENT:'sandbox',PAYPAL_ENVIRONMENT:'sandbox'});
 globalThis.fetch=async()=>{throw Error('This feature must not send messages or call payment providers')};
 const member={id:'subscriber',name:'Subscriber Test',email:'subscriber@example.invalid',countryCode:'BR',version:'one'};
 const call=async(cookie='',open=false)=>{const out={headers:{}};await handler({method:'GET',url:'/api/club/subscriber-group'+(open?'?join=1':''),headers:{host:'localhost',cookie},socket:{remoteAddress:'group-test'}},{setHeader(k,v){out.headers[k]=v},set statusCode(v){out.status=v},end(v){out.body=v?JSON.parse(v):null}});return out};
 try{
 await writeRecord('club-members.json',{members:[member]},null);
 const cookie=clubSessionCookie(await makeSession(member.version,{memberId:member.id})).split(';')[0];
 assert.equal((await call('',true)).status,401);
 assert.deepEqual((await call(cookie)).body,{active:false});assert.equal((await call(cookie,true)).status,403);
 for(const provider of ['asaas','paypal']){
 const purchase={id:'paid-'+provider,memberId:member.id,provider,environment:'sandbox',status:'paid',createdAt:new Date().toISOString(),startsAt:new Date(Date.now()-10000).toISOString(),endsAt:new Date(Date.now()+86400000).toISOString()};
 await updateRecord('maker-license-purchases.json',()=>({purchases:[purchase]}));
 const status=await call(cookie);assert.deepEqual(status.body,{active:true});assert.equal(status.headers['Cache-Control'],'private, no-store');
 const opened=await call(cookie,true);assert.equal(opened.status,302);assert.match(opened.headers.Location,/^https:\/\/chat.whatsapp.com\//);assert.equal(opened.headers['Referrer-Policy'],'no-referrer');
 await updateRecord('maker-license-purchases.json',d=>{d.purchases[0].endsAt=new Date(Date.now()-1000).toISOString();return d});assert.equal((await call(cookie,true)).status,403);
 await updateRecord('maker-license-purchases.json',d=>{d.purchases[0]={...purchase,status:'refunded'};return d});assert.equal((await call(cookie,true)).status,403);
 }
 }finally{globalThis.fetch=oldFetch;for(const k of Object.keys(process.env))if(!(k in saved))delete process.env[k];Object.assign(process.env,saved);await rm(dir,{recursive:true,force:true})}
});
