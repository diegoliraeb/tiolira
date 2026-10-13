import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import seed from '../data/catalog.json' with {type:'json'};
import {downloadPartners} from '../server/download-history.mjs';
import {recordDownload,downloadPartnersReport} from '../server/commerce.mjs';
import {readRecord,writeRecord} from '../server/store.mjs';
import {makeSession} from '../server/auth.mjs';
import handler from '../server/handler.mjs';

test('legacy history groups identities rather than names and keeps first and latest dates',()=>{
 const recentDownloads=[
  {productId:'one',memberId:'a',memberName:'Novo nome',at:'2026-10-13T15:00:00.000Z'},
  {productId:'one',memberId:'a',memberName:'Antigo nome',at:'2026-10-12T15:00:00.000Z'},
  {productId:'one',memberId:'b',memberName:'Novo nome',at:'2026-10-11T15:00:00.000Z'},
  {productId:'two',memberId:'a',memberName:'Novo nome',at:'2026-10-11T15:00:00.000Z'}
 ];
 const rows=downloadPartners({recentDownloads});assert.equal(rows.length,3);
 assert.deepEqual(rows[0],{productId:'one',memberId:'a',memberName:'Novo nome',downloads:2,firstAt:'2026-10-12T15:00:00.000Z',lastAt:'2026-10-13T15:00:00.000Z'});
 assert.equal(recentDownloads[1].memberName,'Antigo nome');
 assert.deepEqual(downloadPartners({recentDownloads,downloadPartners:[]}),[]);
});

test('admin-only details preserve totals beyond the recent event limit and report missing legacy attribution',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'tiolira-download-partners-'));
 const keys=['DATABASE_URL','POSTGRES_URL','BLOB_READ_WRITE_TOKEN','LOCAL_DATA_DIR','ADMIN_SESSION_SECRET','VERCEL'];
 const env=Object.fromEntries(keys.map(key=>[key,process.env[key]]));for(const key of keys)delete process.env[key];
 process.env.LOCAL_DATA_DIR=directory;process.env.ADMIN_SESSION_SECRET='local-download-partners-test-secret-32-characters';
 const a={id:'partner-a',name:'Mesmo nome',email:'a@example.invalid',version:'member-version',hash:'private-password-hash',cpfCnpj:'12345678901'};
 const b={id:'partner-b',name:'Mesmo nome',email:'b@example.invalid'};
 const product=seed.products[0],other=seed.products[1];
 const call=async(productId,cookie)=>{
  const result={headers:{}};await handler({method:'GET',url:`/api/admin/downloads?productId=${encodeURIComponent(productId)}`,headers:{host:'localhost',cookie}},{setHeader(key,value){result.headers[key]=value},set statusCode(value){result.status=value},end(value){result.body=JSON.parse(value)}});return result;
 };
 try{
  await writeRecord('catalog.json',structuredClone(seed),null);
  await writeRecord('club-members.json',{members:[a,b]},null);
  await writeRecord('admin.json',{version:'admin-version'},null);
  const legacy={orders:[],downloads:{[product.id]:8,[other.id]:499},recentDownloads:[
   ...Array.from({length:499},()=>({productId:other.id,productName:other.name,memberId:b.id,memberName:b.name,at:'2026-10-12T12:00:00.000Z'})),
   {productId:product.id,productName:product.name,memberId:a.id,memberName:'Nome antigo',at:'2026-10-11T12:00:00.000Z'}
  ]};
  await writeRecord('commerce.json',legacy,null);
  assert.equal((await call(product.id)).status,401);
  const clubCookie=`tiolira_club=${await makeSession(a.version,{memberId:a.id})}`;
  assert.equal((await call(product.id,clubCookie)).status,401);
  const adminCookie=`tiolira_admin=${await makeSession('admin-version')}`;
  let response=await call(product.id,adminCookie);
  assert.equal(response.status,200);assert.equal(response.headers['Cache-Control'],'private, no-store');
  assert.equal(response.body.totalDownloads,8);assert.equal(response.body.unattributedDownloads,7);
  assert.equal(response.body.partners.length,1);assert.equal(response.body.partners[0].memberName,a.name);assert.equal(response.body.partners[0].memberEmail,a.email);
  assert.ok(!JSON.stringify(response.body).includes('private-password'));assert.ok(!JSON.stringify(response.body).includes(a.cpfCnpj));
  await recordDownload(b,other);
  let record=await readRecord('commerce.json');assert.equal(record.data.recentDownloads.length,500);
  assert.ok(!record.data.recentDownloads.some(event=>event.productId===product.id));
  assert.equal((await downloadPartnersReport(product.id)).partners[0].downloads,1);
  await Promise.all([recordDownload(a,product),recordDownload(a,product),recordDownload(b,product)]);
  response=await call(product.id,adminCookie);
  assert.equal(response.body.totalDownloads,11);assert.equal(response.body.identifiedDownloads,4);assert.equal(response.body.unattributedDownloads,7);
  assert.equal(response.body.partners.length,2);
  assert.equal(response.body.partners.find(p=>p.memberId===a.id).downloads,3);
  assert.equal(response.body.partners.find(p=>p.memberId===b.id).downloads,1);
  record=await readRecord('commerce.json');assert.equal(record.data.downloadPartners.filter(p=>p.productId===product.id).length,2);
  assert.equal((await call(seed.products[2].id,adminCookie)).body.totalDownloads,0);
  assert.equal((await call('unknown-work',adminCookie)).status,404);
  assert.equal((await call('../bad-id',adminCookie)).status,400);
  const members=await readRecord('club-members.json');await writeRecord('club-members.json',{members:[b]},members.etag);
  const deletedAccount=(await downloadPartnersReport(product.id)).partners.find(p=>p.memberId===a.id);
  assert.equal(deletedAccount.memberName,a.name);assert.equal(deletedAccount.memberEmail,'');
 }finally{
  for(const key of keys){if(env[key]===undefined)delete process.env[key];else process.env[key]=env[key];}
  await rm(directory,{recursive:true,force:true});
 }
});
