import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {financeDay,financeRange,financeLedger,buildFinancialOverview} from '../lib/financial-overview.mjs';
import {readRecord,writeRecord} from '../server/store.mjs';
import {makeSession} from '../server/auth.mjs';
import handler from '../server/handler.mjs';
const envs={asaas:'production',paypal:'production'},now=Date.parse('2026-11-24T15:00:00Z');
const paid=(id,extra={})=>({id,paymentId:id,provider:'asaas',environment:'production',status:'paid',currency:'BRL',totalCents:4990,paidAt:'2026-11-24T12:00:00Z',...extra});
test('Maceio boundaries, monthly clamping and validated ranges',()=>{
 assert.equal(financeDay('2026-11-24T02:59:59Z'),'2026-11-23');assert.equal(financeDay('2026-11-24T03:00:00Z'),'2026-11-24');
 const day=financeRange({count:7},now);assert.equal(day.from,'2026-11-18');assert.equal(day.previousFrom,'2026-11-11');assert.equal(day.previousTo,'2026-11-17');assert.equal(day.previousEnd,Date.parse('2026-11-17T15:00:00Z'));assert.equal(day.keys.length,7);
 const month=financeRange({mode:'month',count:6},Date.parse('2024-08-31T15:00:00Z'));assert.equal(month.from,'2024-03-01');assert.equal(month.previousTo,'2024-02-29');assert.equal(month.previousFrom,'2023-09-01');
 for(const filters of [{mode:'year'},{currency:'EUR'},{count:1},{count:'NaN'},{mode:'month',count:30}])assert.throws(()=>financeRange(filters),e=>e.status===400);
});
test('confirmed net order totals, renewals, legacy deduplication and separate currencies',()=>{
 const records={commerce:{orders:[paid('collection',{totalCents:12990,items:[{priceCents:99999},{priceCents:99999}],memberEmail:'private@example.invalid'}),paid('usd',{provider:'paypal',currency:'USD',captureId:'sale-usd',totalCents:899}),paid('pending',{status:'pending'}),paid('free',{totalCents:0}),paid('sandbox',{environment:'sandbox'})]},purchases:{purchases:[paid('annual'),paid('renewal',{paidAt:'2026-11-23T12:00:00Z',startsAt:'2027-11-23T12:00:00Z'}),paid('courtesy',{provider:'manual',manualActivation:{kind:'courtesy'}}),paid('external',{provider:'manual',manualActivation:{kind:'external'}}),paid('test-manual',{provider:'manual',environment:'sandbox'}),paid('undated',{paidAt:null}),paid('scheduled',{status:'pending',migrationSourceId:'annual'})]},legacy:{subscriptions:[{provider:'asaas',environment:'production',status:'cancelled',periods:[{paymentId:'annual',startsAt:'2026-11-24',endsAt:'2027-11-24'},{paymentId:'old',startsAt:'2026-11-21',endsAt:'2027-11-21'}]}]}};
 const result=buildFinancialOverview(records,envs,{count:7},now);
 assert.equal(result.summary.piecesCents,12990);assert.equal(result.summary.subscriptionsCents,4990*4);assert.equal(result.summary.subscriptionsCount,4);assert.equal(result.summary.totalCents,32950);assert.equal(result.series.length,7);assert.equal(result.series.find(x=>x.key==='2026-11-23').subscriptionsCents,4990);assert.equal(result.diagnostics.duplicates,1);assert.equal(result.diagnostics.undated,1);assert.equal(result.diagnostics.legacyDates,1);
 assert.equal(result.series.reduce((n,r)=>n+r.totalCents,0),result.summary.totalCents);assert.equal(JSON.stringify(result).includes('private@example'),false);
 const usd=buildFinancialOverview(records,envs,{currency:'USD'},now);assert.equal(usd.summary.totalCents,899);assert.equal(usd.summary.piecesCount,1);
});
test('refund tombstones win in either order, conflicting duplicates are excluded',()=>{
 for(const rows of [[paid('same'),paid('same',{status:'revoked'})],[paid('same',{status:'revoked'}),paid('same')]])assert.equal(financeLedger({purchases:{purchases:rows}},envs).payments.length,0);
 const records={purchases:{purchases:[paid('a'),paid('b'),paid('b',{totalCents:9990}),paid('invalid',{currency:'EUR'})]},legacy:{subscriptions:[{environment:'production',periods:[{paymentId:'a',revoked:true}]}]}};
 const result=financeLedger(records,envs);assert.equal(result.payments.length,0);assert.equal(result.diagnostics.revoked,1);assert.equal(result.diagnostics.invalid,2);
});
test('comparison excludes future and same-period late payments; zero days are preserved',()=>{
 const rows=[paid('today',{totalCents:1000}),paid('future',{paidAt:'2026-11-24T16:00:00Z'}),paid('previous',{paidAt:'2026-11-17T14:00:00Z',totalCents:500}),paid('too-late',{paidAt:'2026-11-17T16:00:00Z'}),paid('old',{paidAt:'2026-11-10T16:00:00Z'})];
 const result=buildFinancialOverview({commerce:{orders:rows}},envs,{count:7},now);assert.equal(result.summary.totalCents,1000);assert.equal(result.previous.totalCents,500);assert.equal(result.changePercent,100);assert.equal(result.series[0].totalCents,0);
 const empty=buildFinancialOverview({},envs,{mode:'month',count:12},now);assert.equal(empty.series.length,12);assert.equal(empty.summary.totalCents,0);assert.equal(empty.changePercent,null);
});
test('admin-only report is no-store, aggregate-only and read-only',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'tiolira-finance-')),keys=['DATABASE_URL','POSTGRES_URL','VERCEL','BLOB_READ_WRITE_TOKEN','LOCAL_DATA_DIR','ASAAS_ENVIRONMENT','PAYPAL_ENVIRONMENT','ADMIN_SESSION_SECRET'],saved=Object.fromEntries(keys.map(k=>[k,process.env[k]]));for(const k of keys)delete process.env[k];Object.assign(process.env,{LOCAL_DATA_DIR:dir,ASAAS_ENVIRONMENT:'production',PAYPAL_ENVIRONMENT:'production',ADMIN_SESSION_SECRET:'finance-test-only-secret-at-least-32-characters'});
 const admin={version:randomUUID()},member={id:randomUUID(),version:randomUUID(),email:'private@example.invalid'},commerce={orders:[paid('real',{paidAt:new Date().toISOString(),memberEmail:member.email})],downloads:{},recentDownloads:[]};
 const call=async(query='',cookie='')=>{const out={headers:{}};await handler({method:'GET',url:'/api/admin/financial-overview'+query,headers:{host:'localhost',origin:'http://localhost',cookie},socket:{remoteAddress:'finance-test'}},{setHeader(k,v){out.headers[k]=v},set statusCode(s){out.status=s},end(v){out.body=JSON.parse(v)}});return out;};
 try{await writeRecord('admin.json',admin,null);await writeRecord('club-members.json',{members:[member]},null);await writeRecord('commerce.json',commerce,null);
  const cookie=`tiolira_admin=${await makeSession(admin.version)}`,memberCookie=`tiolira_club=${await makeSession(member.version,{memberId:member.id})}`;
  assert.equal((await call()).status,401);assert.equal((await call('',memberCookie)).status,401);assert.equal((await call('?count=999',cookie)).status,400);
  const response=await call('',cookie);assert.equal(response.status,200);assert.equal(response.headers['Cache-Control'],'private, no-store');assert.equal(response.body.summary.piecesCents,4990);assert.equal(JSON.stringify(response.body).includes(member.email),false);assert.deepEqual((await readRecord('commerce.json')).data,commerce);assert.equal(await readRecord('maker-license-purchases.json'),null);
 }finally{for(const k of keys){if(saved[k]===undefined)delete process.env[k];else process.env[k]=saved[k];}await rm(dir,{recursive:true,force:true});}
});
