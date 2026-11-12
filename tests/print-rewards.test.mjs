import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import sharp from 'sharp';
import seed from '../data/catalog.json' with {type:'json'};
import handler from '../server/handler.mjs';
import {makeSession} from '../server/auth.mjs';
import {readRecord,writeRecord,updateRecord} from '../server/store.mjs';
import {memberHasAccess,memberLicenses,shop,quoteCheckout,checkout} from '../server/commerce.mjs';
import {clubDashboard} from '../server/club.mjs';
import {PRINT_ANGLES} from '../lib/print-rewards.mjs';
import {PRINT_REWARDS_KEY} from '../server/print-rewards-access.mjs';
import {printRewardsDashboard,configurePrintRewards,claimPrintReward,uploadPrintRewardPhoto,submitPrintReward,reviewPrintReward,printRewardPhoto} from '../server/print-rewards.mjs';

test('print rewards: five distinct photos, manual review, repeatable grants and privacy',async t=>{
 const keys=['DATABASE_URL','POSTGRES_URL','VERCEL','BLOB_READ_WRITE_TOKEN','LOCAL_DATA_DIR','ADMIN_SESSION_SECRET','ASAAS_ENVIRONMENT','ASAAS_API_KEY','ASAAS_WEBHOOK_TOKEN','PAYPAL_ENVIRONMENT','PAYPAL_CLIENT_ID','PAYPAL_CLIENT_SECRET','PAYPAL_MERCHANT_ID','PAYPAL_WEBHOOK_ID','SITE_URL'];
 const env=Object.fromEntries(keys.map(k=>[k,process.env[k]])),dir=await mkdtemp(join(tmpdir(),'print-rewards-')),originalFetch=globalThis.fetch;
 for(const k of keys)delete process.env[k];Object.assign(process.env,{LOCAL_DATA_DIR:dir,ADMIN_SESSION_SECRET:'print-rewards-tests-secret-more-than-32-chars',ASAAS_ENVIRONMENT:'sandbox',ASAAS_API_KEY:'fake',ASAAS_WEBHOOK_TOKEN:'x'.repeat(32),SITE_URL:'https://example.invalid',PAYPAL_ENVIRONMENT:'sandbox',PAYPAL_CLIENT_ID:'fake',PAYPAL_CLIENT_SECRET:'fake',PAYPAL_MERCHANT_ID:'fake',PAYPAL_WEBHOOK_ID:'fake'});
 globalThis.fetch=async()=>{throw Error('No external payments or messages allowed in these tests');};
 const member={id:randomUUID(),name:'Parceiro A',email:'a@example.invalid',version:'v1',countryCode:'BR',cpfCnpj:'52998224725'},other={...member,id:randomUUID(),name:'Parceiro B'},admin={email:'admin@example.invalid',version:'admin-v1'};
 const cookie=`tiolira_club=${await makeSession(member.version,{memberId:member.id})}`,otherCookie=`tiolira_club=${await makeSession(other.version,{memberId:other.id})}`,adminCookie=`tiolira_admin=${await makeSession(admin.version)}`;
 const base={...seed.products[0],collection:'selected',published:true,exclusive:false,access:'paid',url:'',priceCents:1290,filePath:'models/example.3mf',printProfiles:[]};
 const products=['one','two','three','four'].map(id=>({...base,id,slug:id,name:'Peça '+id}));
 const data={...structuredClone(seed),stores:[],collections:[{id:'selected',name:'Selecionada',published:true,free:false,comingSoon:false},{id:'excluded',name:'Fora',published:true,free:false},{id:'free',name:'Grátis',published:true,free:true}],products:[...products,{...base,id:'excluded',collection:'excluded'},{...base,id:'draft',published:false},{...base,id:'exclusive',exclusive:true},{...base,id:'no-file',filePath:''},{...base,id:'free',collection:'free',access:'site',priceCents:0}]};
 const call=async(route,{method='GET',session=cookie,body={},origin='http://localhost'}={})=>{let result;const headers={};await handler({method,url:'/api/'+route,body,headers:{host:'localhost',origin,cookie:session},socket:{remoteAddress:'rewards-test'}},{setHeader(k,v){headers[k]=v},set statusCode(s){this.status=s},end(v){result={status:this.status||200,body:Buffer.isBuffer(v)?v:JSON.parse(v),headers}}});return result;};
 const photo=async color=>'data:image/png;base64,'+(await sharp({create:{width:700,height:800,channels:3,background:color}}).png().toBuffer()).toString('base64');
 let current,initialRequest,photos=[];
 const active=async()=>((await printRewardsDashboard(member)).claims.find(c=>c.status!=='approved'));
 try{
  await writeRecord('catalog.json',data,null);await writeRecord('club-members.json',{members:[member,other]},null);await writeRecord('admin.json',admin,null);
  await t.test('auth, same-origin and disabled-by-default configuration',async()=>{
   assert.equal((await printRewardsDashboard(member)).enabled,false);
   assert.equal((await call('club/print-rewards',{session:''})).status,401);
   for(const method of ['GET','PUT'])assert.equal((await call('admin/print-rewards',{method})).status,401);
   assert.equal((await call('club/print-rewards/claim',{method:'POST',origin:'https://evil.invalid'})).status,403);
   await assert.rejects(()=>claimPrintReward(member,{productId:'one',requestId:randomUUID(),acceptTerms:true}),/pausada/);
   await assert.rejects(()=>configurePrintRewards(admin,{enabled:true,collectionIds:[],version:null}),/pelo menos/);
   await assert.rejects(()=>configurePrintRewards(admin,{enabled:true,collectionIds:['free'],version:null}),/pagas/);
   const configured=await call('admin/print-rewards',{session:adminCookie,method:'PUT',body:{enabled:true,collectionIds:['selected'],version:null}});assert.equal(configured.status,200);
   await assert.rejects(()=>configurePrintRewards(admin,{enabled:false,collectionIds:[],version:null}),{status:409});
   assert.deepEqual((await printRewardsDashboard(member)).products.map(p=>p.id),['one','two','three','four']);
  });
  await t.test('one free model only, concurrent claims and retries never duplicate grants',async()=>{
   await assert.rejects(()=>claimPrintReward(member,{productId:'excluded',requestId:randomUUID(),acceptTerms:true}),/participantes/);
   initialRequest={productId:'one',requestId:randomUUID(),acceptTerms:true};
   const results=await Promise.allSettled([claimPrintReward(member,initialRequest),claimPrintReward(member,initialRequest)]);assert.ok(results.every(r=>r.status==='fulfilled'));
   assert.equal((await printRewardsDashboard(member)).claims.length,1);current=await active();
   await assert.rejects(()=>claimPrintReward(member,{productId:'two',requestId:randomUUID(),acceptTerms:true}),/aprovação/);
   const retry=await claimPrintReward(member,initialRequest);assert.equal(retry.claims[0].id,current.id);
   assert.equal(await memberHasAccess(member,'one'),true);assert.equal(await memberHasAccess(other,'one'),false);
   const dashboard=await clubDashboard(member,data),piece=dashboard.downloads.find(p=>p.id==='one');assert.equal(piece.priceCents,0);assert.ok(piece.downloadUrl);assert.equal(piece.canPurchase,false);assert.equal(dashboard.collections.find(c=>c.id==='selected').printRewardEligible,true);
   assert.equal((await shop(member)).products.find(p=>p.id==='one').owned,true);
   assert.equal((await readRecord('commerce.json'))?.data?.orders?.length||0,0);
   for(const countryCode of ['BR','US']){const buyer={...member,countryCode},input={items:[{kind:'product',id:'one'}],requestId:randomUUID(),billingType:'PIX',expectedTotalCents:countryCode==='BR'?1290:215};await assert.rejects(()=>quoteCheckout(buyer,input),/já possui/);await assert.rejects(()=>checkout(buyer,input),/já possui/);}
   const license=(await memberLicenses(member)).find(l=>l.productId==='one');assert.equal(license.source,'print-reward');
   assert.equal((await call('club/licenses/download?code='+license.code)).body.subarray(0,4).toString(),'%PDF');assert.equal((await call('club/licenses/download?code='+license.code,{session:otherCookie})).status,404);
  });
  await t.test('exactly five slots, real image validation, distinct images, owner-only access',async()=>{
   await assert.rejects(()=>submitPrintReward(member,{claimId:current.id,version:current.version,confirmPrinted:true,acceptPhotoUse:true}),/cinco fotos/);
   await assert.rejects(async()=>uploadPrintRewardPhoto(other,{claimId:current.id,version:current.version,angle:'front',photo:await photo('red')}),{status:404});
   const invalid=await call('club/print-rewards/photo',{method:'POST',body:{claimId:current.id,version:current.version,angle:'front',photo:'data:image/png;base64,YWJj'}});assert.equal(invalid.status,400);
   photos=await Promise.all(['red','blue','green','yellow','purple'].map(photo));
   for(let i=0;i<5;i++){
    const before=current.version;await uploadPrintRewardPhoto(member,{claimId:current.id,version:before,angle:PRINT_ANGLES[i][0],photo:photos[i]});current=await active();
    if(i===0){await assert.rejects(()=>uploadPrintRewardPhoto(member,{claimId:current.id,version:current.version,angle:'back',photo:photos[0]}),/outro ângulo/);await assert.rejects(()=>uploadPrintRewardPhoto(member,{claimId:current.id,version:before,angle:'back',photo:photos[1]}),{status:409});}
   }
   assert.equal(current.photos.length,5);assert.equal((await call(current.photos[0].url.replace('/api/',''))).headers['Cache-Control'],'private, no-store');
   for(const session of ['',otherCookie])assert.equal((await call(current.photos[0].url.replace('/api/',''),{session})).status,404);
   assert.equal((await call(current.photos[0].url.replace('/api/',''),{session:adminCookie})).status,200);
   await assert.rejects(()=>submitPrintReward(member,{claimId:current.id,version:current.version,confirmPrinted:false,acceptPhotoUse:true}));
   const submit={claimId:current.id,version:current.version,confirmPrinted:true,acceptPhotoUse:true};await submitPrintReward(member,submit);await submitPrintReward(member,submit);current=await active();assert.equal(current.status,'pending');
   assert.equal((await printRewardsDashboard(member)).canClaim,false);await assert.rejects(()=>uploadPrintRewardPhoto(member,{claimId:current.id,version:current.version,angle:'front',photo:photos[0]}),/análise/);
   assert.equal((await call('admin/print-rewards/review',{method:'POST',body:{claimId:current.id,version:current.version,decision:'approved'}})).status,401);
  });
  await t.test('adjustments do not reward; approval is manual, idempotent and unlocks one next model',async()=>{
   await assert.rejects(()=>reviewPrintReward(admin,{claimId:current.id,version:current.version,decision:'changes',feedback:''}),/corrigir/);
   await reviewPrintReward(admin,{claimId:current.id,version:current.version,decision:'changes',feedback:'Refaça a frente com a impressora visível.'});current=await active();assert.equal(current.status,'changes');assert.equal((await printRewardsDashboard(member)).canClaim,false);
   await uploadPrintRewardPhoto(member,{claimId:current.id,version:current.version,angle:'front',photo:await photo('orange')});current=await active();
   await submitPrintReward(member,{claimId:current.id,version:current.version,confirmPrinted:true,acceptPhotoUse:true});current=await active();
   const review={claimId:current.id,version:current.version,decision:'approved'};await Promise.all([reviewPrintReward(admin,review),reviewPrintReward(admin,review)]);
   assert.equal((await printRewardsDashboard(member)).canClaim,true);
   await assert.rejects(()=>claimPrintReward(member,{productId:'one',requestId:randomUUID(),acceptTerms:true}),/já possui/);
   const results=await Promise.allSettled(['two','three'].map(productId=>claimPrintReward(member,{productId,requestId:randomUUID(),acceptTerms:true})));assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
   assert.equal((await printRewardsDashboard(member)).claims.length,2);assert.equal((await printRewardsDashboard(member)).canClaim,false);
   await reviewPrintReward(admin,review);assert.equal((await printRewardsDashboard(member)).canClaim,false);
   assert.equal((await readRecord(PRINT_REWARDS_KEY)).data.claims[0].history.length,2);
  });
  await t.test('cycle can repeat; removing collections or pausing never erases existing files or photo work',async()=>{
   current=await active();const config=(await readRecord(PRINT_REWARDS_KEY)).data.config;
   await configurePrintRewards(admin,{enabled:false,collectionIds:[],version:config.version});
   assert.equal(await memberHasAccess(member,current.productId),true);assert.equal(await memberHasAccess(member,'one'),true);
   for(let i=0;i<5;i++){await uploadPrintRewardPhoto(member,{claimId:current.id,version:current.version,angle:PRINT_ANGLES[i][0],photo:photos[i]});current=await active();}
   await submitPrintReward(member,{claimId:current.id,version:current.version,confirmPrinted:true,acceptPhotoUse:true});current=await active();
   await reviewPrintReward(admin,{claimId:current.id,version:current.version,decision:'approved'});
   assert.equal((await printRewardsDashboard(member)).canClaim,false);
   await configurePrintRewards(admin,{enabled:true,collectionIds:['selected'],version:(await readRecord(PRINT_REWARDS_KEY)).data.config.version});
   assert.equal((await printRewardsDashboard(member)).canClaim,true);assert.equal((await printRewardsDashboard(other)).claims.length,0);
   assert.equal((await call('admin/print-rewards',{session:adminCookie})).body.counts.photos,10);
   assert.equal((await readRecord('catalog.json')).data.products.find(p=>p.id==='one').priceCents,1290);
  });
 }finally{globalThis.fetch=originalFetch;for(const k of keys){if(env[k]===undefined)delete process.env[k];else process.env[k]=env[k];}await rm(dir,{recursive:true,force:true});}
});
