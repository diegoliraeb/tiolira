import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import handler from '../server/handler.mjs';
import {readRecord,writeRecord,updateRecord} from '../server/store.mjs';
import {ensurePartnerListing,registerPartner,partnerForRecovery} from '../server/partners.mjs';
import {issueLicense} from '../server/club.mjs';
import sharp from 'sharp';
import seed from '../data/catalog.json' with {type:'json'};

test('network and Club share one partner account',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'tiolira-unified-'));
 const keys=['DATABASE_URL','POSTGRES_URL','BLOB_READ_WRITE_TOKEN','LOCAL_DATA_DIR','ADMIN_SESSION_SECRET','VERCEL','RESEND_API_KEY','EMAIL_FROM','SITE_URL'];
 const env=Object.fromEntries(keys.map(k=>[k,process.env[k]])),originalFetch=globalThis.fetch;
 for(const key of keys)delete process.env[key];
 Object.assign(process.env,{LOCAL_DATA_DIR:dir,ADMIN_SESSION_SECRET:'unified-partner-tests-only-secret-longer-than-32',RESEND_API_KEY:'test',EMAIL_FROM:'test@example.invalid',SITE_URL:'https://example.invalid'});
 let count=0;
 const call=async(route,{body={},method='POST',cookie=''}={})=>{
  let result;const headers={};await handler({url:`/api/${route}`,method,body,headers:{host:'localhost',origin:'http://localhost',cookie},socket:{remoteAddress:`test-${count++}`}},{setHeader(k,v){headers[k]=v},set statusCode(v){this.status=v},end(v){result={status:this.status,body:Buffer.isBuffer(v)?v:JSON.parse(v),headers}}});return result;
 };
 const profile={name:'Parceiro teste',email:'new@example.invalid',countryCode:'BR',stateId:'AL',cityId:'2704302',city:'Maceió',state:'Alagoas',country:'Brasil',whatsapp:'5582999999999',description:'Peças impressas',delivery:'Retirada',consent:true};
 const password='Partner-test-password-123';
 try{
  const data=structuredClone(seed);data.stores=[];data.settings.storesOpen=true;await writeRecord('catalog.json',data,null);
  await t.test('both forms create one account and one pending listing, with no credentials in catalog',async()=>{
   for(const route of ['club/register','stores/apply']){
    const email=`${route.split('/')[0]}@example.invalid`;
    const response=await call(route,{body:{...profile,email,password,directoryConsent:true}});assert.equal(response.status,201,JSON.stringify(response.body));assert.ok(response.headers['Set-Cookie']);
    const login=await call('club/login',{body:{email,password}});assert.equal(login.status,200);assert.equal(login.body.network.status,'pending');
    const member=(await readRecord('club-members.json')).data.members.find(m=>m.email===email);
    const listing=(await readRecord('catalog.json')).data.stores.find(s=>s.email===email);assert.equal(listing.id,member.id);
    for(const key of ['password','hash','version','directoryProfile','directoryConsent'])assert.ok(!(key in listing),key);
    const duplicate=await call(route==='club/register'?'stores/apply':'club/register',{body:{...profile,email,password,directoryConsent:true}});assert.equal(duplicate.status,409);assert.equal(duplicate.body.code,'PARTNER_EXISTS');
   }
   assert.equal((await readRecord('club-members.json')).data.members.length,2);assert.equal((await readRecord('catalog.json')).data.stores.length,2);
  });
  await t.test('legacy partners prove email ownership and keep their listing unchanged',async()=>{
   const legacy={...profile,email:'LEGACY@EXAMPLE.INVALID',id:randomUUID(),status:'approved',logo:`/api/store-logo?id=${randomUUID()}`,productIds:[data.products[0].id],createdAt:'2024-01-01',licenseProof:'existing approval',licenseUntil:'2027-12-31'};
   await updateRecord('catalog.json',old=>{old.stores.push(legacy);return old});
   const claim=await call('club/register',{body:{...profile,email:'legacy@example.invalid',password,directoryConsent:true}});assert.equal(claim.status,409);
   const emails=[];globalThis.fetch=async(url,options)=>{emails.push(JSON.parse(options.body));return {ok:true}};
   const reset=await call('club/forgot-password',{body:{email:'legacy@example.invalid'}});assert.equal(reset.status,200);assert.equal(emails.length,1);assert.deepEqual(emails[0].to,['legacy@example.invalid']);
   assert.equal((await call('club/login',{body:{email:'legacy@example.invalid',password}})).status,401);
   const member=(await readRecord('club-members.json')).data.members.find(m=>m.email==='legacy@example.invalid');assert.equal(member.hash,null);assert.equal(member.storeId,legacy.id);
   await partnerForRecovery('legacy@example.invalid');assert.equal((await readRecord('club-members.json')).data.members.filter(m=>m.email==='legacy@example.invalid').length,1);
   const token=emails[0].text.match(/#reset=([a-f0-9]{64})/)[1];assert.equal((await call('club/reset-password',{body:{token,password}})).status,200);
   const login=await call('club/login',{body:{email:'legacy@example.invalid',password}});assert.equal(login.status,200);assert.equal(login.body.network.status,'approved');assert.equal(login.body.member.id,member.id);
   assert.deepEqual((await readRecord('catalog.json')).data.stores.find(s=>s.id===legacy.id),legacy);
  });
  await t.test('existing Club accounts opt in to listing without a second registration or new license identity',async()=>{
   const member=await registerPartner({...profile,email:'club-only@example.invalid'},{password});
   const license=await issueLicense(member,data.products[0]);
   const login=await call('club/login',{body:{email:member.email,password}});assert.equal(login.status,200);assert.equal(login.body.network,null);
   assert.ok(!(await readRecord('catalog.json')).data.stores.some(s=>s.email===member.email));
   const cookie=login.headers['Set-Cookie'].split(';')[0];
   assert.equal((await call('club/network',{cookie,body:{consent:false}})).status,400);
   assert.equal((await call('club/network',{body:{consent:true}})).status,401);
   assert.equal((await call('club/network',{cookie,body:{consent:true}})).body.network.status,'pending');
   await call('club/network',{cookie,body:{consent:true}});
   const dashboard=await call('club/me',{cookie,method:'GET'});assert.equal(dashboard.body.member.id,member.id);assert.equal(dashboard.body.licenses[0].code,license.code);
   assert.equal((await readRecord('catalog.json')).data.stores.filter(s=>s.email===member.email).length,1);
  });
  await t.test('incomplete legacy Club profiles stay usable after a rejected listing request',async()=>{
   const member=await registerPartner({name:'Incomplete',email:'incomplete@example.invalid'},{password});
   const login=await call('club/login',{body:{email:member.email,password}});const cookie=login.headers['Set-Cookie'].split(';')[0];
   assert.equal((await call('club/network',{cookie,body:{consent:true}})).status,400);
   assert.equal((await call('club/me',{method:'GET',cookie})).status,200);
   assert.equal((await readRecord('club-members.json')).data.members.find(m=>m.id===member.id).directoryConsent,false);
  });
  await t.test('profile changes synchronize only the signed-in partner and preserve protected fields and licenses',async()=>{
   const email='club@example.invalid';
   const login=await call('club/login',{body:{email,password}});const cookie=login.headers['Set-Cookie'].split(';')[0];
   const before=(await readRecord('club-members.json')).data.members.find(m=>m.email===email);
   const license=await issueLicense(before,data.products[0]);
   await updateRecord('catalog.json',old=>{const s=old.stores.find(s=>s.email===email);s.status='approved';s.productIds=[data.products[0].id];s.licenseProof='kept';return old});
   const input={...profile,name:'Nome atualizado',description:'Descrição atualizada',email:'attacker@example.invalid',id:'forged',hash:'forged',version:'forged',status:'rejected',consent:false,licenseProof:'forged',productIds:[]};
   assert.equal((await call('club/profile',{method:'PUT',body:input})).status,401);
   const result=await call('club/profile',{method:'PUT',cookie,body:input});assert.equal(result.status,200,JSON.stringify(result.body));
   assert.equal(result.body.member.name,input.name);assert.equal(result.body.member.email,email);assert.equal(result.body.member.id,before.id);
   assert.equal(result.body.licenses[0].code,license.code);assert.ok(!('hash' in result.body.member));assert.ok(result.body.collections.every(c=>c.published));
   const after=(await readRecord('club-members.json')).data.members.find(m=>m.id===before.id);assert.equal(after.hash,before.hash);assert.equal(after.version,before.version);assert.equal(after.profilePending,undefined);
   const store=(await readRecord('catalog.json')).data.stores.find(s=>s.email===email);assert.equal(store.name,input.name);assert.equal(store.description,input.description);assert.equal(store.status,'approved');assert.equal(store.licenseProof,'kept');assert.deepEqual(store.productIds,[data.products[0].id]);
   assert.notEqual((await readRecord('catalog.json')).data.stores.find(s=>s.email==='stores@example.invalid').name,input.name);
   const invalid=await call('club/profile',{method:'PUT',cookie,body:{...input,cityId:'missing'}});assert.equal(invalid.status,400);assert.equal((await readRecord('club-members.json')).data.members.find(m=>m.id===before.id).name,input.name);
   const logoData='data:image/png;base64,'+(await sharp({create:{width:10,height:10,channels:3,background:'white'}}).png().toBuffer()).toString('base64');
   await updateRecord('catalog.json',old=>{old.stores.find(s=>s.email===email).status='pending';return old});
   const withLogo=await call('club/profile',{method:'PUT',cookie,body:{...input,logoData}});assert.equal(withLogo.status,200);
   const logoRoute=withLogo.body.member.logo.replace('/api/','');
   assert.equal((await call(logoRoute,{method:'GET'})).status,404);
   assert.ok(Buffer.isBuffer((await call(logoRoute,{method:'GET',cookie})).body));
   const otherLogin=await call('club/login',{body:{email:'stores@example.invalid',password}});assert.equal((await call(logoRoute,{method:'GET',cookie:otherLogin.headers['Set-Cookie'].split(';')[0]})).status,404);
   const removed=await call('club/profile',{method:'PUT',cookie,body:{...input,removeLogo:true}});assert.equal(removed.body.member.logo,'');assert.equal((await readRecord('catalog.json')).data.stores.find(s=>s.email===email).logo,'');
  });
  await t.test('interrupted listing write can recover from saved consent without duplicates',async()=>{
   const member=await registerPartner({...profile,email:'resume@example.invalid'},{password});
   await updateRecord('club-members.json',old=>{old.members.find(m=>m.id===member.id).directoryConsent=true;return old});member.directoryConsent=true;
   await ensurePartnerListing(member);await ensurePartnerListing(member);
   assert.equal((await readRecord('catalog.json')).data.stores.filter(s=>s.email===member.email).length,1);
  });
 }finally{globalThis.fetch=originalFetch;for(const k of keys){if(env[k]===undefined)delete process.env[k];else process.env[k]=env[k]}await rm(dir,{recursive:true,force:true})}
});
