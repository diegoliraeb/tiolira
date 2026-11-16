import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {countries,countryName} from '../lib/geography.mjs';
import {normalizeStoreLocation} from '../server/geography.mjs';
import {clubRegistrationSchema} from '../server/schema.mjs';
import {directoryStores} from '../lib/store-directory.mjs';
import {servesLocation} from '../lib/store-search.mjs';
import handler from '../server/handler.mjs';
import {readRecord,writeRecord} from '../server/store.mjs';
import seed from '../data/catalog.json' with {type:'json'};

const profile={name:'International test',email:'international@example.invalid',password:'Test-international-123!',countryCode:'IE',country:'Ireland',city:'Dublin',state:'',whatsapp:'353851234567',description:'',delivery:'',consent:true,directoryConsent:false};

test('every foreign country accepts a typed city without a city database or mandatory state',async()=>{
 for(const c of countries.filter(c=>c.code!=='BR')){
  const parsed=clubRegistrationSchema.parse({...profile,countryCode:c.code,country:countryName(c.code),city:'São João – 東京'});
  const result=await normalizeStoreLocation(parsed);
  assert.equal(result.city,'São João – 東京');assert.equal(result.state,'');assert.equal(result.cityId,'');assert.equal(result.country,countryName(c.code));
 }
 const result=await normalizeStoreLocation({...profile,state:' County Dublin ',stateId:'1072',cityId:'stale',city:' Dublin '});
 assert.equal(result.state,'County Dublin');assert.equal(result.city,'Dublin');assert.equal(result.stateId,'');assert.equal(result.cityId,'');
 await assert.rejects(normalizeStoreLocation({...profile,countryCode:'ZZ'}),{status:400});
 await assert.rejects(normalizeStoreLocation({...profile,city:' '}),{status:400});
 await assert.rejects(normalizeStoreLocation({...profile,countryCode:'BR',stateId:'AL',cityId:'Dublin'}),{status:400});
 assert.equal(clubRegistrationSchema.safeParse({...profile,city:'x'.repeat(121)}).success,false);
});

test('international directory and delivery use text without mixing countries or ignoring city',async()=>{
 const stores=[{...profile,id:'ie',productIds:[],offeringsUnspecified:true},{...profile,id:'other',countryCode:'US',productIds:[],offeringsUnspecified:true}];
 assert.deepEqual(directoryStores(stores,{countryCode:'IE',city:'dublin'},'','all',[]).map(s=>s.id),['ie']);
 assert.equal(directoryStores(stores,{countryCode:'IE',city:'Cork'},'','all',[]).length,0);
 const cityArea={scope:'city',countryCode:'IE',cities:[{id:'',name:'Dublin',stateId:'',state:''}]};
 const located=await normalizeStoreLocation({...profile,serviceArea:cityArea});
 assert.equal(located.delivery,'Dublin');assert.equal(servesLocation(located,{countryCode:'IE',city:'Dublin'}),true);
 assert.equal(servesLocation(located,{countryCode:'IE',city:'Cork'}),false);assert.equal(servesLocation(located,{countryCode:'US',city:'Dublin'}),false);
 const region=await normalizeStoreLocation({...profile,serviceArea:{scope:'state',countryCode:'IE',state:'County Dublin',cities:[]}});
 assert.equal(servesLocation(region,{countryCode:'IE',state:'county dublin'}),true);
 await assert.rejects(normalizeStoreLocation({...profile,serviceArea:{...cityArea,cities:[...cityArea.cities,...cityArea.cities]}}),{status:400});
});

test('foreign Club and network registration, login and profile edits persist with download/license access',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'tiolira-foreign-'));
 const keys=['DATABASE_URL','POSTGRES_URL','BLOB_READ_WRITE_TOKEN','LOCAL_DATA_DIR','ADMIN_SESSION_SECRET','VERCEL','RESEND_API_KEY','EMAIL_FROM','SITE_URL'];
 const env=Object.fromEntries(keys.map(k=>[k,process.env[k]]));for(const key of keys)delete process.env[key];
 Object.assign(process.env,{LOCAL_DATA_DIR:dir,ADMIN_SESSION_SECRET:'international-tests-only-secret-longer-than-32'});
 let count=0;
 const call=async(route,body={},method='POST',cookie='')=>{
  let result;const headers={};await handler({url:`/api/${route}`,method,body,headers:{host:'localhost',origin:'http://localhost',cookie},socket:{remoteAddress:`foreign-${count++}`}},{setHeader(k,v){headers[k]=v},set statusCode(v){this.status=v},end(v){result={status:this.status,body:JSON.parse(v),headers}}});return result;
 };
 try{
  const data=structuredClone(seed);data.stores=[];data.settings.storesOpen=true;await writeRecord('catalog.json',data,null);
  for(const route of ['club/register','stores/apply']){
   const email=`${route.split('/')[0]}@example.invalid`;
   const response=await call(route,{...profile,email,...(route==='stores/apply'?{serviceArea:{scope:'city',countryCode:'IE',cities:[{name:'Dublin',state:''}]}}:{})});
   assert.equal(response.status,201,JSON.stringify(response.body));
   const login=await call('club/login',{email,password:profile.password});assert.equal(login.status,200);assert.ok(login.body.collectionLicenses.some(l=>l.collectionId==='presepio'));
   const cookie=login.headers['Set-Cookie'].split(';')[0];
   const saved=await call('club/profile',{...profile,city:'Cork',state:'County Cork'},'PUT',cookie);assert.equal(saved.status,200,JSON.stringify(saved.body));assert.equal(saved.body.member.city,'Cork');
   const member=(await readRecord('club-members.json')).data.members.find(m=>m.email===email);
   const store=(await readRecord('catalog.json')).data.stores.find(m=>m.email===email);
   assert.equal(member.city,'Cork');assert.equal(store.city,'Cork');assert.equal(store.state,'County Cork');assert.equal(store.consent,false);
   const invalid=await call('club/profile',{...profile,countryCode:'BR',state:'Alagoas',stateId:'AL',cityId:''},'PUT',cookie);assert.equal(invalid.status,400);
   assert.equal((await readRecord('club-members.json')).data.members.find(m=>m.email===email).countryCode,'IE');
  }
 }finally{for(const key of keys){if(env[key]===undefined)delete process.env[key];else process.env[key]=env[key]}await rm(dir,{recursive:true,force:true});}
});
