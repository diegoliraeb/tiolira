import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {readRecord,writeRecord,updateRecord} from '../server/store.mjs';
import {recordActivity,recordCart,analyticsReport,activityDate,cartState} from '../server/analytics.mjs';
import {trafficSource,activityPage} from '../lib/activity.mjs';
import {makeSession} from '../server/auth.mjs';
import handler from '../server/handler.mjs';
import seed from '../data/catalog.json' with {type:'json'};

test('coarse traffic sources, allowed pages and Maceio day boundaries',()=>{
 assert.equal(trafficSource('https://l.instagram.com/?private=secret'),'instagram');
 assert.equal(trafficSource('https://unknown.example/path?email=x'),'other');
 assert.equal(trafficSource('','google'),'google');assert.equal(trafficSource(''),'direct');
 assert.equal(trafficSource('https://www.tiolira.com.br/admin'),'internal');
 assert.equal(activityPage('/pt/clube').kind,'clube');assert.equal(activityPage('/fr/produto/saci').lang,'fr');
 for(const path of ['/admin','/api/club/me','/pt/clube?token=secret','/pt/clube#reset=secret','https://evil.invalid/pt','/pt/unknown'])assert.equal(activityPage(path),null);
 assert.equal(activityDate(Date.parse('2026-10-15T02:59:00Z')),'2026-10-14');
 assert.equal(activityDate(Date.parse('2026-10-15T03:00:00Z')),'2026-10-15');
});

test('private analytics reports, server-priced carts and preserved commerce',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'tiolira-analytics-')),keys=['DATABASE_URL','POSTGRES_URL','VERCEL','BLOB_READ_WRITE_TOKEN','LOCAL_DATA_DIR','ASAAS_ENVIRONMENT','PAYPAL_ENVIRONMENT','ADMIN_SESSION_SECRET'];
 const env=Object.fromEntries(keys.map(k=>[k,process.env[k]]));for(const k of keys)delete process.env[k];Object.assign(process.env,{LOCAL_DATA_DIR:dir,ASAAS_ENVIRONMENT:'sandbox',PAYPAL_ENVIRONMENT:'sandbox',ADMIN_SESSION_SECRET:'analytics-test-only-secret-at-least-32-characters'});
 const now=Date.parse('2026-10-15T15:00:00Z'),a={id:randomUUID(),version:randomUUID(),name:'Ana Compradora',email:'ana@example.invalid',countryCode:'BR',createdAt:new Date(now).toISOString()},b={id:randomUUID(),version:randomUUID(),name:'Buyer',email:'buyer@example.invalid',countryCode:'FR',createdAt:new Date(now).toISOString()},admin={version:randomUUID()};
 const catalog=structuredClone(seed),pieces=['analytics-saci','analytics-cuca'].map(id=>({id,name:id,slug:id,collection:'analytics-folclore',published:true,access:'paid',priceCents:1690,filePath:`models/${id}.3mf`}));catalog.products.push(...pieces);catalog.collections.push({id:'analytics-folclore',name:'Folclore',published:true,comingSoon:false,free:false,priceCents:2990});
 const req={headers:{'user-agent':'Browser Test','x-forwarded-for':'1.2.3.4'},socket:{remoteAddress:'private-ip-test'}};
 const event=(overrides={})=>({eventId:randomUUID(),sessionId:randomUUID(),type:'page',path:'/pt',source:'instagram',device:'mobile',...overrides});
 const cookieA=`tiolira_club=${await makeSession(a.version,{memberId:a.id})}`,cookieAdmin=`tiolira_admin=${await makeSession(admin.version)}`;
 const call=async(route,{method='GET',body={},cookie='',origin='http://localhost'}={})=>{const result={};await handler({method,url:'/api/'+route,body,headers:{host:'localhost',origin,cookie,'user-agent':'Browser Test'},socket:{remoteAddress:'analytics-api-test'}},{setHeader(){},set statusCode(s){result.status=s},end(v){result.body=JSON.parse(v)}});return result;};
 const cartId=randomUUID(),cart={cartId,sequence:1,items:[{kind:'product',id:pieces[0].id}],totalCents:1,memberId:b.id};
 try{
 await writeRecord('catalog.json',catalog,null);await writeRecord('club-members.json',{members:[a,b]},null);await writeRecord('admin.json',admin,null);await writeRecord('commerce.json',{orders:[],downloads:{'analytics-saci':8},recentDownloads:[]},null);await writeRecord('analytics/product-clicks.json',{counts:{'analytics-saci':27},recent:{}},null);
 await t.test('public visitors cannot read reports or submit carts; cross-origin events rejected',async()=>{
  assert.equal((await call('admin/analytics')).status,401);assert.equal((await call('admin/analytics',{cookie:cookieA})).status,401);
  assert.equal((await call('club/cart-activity',{method:'POST',body:cart})).status,401);
  assert.equal((await call('analytics/event',{method:'POST',body:event(),origin:'https://evil.invalid'})).status,403);
  assert.equal((await call('admin/analytics?days=365',{cookie:cookieAdmin})).status,400);
 });
 await t.test('events deduplicate, sessions aggregate, bots and invalid paths cannot inflate reports',async()=>{
  const first=event();await recordActivity(req,first,now);await recordActivity(req,first,now+10);
  await recordActivity(req,event({sessionId:first.sessionId,path:'/pt/produto/analytics-saci'}),now+20);
  await recordActivity(req,event({type:'product',path:undefined,productId:'analytics-saci',lang:'fr',source:'google',device:'desktop'}),now+30);
  await recordActivity({headers:{'user-agent':'Googlebot'}},event(),now);
  await assert.rejects(()=>recordActivity(req,event({path:'/admin'}),now));await assert.rejects(()=>recordActivity(req,event({path:'/pt/clube?reset=secret'}),now));
  await assert.rejects(()=>recordActivity(req,event({type:'product',productId:'unknown'}),now));
  const report=await analyticsReport(7,now+100);assert.equal(report.summary.views,2);assert.equal(report.summary.sessions,2);assert.equal(report.sources.instagram,1);assert.equal(report.sources.google,1);assert.equal(report.ranking.find(p=>p.id==='analytics-saci').views,2);assert.equal(report.ranking.find(p=>p.id==='analytics-saci').clicks,27);assert.equal(report.ranking.find(p=>p.id==='analytics-saci').downloads,8);
  const serialized=JSON.stringify((await readRecord('analytics/days/2026-10-15.json')).data);for(const value of [first.sessionId,first.eventId,'private-ip-test','1.2.3.4',a.email])assert.ok(!serialized.includes(value));
 });
 await t.test('cart prices and identities come from server, duplicate and stale snapshots do not reset abandonment',async()=>{
  const before=structuredClone((await readRecord('commerce.json')).data);
  await recordCart(a,cart,now-7200000);const stored=(await readRecord('analytics/carts.json')).data.carts[a.id+':'+cartId];assert.equal(stored.totalCents,1690);assert.equal(stored.memberId,a.id);assert.equal(stored.currency,'BRL');
  await recordCart(a,cart,now);assert.equal((await analyticsReport(7,now)).summary.abandoned,1);
  await recordCart(a,{...cart,sequence:3,items:[{kind:'collection',id:'analytics-folclore'}]},now-3600000);
  await recordCart(a,{...cart,sequence:2,items:[]},now);const result=await analyticsReport(7,now);assert.equal(result.summary.abandoned,1);assert.equal(result.abandoned[0].totalCents,2990);assert.equal(result.abandoned[0].productIds.length,2);
  assert.deepEqual((await readRecord('commerce.json')).data,before);
  await recordCart(a,{...cart,sequence:4,items:[]},now);assert.equal((await analyticsReport(7,now)).summary.abandoned,0);
  await assert.rejects(()=>recordCart(a,{...cart,cartId:randomUUID(),items:[{kind:'product',id:'unknown'}]},now));
 });
 await t.test('international cart uses USD prices and is isolated from another buyer cart ID',async()=>{
  await recordCart(b,{...cart,sequence:1},now-7200000);const r=await analyticsReport(7,now);assert.equal(r.summary.abandoned,1);assert.equal(r.summary.abandonedUSD,282);assert.equal(r.summary.abandonedBRL,0);assert.equal(r.abandoned[0].memberEmail,b.email);
 });
 await t.test('matching pending or paid orders remove carts from abandonment without duplicate counting',async()=>{
  const snapshot=(await readRecord('analytics/carts.json')).data.carts[b.id+':'+cartId];
  const order={id:randomUUID(),memberId:b.id,memberName:b.name,memberEmail:b.email,provider:'paypal',environment:'sandbox',currency:'USD',status:'pending',createdAt:new Date(now-3600000).toISOString(),totalCents:282,productIds:['analytics-saci'],items:[{name:'Saci',products:[{id:'analytics-saci',name:'Saci'}]}]};
  const paidBRL={...order,id:randomUUID(),memberId:a.id,memberName:a.name,provider:'asaas',currency:'BRL',status:'paid',totalCents:2990,productIds:pieces.map(p=>p.id),items:[{name:'Coleção',products:pieces.map(p=>({id:p.id,name:p.name}))}]};
  const old={...paidBRL,id:randomUUID(),createdAt:'2020-01-01T12:00:00Z'},wrong={...paidBRL,id:randomUUID(),environment:'production'};
  await updateRecord('commerce.json',s=>({...s,orders:[order,paidBRL,old,wrong]}));
  let r=await analyticsReport(7,now);assert.equal(r.summary.orders,2);assert.equal(r.summary.paid,1);assert.equal(r.summary.pending,1);assert.equal(r.summary.conversion,50);assert.equal(r.summary.abandoned,0);assert.equal(r.summary.revenueBRL,2990);assert.equal(r.summary.revenueUSD,0);assert.equal(r.ranking.find(p=>p.id==='analytics-cuca').sales,1);assert.equal(cartState(snapshot,[order],now),'checkout');
  await updateRecord('commerce.json',s=>{s.orders[0].status='paid';return s;});r=await analyticsReport(7,now);assert.equal(r.summary.paid,2);assert.equal(r.summary.pending,0);assert.equal(r.summary.revenueUSD,282);assert.equal(r.summary.conversion,100);assert.equal(r.summary.abandoned,0);
  assert.equal(cartState(snapshot,[{...order,createdAt:'2020-01-01T12:00:00Z'}],now),'abandoned');
 });
 await t.test('reports keep historical totals distinct and are available only to admin',async()=>{
  const result=await call('admin/analytics?days=30',{cookie:cookieAdmin});assert.equal(result.status,200);assert.equal(result.body.series.length,30);assert.equal(result.body.summary.downloadsTotal,8);assert.ok(result.body.startedAt);
  assert.equal((await readRecord('analytics/product-clicks.json')).data.counts['analytics-saci'],27);
  await assert.rejects(()=>analyticsReport(0,now));
 });
 }finally{for(const [k,v] of Object.entries(env)){if(v===undefined)delete process.env[k];else process.env[k]=v;}await rm(dir,{recursive:true,force:true});}
});
