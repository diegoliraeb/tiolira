import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {writeRecord,readRecord,updateRecord} from '../server/store.mjs';
import {recordCart} from '../server/analytics.mjs';
import {cartKey} from '../server/cart-state.mjs';
import {runCartReminders,sendTestCartReminder,sendCartReminder,recoverCart,unsubscribeCartReminders,reminderReport,assertReminderCron,reminderEmail} from '../server/cart-reminders.mjs';
import {makeSession} from '../server/auth.mjs';
import {recoveryToken} from '../lib/cart-reminder-copy.mjs';
import {partnerRoute} from '../lib/partner-navigation.mjs';
import handler from '../server/handler.mjs';
import seed from '../data/catalog.json' with {type:'json'};

const HOUR=3600000;
test('reminder copy and links do not expose account identity and escape item names',()=>{
 for(const lang of ['pt','en','es','fr']){const result=reminderEmail({lang,items:[{name:'<script>evil & "name"</script>'}]},'https://www.tiolira.com.br','abc','xyz');assert.ok(!result.html.includes('<script>'));assert.ok(result.html.includes('&lt;script&gt;'));assert.ok(result.text.includes(`/${lang}/clube#recuperar=abc`));assert.ok(result.text.includes(`/${lang}/lembretes#cancelar=xyz`));}
 assert.equal(recoveryToken('#recuperar=bad'),null);assert.deepEqual(partnerRoute('#recuperar=token'),{section:'compras',collection:'all'});
});

test('cart reminders: delivery, private recovery, opt-out and commerce regression',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'tiolira-reminders-')),keys=['DATABASE_URL','POSTGRES_URL','VERCEL','VERCEL_ENV','BLOB_READ_WRITE_TOKEN','LOCAL_DATA_DIR','ASAAS_ENVIRONMENT','PAYPAL_ENVIRONMENT','ADMIN_SESSION_SECRET','CRON_SECRET','RESEND_API_KEY','EMAIL_FROM','SITE_URL'];
 const env=Object.fromEntries(keys.map(k=>[k,process.env[k]])),oldFetch=global.fetch;for(const k of keys)delete process.env[k];Object.assign(process.env,{LOCAL_DATA_DIR:dir,ASAAS_ENVIRONMENT:'sandbox',PAYPAL_ENVIRONMENT:'sandbox',ADMIN_SESSION_SECRET:'reminder-test-secret-at-least-32-characters',CRON_SECRET:'local-cron-only',RESEND_API_KEY:'local-mock-only',EMAIL_FROM:'Tio Lira <test@example.invalid>',SITE_URL:'https://www.tiolira.com.br'});
 const now=Date.parse('2026-10-16T15:00:00Z'),member={id:randomUUID(),version:randomUUID(),name:'Teste',email:'test@example.invalid',countryCode:'BR'},other={id:randomUUID(),version:randomUUID(),email:'other@example.invalid',countryCode:'BR'},admin={version:randomUUID()};
 const catalog=structuredClone(seed),pieces=['reminder-saci','reminder-cuca'].map(id=>({id,name:id,slug:id,collection:'reminder-folclore',published:true,access:'paid',priceCents:1690,filePath:`models/${id}.3mf`}));catalog.products.push(...pieces);catalog.collections.push({id:'reminder-folclore',name:'Folclore',published:true,free:false,priceCents:2990});
 const requests=[];let failDelivery=false,fetchGate=null;
 global.fetch=async(url,options)=>{assert.equal(url,'https://api.resend.com/emails');requests.push({headers:options.headers,body:JSON.parse(options.body)});if(fetchGate)await fetchGate;if(failDelivery)throw Error('timeout');return {ok:true,json:async()=>({id:'fake-delivery-id'})};};
 const reset=async()=>{await updateRecord('analytics/carts.json',()=>({carts:{}}));await updateRecord('analytics/cart-reminders.json',()=>({jobs:{},optOut:{}}));await updateRecord('commerce.json',()=>({orders:[],downloads:{'reminder-saci':7},recentDownloads:[]}));requests.length=0;failDelivery=false;fetchGate=null;};
 const newCart=async({age=6*HOUR,who=member,items=[{kind:'product',id:'reminder-saci'}],lang='pt'}={})=>{const cartId=randomUUID();await recordCart(who,{cartId,sequence:1,items,lang},now-age);const cart=(await readRecord('analytics/carts.json')).data.carts[who.id+':'+cartId];return {cart,id:cartKey(cart)};};
 const tokens=()=>({recover:requests.at(-1).body.text.match(/#recuperar=([^\s]+)/)[1],stop:requests.at(-1).body.text.match(/#cancelar=([^\s]+)/)[1]});
 const call=async(route,{method='GET',body={},cookie='',origin='http://localhost',authorization}={})=>{const result={};await handler({method,url:'/api/'+route,body,headers:{host:'localhost',origin,cookie,authorization},socket:{remoteAddress:'reminder-test'}},{setHeader(){},set statusCode(n){result.status=n},end(v){result.body=JSON.parse(v)}});return result;};
 try{
 await writeRecord('catalog.json',catalog,null);await writeRecord('club-members.json',{members:[member,other]},null);await writeRecord('admin.json',admin,null);
 const memberCookie=`tiolira_club=${await makeSession(member.version,{memberId:member.id})}`,adminCookie=`tiolira_admin=${await makeSession(admin.version)}`;
 await t.test('scheduler and manual sending cannot be invoked by visitors or club members',async()=>{
  assert.throws(()=>assertReminderCron({headers:{}}));assert.throws(()=>assertReminderCron({headers:{authorization:'Bearer wrong'}}));assert.doesNotThrow(()=>assertReminderCron({headers:{authorization:'Bearer local-cron-only'}}));
  assert.equal((await call('cron/cart-reminders')).status,401);assert.equal((await call('admin/cart-reminders/send',{method:'POST'})).status,401);assert.equal((await call('admin/cart-reminders/send',{method:'POST',cookie:memberCookie})).status,401);
  assert.equal((await call('admin/cart-reminders/send',{method:'POST',cookie:adminCookie,origin:'https://evil.invalid'})).status,403);assert.equal((await call('club/cart-recover',{method:'POST'})).status,401);
 });
 await t.test('automatic threshold is exactly six hours and manual sends do not wait six hours',async()=>{
  await reset();let c=await newCart({age:6*HOUR-1});assert.equal((await runCartReminders(now)).sent,0);assert.equal(requests.length,0);assert.equal((await runCartReminders(now+1)).sent,1);assert.equal(requests.length,1);assert.equal((await runCartReminders(now+2)).sent,0);await assert.rejects(()=>sendCartReminder(c.id,{now:now+3}),/já enviado/);
  await reset();c=await newCart({age:2*HOUR});assert.equal((await runCartReminders(now)).sent,0);await sendCartReminder(c.id,{now});assert.equal(requests.length,1);assert.equal((await runCartReminders(now+6*HOUR)).sent,0);
 });
 await t.test('recovery requires the matching login and preserves bundle, price, licenses and files',async()=>{
  await reset();const c=await newCart({items:[{kind:'collection',id:'reminder-folclore'}],lang:'fr'}),before=structuredClone((await readRecord('commerce.json')).data);await sendCartReminder(c.id,{now});const {recover,stop}=tokens();assert.equal(recoveryToken('#recuperar='+recover),recover);await assert.rejects(()=>recoverCart(other,recover,now),e=>e.status===403);await assert.rejects(()=>recoverCart(member,recover+'x',now),e=>e.status===410);await assert.rejects(()=>recoverCart(member,stop,now),e=>e.status===410);
  const result=await recoverCart(member,recover,now);assert.deepEqual(result.items,[{kind:'collection',id:'reminder-folclore'}]);assert.equal(result.cartId,c.cart.cartId);assert.equal(result.sequence,1);assert.equal(result.status,'restored');assert.deepEqual((await readRecord('commerce.json')).data,before);
  const api=await call('club/cart-recover',{method:'POST',cookie:memberCookie,body:{token:recover}});assert.equal(api.status,200);assert.deepEqual(api.body.items,result.items);assert.ok(requests[0].body.text.includes('/fr/clube#recuperar='));await assert.rejects(()=>recoverCart(member,recover,now+31*24*HOUR),e=>e.status===410);
 });
 await t.test('purchases and pending payments suppress email; an old link opens the existing order',async()=>{
  for(const status of ['paid','pending','creating','review','overdue']){await reset();const c=await newCart();const order={id:randomUUID(),memberId:member.id,environment:'sandbox',provider:'asaas',status,createdAt:new Date(now-HOUR).toISOString(),productIds:['reminder-saci']};await updateRecord('commerce.json',s=>({...s,orders:[order]}));assert.equal((await runCartReminders(now)).sent,0);await assert.rejects(()=>sendCartReminder(c.id,{now}));assert.equal(requests.length,0);}
  await reset();const c=await newCart();await sendCartReminder(c.id,{now});const token=tokens().recover;const order={id:randomUUID(),memberId:member.id,environment:'sandbox',provider:'asaas',status:'paid',createdAt:new Date(now).toISOString(),productIds:['reminder-saci']};await updateRecord('commerce.json',s=>({...s,orders:[order]}));assert.equal((await recoverCart(member,token,now)).orderId,order.id);
 });
 await t.test('newer, cleared, old and wrong-environment carts do not send, and activity resets six-hour delay',async()=>{
  await reset();const old=await newCart();await newCart({age:HOUR});assert.equal((await runCartReminders(now)).sent,0);await assert.rejects(()=>sendCartReminder(old.id,{now}),/mais recente/);
  await reset();let c=await newCart();await recordCart(member,{cartId:c.cart.cartId,sequence:2,items:[]},now-HOUR);assert.equal((await runCartReminders(now)).sent,0);
  await reset();c=await newCart({age:31*24*HOUR});assert.equal((await runCartReminders(now)).sent,0);
  await reset();c=await newCart();await recordCart(member,{cartId:c.cart.cartId,sequence:2,items:[{kind:'product',id:'reminder-cuca'}]},now-HOUR);assert.equal((await runCartReminders(now)).sent,0);
  await updateRecord('analytics/carts.json',s=>{Object.values(s.carts)[0].environment='production';return s;});assert.equal((await runCartReminders(now+8*HOUR)).sent,0);
 });
 await t.test('opt-out is durable, purpose-bound and blocks both manual and scheduled emails',async()=>{
  await reset();const c=await newCart();await sendCartReminder(c.id,{now});const {recover,stop}=tokens();await assert.rejects(()=>unsubscribeCartReminders(recover,now));await unsubscribeCartReminders(stop,now);await unsubscribeCartReminders(stop,now);const next=await newCart({age:0});assert.equal((await runCartReminders(now+25*HOUR)).sent,0);await assert.rejects(()=>sendCartReminder(next.id,{now:now+25*HOUR}),/desativou/);assert.equal(requests.length,1);assert.equal((await recoverCart(member,recover,now)).status,'restored');
 });
 await t.test('concurrent admin and cron cannot double-send; one per member in 24 hours',async()=>{
  await reset();const c=await newCart();let release;fetchGate=new Promise(r=>{release=r});const first=sendCartReminder(c.id,{now});while(requests.length===0)await new Promise(r=>setTimeout(r,5));await assert.rejects(()=>sendCartReminder(c.id,{now}),/andamento/);release();await first;fetchGate=null;const next=await newCart({age:0});await assert.rejects(()=>sendCartReminder(next.id,{now:now+6*HOUR}),/24 horas/);assert.equal((await runCartReminders(now+6*HOUR)).sent,0);assert.equal((await runCartReminders(now+25*HOUR)).sent,1);assert.equal(requests.length,2);
 });
 await t.test('uncertain delivery retries exact payload and idempotency key; never blindly retries after expiry',async()=>{
  await reset();const c=await newCart();failDelivery=true;await assert.rejects(()=>sendCartReminder(c.id,{now}),e=>e.status===503);assert.equal((await readRecord('analytics/cart-reminders.json')).data.jobs[c.id].status,'failed');failDelivery=false;await sendCartReminder(c.id,{now:now+HOUR});assert.deepEqual(requests[0].body,requests[1].body);assert.equal(requests[0].headers['Idempotency-Key'],requests[1].headers['Idempotency-Key']);assert.equal((await readRecord('analytics/cart-reminders.json')).data.jobs[c.id].status,'sent');
  await reset();const d=await newCart();failDelivery=true;await assert.rejects(()=>sendCartReminder(d.id,{now}));failDelivery=false;await assert.rejects(()=>sendCartReminder(d.id,{now:now+23*HOUR}),/verificar no provedor/);assert.equal(requests.length,1);
 });
 await t.test('recover removes unavailable pieces and revalidates expired coupons; reports never disclose tokens',async()=>{
  await reset();const c=await newCart({items:pieces.map(p=>({kind:'product',id:p.id}))});await sendCartReminder(c.id,{now});const token=tokens().recover;
  await updateRecord('catalog.json',s=>{s.products.find(p=>p.id==='reminder-cuca').published=false;return s;});await updateRecord('analytics/carts.json',s=>{Object.values(s.carts)[0].coupon='NO-LONGER-VALID';return s;});const result=await recoverCart(member,token,now);assert.equal(result.status,'changed');assert.equal(result.items.length,1);assert.equal(result.couponCode,'');
  const report=await reminderReport(Object.values((await readRecord('analytics/carts.json')).data.carts),[],now);assert.equal(report.history[0].status,'sent');assert.ok(!JSON.stringify(report).includes(token));assert.ok(!JSON.stringify(report).includes('payload'));await updateRecord('catalog.json',()=>catalog);
 });
 await t.test('explicit admin test sends only to an existing member and restores without fabricating abandoned carts or orders',async()=>{
  await reset();const input={email:member.email,requestId:randomUUID()};
  assert.equal((await call('admin/cart-reminders/test',{method:'POST',body:input})).status,401);
  assert.equal((await call('admin/cart-reminders/test',{method:'POST',cookie:memberCookie,body:input})).status,401);
  await assert.rejects(()=>sendTestCartReminder({...input,email:'missing@example.invalid'},now),e=>e.status===404);assert.equal(requests.length,0);
  const before=structuredClone((await readRecord('commerce.json')).data);
  const result=await sendTestCartReminder(input,now);assert.equal(result.email,member.email);assert.equal(result.status,'sent');assert.ok(requests[0].body.subject.startsWith('[TESTE] '));assert.deepEqual(requests[0].body.to,[member.email]);
  assert.equal(Object.keys((await readRecord('analytics/carts.json')).data.carts).length,0);assert.deepEqual((await readRecord('commerce.json')).data,before);
  const token=tokens().recover;const recovered=await recoverCart(member,token,now);assert.equal(recovered.status,'restored');assert.equal(recovered.items.length,1);assert.equal(recovered.cartId,input.requestId);await assert.rejects(()=>recoverCart(other,token,now),e=>e.status===403);
  assert.equal((await runCartReminders(now+6*HOUR)).sent,0);await assert.rejects(()=>sendTestCartReminder(input,now),/já enviado/);assert.equal(requests.length,1);
 });
 await t.test('email configuration failure and preview deployments cannot send messages',async()=>{
  await reset();const c=await newCart();delete process.env.RESEND_API_KEY;await assert.rejects(()=>runCartReminders(now),e=>e.status===503);process.env.RESEND_API_KEY='local-mock-only';process.env.VERCEL='1';process.env.VERCEL_ENV='preview';await assert.rejects(()=>sendCartReminder(c.id,{now}),/produção/);delete process.env.VERCEL;delete process.env.VERCEL_ENV;assert.equal(requests.length,0);
 });
 }finally{global.fetch=oldFetch;for(const [k,v] of Object.entries(env)){if(v===undefined)delete process.env[k];else process.env[k]=v;}await rm(dir,{recursive:true,force:true});}
});
