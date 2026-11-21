import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {writeRecord,readRecord} from '../server/store.mjs';
import {LINK_KEY,submitMakerworldLink,memberMakerworldLink} from '../server/makerworld-links.mjs';
import {pauseMakerworldLinks} from '../server/makerworld-pause.mjs';
test('pause rejects only pending, blocks new submissions, preserves active access and retries exact email payload once',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'tl-pause-')),env={...process.env},oldFetch=globalThis.fetch;
 for(const k of ['DATABASE_URL','POSTGRES_URL','VERCEL','BLOB_READ_WRITE_TOKEN'])delete process.env[k];
 Object.assign(process.env,{LOCAL_DATA_DIR:dir,RESEND_API_KEY:'test',EMAIL_FROM:'test@example.invalid',SITE_URL:'https://example.invalid'});
 const m={id:'pending-member',name:'Test',email:'test@example.invalid'},active={id:'active-member'};let calls=[];
 globalThis.fetch=async(url,init)=>{assert.equal(url,'https://api.resend.com/emails');calls.push(init);return calls.length===1?new Response('{}',{status:503}):Response.json({id:'accepted-123'})};
 try{
 await writeRecord('club-members.json',{members:[m]},null);
 const approved={id:'a',memberId:active.id,status:'approved',version:2,startsAt:new Date(Date.now()-1000).toISOString(),endsAt:new Date(Date.now()+86400000).toISOString(),audit:[]};
 await writeRecord(LINK_KEY,{requests:[{id:'p',memberId:m.id,status:'pending',version:1,audit:[]},approved,{id:'r',status:'rejected',version:2}]},null);
 let result=await pauseMakerworldLinks({email:'admin@example.invalid'});assert.equal(result.pending,1);
 let data=(await readRecord(LINK_KEY)).data;assert.equal(data.requests[0].status,'rejected');assert.deepEqual(data.requests[1],approved);assert.equal(data.requests[2].version,2);
 assert.equal((await memberMakerworldLink(m)).checkoutBlocked,false);assert.equal((await memberMakerworldLink(active)).active,true);assert.equal((await memberMakerworldLink(active)).checkoutBlocked,true);
 await assert.rejects(()=>submitMakerworldLink(m,{profile:'test',plan:'test',reference:'123',confirm:true}),/temporariamente/);
 result=await pauseMakerworldLinks({email:'admin@example.invalid'});assert.equal(result.sent,1);assert.equal(calls[0].body,calls[1].body);assert.equal(calls[0].headers['Idempotency-Key'],calls[1].headers['Idempotency-Key']);
 await pauseMakerworldLinks({email:'admin@example.invalid'});assert.equal(calls.length,2);assert.match(JSON.parse(calls[1].body).text,/não pague novamente/);
 }finally{globalThis.fetch=oldFetch;for(const k of Object.keys(process.env))if(!(k in env))delete process.env[k];Object.assign(process.env,env);await rm(dir,{recursive:true,force:true})}
});
