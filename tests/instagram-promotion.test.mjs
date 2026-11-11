import {DIRECT_PAYLOAD} from '../server/instagram-direct-button.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID, createHmac} from 'node:crypto';
import {readRecord, writeRecord, updateRecord, getCatalog} from '../server/store.mjs';
import {createInstagramPromotion} from '../server/instagram-promotion.mjs';
import {createEmailVerification, emailIsVerified} from '../server/partner-email-verification.mjs';
import {PROMOTION_KEY, PROMOTION_ACCOUNTS as accounts, PROMOTION_COLLECTIONS as collections, distinctFriendMentions, instagramPostUrl, validPromotionComment} from '../server/instagram-promotion-rules.mjs';
import {instagramPromotionApi} from '../server/instagram-promotion-api.mjs';
import {createInstagramWebhook} from '../server/instagram-webhook.mjs';
import {redeemInstagramOrder} from '../server/instagram-promotion-order.mjs';
import {memberHasAccess, purchaseLicenses} from '../server/commerce.mjs';
import handler from '../server/handler.mjs';
import {makeSession, clubCookieName} from '../server/auth.mjs';
import {partnerVerificationEmail} from '../server/partner-verification-email.mjs';
import seed from '../data/catalog.json' with {type:'json'};

const envKeys = ['DATABASE_URL','POSTGRES_URL','BLOB_READ_WRITE_TOKEN','LOCAL_DATA_DIR','VERCEL','ADMIN_SESSION_SECRET','ASAAS_ENV'];
test('Instagram promotion: ownership, verification, uniqueness and atomic redemption', async t => {
  const env = Object.fromEntries(envKeys.map(k => [k, process.env[k]]));
  for (const k of envKeys) delete process.env[k];
  process.env.ADMIN_SESSION_SECRET = 'instagram-test-session-secret-at-least-32-characters';
  const root = await mkdtemp(join(tmpdir(), 'tl-instagram-'));
  let fixtureIndex = 0;
  async function fixture({verified = true, active = true, autoDirect = false, sendFails = false} = {}) {
    process.env.LOCAL_DATA_DIR = join(root, String(++fixtureIndex));
    let time = Date.parse('2026-11-15T12:00:00Z'), follows = true, commentFound = true, username = 'participante';
    const sent=[], directSent=[];
    const member = {id: randomUUID(), version: randomUUID(), email: 'member@example.invalid', name: 'Parceiro Teste', countryCode:'BR'};
    if (verified) member.emailVerification = {email:member.email, verifiedAt:new Date(time).toISOString()};
    await writeRecord('club-members.json', {members:[member]}, null);
    const catalog = structuredClone(seed);
    catalog.collections.push(...collections.map((id, i) => ({id,name:i?'Champions':'Brasileirão',published:true,comingSoon:false,free:false})));
    catalog.products = collections.flatMap((collection, index) => [0,1].map(n => ({id:`test-noel-${index}-${n}`,name:`Noel ${index} ${n}`,collection,published:true,exclusive:false,access:'paid',priceCents:1000,filePath:'models/test.3mf',image:'/assets/tl-monogram-3d.webp'})));
    catalog.products.push({...catalog.products[0],id:'wrong-collection',collection:'fe'});
    await writeRecord('catalog.json', catalog, null);
    const service = createInstagramPromotion({readRecord, updateRecord, getCatalog, now:() => time,
      getMember:async id => (await readRecord('club-members.json')).data.members.find(m => m.id === id),
      readProfile:async accountId => {assert.equal(accountId,accounts[1].id);return {username,follows,errorCode:null};},
      api:{sendDirectLink:async(senderId,url)=>{directSent.push({senderId,url});},ready:() => true, resolvePost:async () => '123456', findComment:async () => commentFound ? {id:'555'} : null, findLinkComment:async()=>autoDirect?{id:'555',from:{id:'9911',username},timestamp:new Date(time).toISOString()}:null, sendPrivateReply:async(id,text)=>{sent.push({id,text});if(sendFails)throw Error('timeout');return {messageId:'sent1'};}},
      redeemOrder:redeemInstagramOrder});
    await service.configure({...(await service.admin()).config,postUrl:'https://www.instagram.com/p/promotion/',active});
    const payload = (message, index, sender = `991${index}`, stamp = time) => ({object:'instagram',entry:[{id:accounts[index].id,messaging:[{sender:{id:sender},recipient:{id:accounts[index].id},timestamp:stamp,message:{mid:`m-${randomUUID()}`,text:message}}]}]});
    async function link(who = member, handle = 'participante', senderBase = '991') {
      const code = await service.startLink(who, {username:handle});
      await service.receive(payload(code.message || sent.at(-1).text.match(/CUPOM [A-F0-9]{24}/)[0],1,`${senderBase}1`));
      return code;
    }
    return {member,service,catalog,link,payload,sent,directSent,setTime:value=>time=value,now:()=>time,setFollows:value=>follows=value,setComment:value=>commentFound=value,setUsername:value=>username=value};
  }
  try {
    await t.test('Direct button sends a private one-use ticket; a claimed @ never binds automatically',async()=>{
      const f=await fixture();
      await f.service.startLink(f.member,{username:'participante'});
      const payload={object:'instagram',entry:[{id:accounts[1].id,messaging:[{sender:{id:'9911'},recipient:{id:accounts[1].id},timestamp:f.now(),postback:{mid:'click-1',payload:DIRECT_PAYLOAD}}]}]};
      await f.service.receive(payload);
      assert.equal(f.directSent.length,1);assert.equal(f.directSent[0].senderId,'9911');
      assert.equal((await f.service.status(f.member)).instagram,null);
      const ticket=f.directSent[0].url.split('/').at(-1);
      assert.match(ticket,/^[a-f0-9]{64}$/);
      assert.ok(!JSON.stringify((await readRecord(PROMOTION_KEY)).data).includes(ticket));
      await f.service.receive(payload);assert.equal(f.directSent.length,1);
      const completed=await f.service.completeDirect(f.member,{ticket});
      assert.equal(completed.checks.instagram,true);assert.equal(completed.checks.follows[0].status,'complete');
      await f.service.completeDirect(f.member,{ticket});
      assert.equal((await readRecord(PROMOTION_KEY)).data.claims.length,0);
      const other={...f.member,id:randomUUID(),email:'other@example.invalid',emailVerification:{email:'other@example.invalid',verifiedAt:new Date(f.now()).toISOString()}};
      await updateRecord('club-members.json',s=>({...s,members:[...s.members,other]}));
      await assert.rejects(f.service.completeDirect(other,{ticket}),{status:409});
      f.setTime(f.now()+61_000);payload.entry[0].messaging[0].timestamp=f.now();payload.entry[0].messaging[0].postback.mid='click-2';
      await f.service.receive(payload);
      const next=f.directSent[1].url.split('/').at(-1);
      await assert.rejects(f.service.completeDirect(other,{ticket:next}),/outro cadastro/);
      f.setTime(f.now()+31*60_000);await assert.rejects(f.service.completeDirect(f.member,{ticket:next}),/expirou/);
    });
    await t.test('Direct confirmation requires current verified email and rejects fabricated tickets',async()=>{
      const f=await fixture({verified:false});
      const payload={object:'instagram',entry:[{id:accounts[1].id,messaging:[{sender:{id:'9911'},recipient:{id:accounts[1].id},timestamp:f.now(),postback:{mid:'click-3',payload:DIRECT_PAYLOAD}}]}]};
      await f.service.receive(payload);const ticket=f.directSent[0].url.split('/').at(-1);
      await assert.rejects(f.service.completeDirect(f.member,{ticket}),{status:403});
      const g=await fixture();await assert.rejects(g.service.completeDirect(g.member,{ticket:'x'}),{status:400});
      await assert.rejects(g.service.completeDirect(g.member,{ticket:'a'.repeat(64)}),{status:409});
    });
    await t.test('email is bound to account and current address, expires and limits guessing',async()=>{
      const f=await fixture({verified:false}); let delivered;
      const email=createEmailVerification({updateRecord,now:f.now,send:async message=>{delivered=message;}});
      await assert.rejects(f.service.startLink(f.member,{username:'participante'}),{status:403});
      await email.request(f.member); assert.match(delivered.code,/^\d{8}$/);
      const stored=(await readRecord('club-members.json')).data.members[0]; assert.notEqual(stored.emailVerificationPending.hash,delivered.code);
      await assert.rejects(email.request(f.member),{status:429});
      const wrong=delivered.code==='00000000'?'00000001':'00000000';
      for(let n=0;n<5;n++) await assert.rejects(email.confirm(f.member,{code:wrong}),{status:400});
      await assert.rejects(email.confirm(f.member,{code:delivered.code}),{status:400});
      f.setTime(f.now()+61_000);await email.request(f.member);
      f.setTime(f.now()+16*60_000);await assert.rejects(email.confirm(f.member,{code:delivered.code}),{status:400});
      await email.request(f.member);await email.confirm(f.member,{code:delivered.code});
      const current=(await readRecord('club-members.json')).data.members[0];assert.equal(emailIsVerified(current),true);assert.ok(!current.emailVerificationPending);
      assert.equal(emailIsVerified({...current,email:'another@example.invalid'}),false);
      await assert.rejects(email.confirm({...f.member,id:randomUUID()},{code:delivered.code}),{status:401});
    });
    await t.test('failed email delivery rolls back only its own challenge',async()=>{
      const f=await fixture({verified:false});const email=createEmailVerification({updateRecord,now:f.now,send:async()=>{throw Error('outage')}});
      await assert.rejects(email.request(f.member),{status:503});assert.ok(!(await readRecord('club-members.json')).data.members[0].emailVerificationPending);
    });
    await t.test('a forged @ or a Direct to tiolira cannot bind; one verified Direct to tiolira3d is sufficient',async()=>{
      const f=await fixture();const code=await f.service.startLink(f.member,{username:'participante'});
      f.setUsername('outra_pessoa');await f.service.receive(f.payload(code.message,1));assert.equal((await f.service.status(f.member)).instagram,null);
      f.setUsername('participante');await f.service.receive(f.payload(code.message,0));assert.equal((await f.service.status(f.member)).instagram,null);
      await assert.rejects(f.service.claim(f.member),{status:409});
      await f.service.receive(f.payload(code.message,1));assert.equal((await f.service.status(f.member)).instagram.username,'participante');
      await f.service.receive(f.payload(code.message,1,'999999'));assert.equal((await readRecord(PROMOTION_KEY)).data.bindings[f.member.id].accounts[accounts[1].id].senderId,'9911');
    });
    await t.test('expired and superseded link challenges cannot bind an account',async()=>{
      const f=await fixture();const old=await f.service.startLink(f.member,{username:'participante'});const next=await f.service.startLink(f.member,{username:'participante'});
      for(let i=0;i<2;i++)await f.service.receive(f.payload(old.message,i));assert.equal((await f.service.status(f.member)).instagram,null);
      f.setTime(f.now()+31*60_000);for(let i=0;i<2;i++)await f.service.receive(f.payload(next.message,i));assert.equal((await f.service.status(f.member)).instagram,null);
    });
    await t.test('campaign draft, follows, comment and handle changes each block issuance',async()=>{
      const f=await fixture({active:false});await f.link();await assert.rejects(f.service.claim(f.member),{status:409});
      await f.service.configure({...(await f.service.admin()).config,active:true});
      f.setFollows(false);await assert.rejects(f.service.claim(f.member),/Siga/);
      f.setFollows(null);await assert.rejects(f.service.claim(f.member),{status:503});
      f.setFollows(true);f.setComment(false);await assert.rejects(f.service.claim(f.member),/Comente/);
      f.setComment(true);f.setUsername('nome_novo');await assert.rejects(f.service.claim(f.member),/mudou/);
      assert.equal((await readRecord(PROMOTION_KEY)).data.claims.length,0);
    });
    await t.test('progress checks show actual missing or unavailable rules without issuing a coupon',async()=>{
      const f=await fixture();
      let result=await f.service.check(f.member);
      assert.equal(result.checks.instagram,false);assert.equal(result.checks.comment,'pending');
      await f.link();f.setFollows(false);f.setComment(false);
      result=await f.service.check(f.member);
      assert.ok(result.checks.follows.every(x=>x.status==='missing'));assert.equal(result.checks.comment,'missing');
      f.setFollows(null);result=await f.service.check(f.member);assert.ok(result.checks.follows.every(x=>x.status==='unavailable'));
      f.setFollows(true);f.setComment(true);result=await f.service.check(f.member);
      assert.ok(result.checks.follows.every(x=>x.status==='complete'));assert.equal(result.checks.comment,'complete');
      assert.equal((await readRecord(PROMOTION_KEY)).data.claims.length,0);
      const campaign=await f.service.publicCampaign();assert.equal(campaign.open,true);assert.ok(!('version' in campaign));assert.ok(!('claims' in campaign));
    });
    await t.test('simultaneous requests issue exactly one coupon and keep it after changing Instagram',async()=>{
      const f=await fixture();await f.link();
      const results=await Promise.all(Array.from({length:4},()=>f.service.claim(f.member)));
      assert.equal(new Set(results.map(x=>x.coupon.code)).size,1);assert.equal((await readRecord(PROMOTION_KEY)).data.claims.length,1);
      f.setUsername('novo_instagram');await f.link(f.member,'novo_instagram','772');
      assert.equal((await f.service.claim(f.member)).coupon.code,results[0].coupon.code);
      const identities=(await readRecord(PROMOTION_KEY)).data.identityOwners;assert.equal(identities[`${accounts[1].id}:9911`],f.member.id);
    });
    await t.test('same Instagram cannot link to a second email, including after a rename',async()=>{
      const f=await fixture();await f.link();await f.service.claim(f.member);
      const other={...f.member,id:randomUUID(),version:randomUUID(),email:'second@example.invalid',emailVerification:{email:'second@example.invalid',verifiedAt:new Date(f.now()).toISOString()}};
      await updateRecord('club-members.json',s=>({...s,members:[...s.members,other]}));
      f.setUsername('renamed');await f.link(other,'renamed');
      const view=await f.service.status(other);assert.equal(view.instagram,null);assert.match(view.pending.error,/outro cadastro/);
      await assert.rejects(f.service.claim(other),{status:409});assert.equal((await readRecord(PROMOTION_KEY)).data.claims.length,1);
    });
    await t.test('recreated account with the same verified email cannot obtain another coupon',async()=>{
      const f=await fixture();await f.link();await f.service.claim(f.member);
      const other={...f.member,id:randomUUID(),version:randomUUID()};await updateRecord('club-members.json',s=>({...s,members:[...s.members,other]}));
      f.setUsername('outro_instagram');await f.link(other,'outro_instagram','773');await assert.rejects(f.service.claim(other),/já recebeu/);
    });
    await t.test('one atomic redemption grants download and license for either collection, never a second model',async()=>{
      for(let collection=0;collection<2;collection++){
        const f=await fixture();await f.link();const {coupon}=await f.service.claim(f.member);
        await assert.rejects(f.service.redeem(f.member,{code:coupon.code,productId:'wrong-collection'}),{status:400});
        await assert.rejects(f.service.redeem(f.member,{code:'forged',productId:`test-noel-${collection}-0`}),{status:403});
        const input={code:coupon.code,productId:`test-noel-${collection}-0`,lang:'pt'};
        const responses=await Promise.all([f.service.redeem(f.member,input),f.service.redeem(f.member,input)]);
        assert.equal(responses[0].order.id,responses[1].order.id);assert.equal(responses[0].order.totalCents,0);
        assert.equal((await readRecord('commerce.json')).data.orders.length,1);
        assert.equal(await memberHasAccess(f.member,input.productId),true);assert.equal((await purchaseLicenses(f.member)).filter(l=>l.status==='active').length,1);
        await assert.rejects(f.service.redeem(f.member,{...input,productId:`test-noel-${collection}-1`}),{status:409});
      }
    });
    await t.test('expiry and paused campaign block unused coupons',async()=>{
      const f=await fixture();await f.link();const {coupon}=await f.service.claim(f.member);
      await f.service.configure({...(await f.service.admin()).config,active:false});
      await assert.rejects(f.service.redeem(f.member,{code:coupon.code,productId:'test-noel-0-0'}),{status:409});
      await f.service.configure({...(await f.service.admin()).config,active:true});f.setTime(Date.parse(coupon.expiresAt)+1);
      await assert.rejects(f.service.redeem(f.member,{code:coupon.code,productId:'test-noel-0-0'}),{status:409});
    });
    await t.test('only a signed webhook can process the personal code',async()=>{
      const f=await fixture(),code=await f.service.startLink(f.member,{username:'participante'});
      const body=JSON.stringify(f.payload(code.message,1)),secret='test-app-secret';
      const hook=createInstagramWebhook({appSecret:secret,verifyToken:'verify',accounts:new Map(accounts.map(a=>[a.id,'token'])),receive:async()=>{},receivePayload:p=>f.service.receive(p)});
      assert.equal((await hook.POST(new Request('https://example.invalid/hook',{method:'POST',body}))).status,403);
      assert.equal((await f.service.status(f.member)).pending.received.length,0);
      const signature='sha256='+createHmac('sha256',secret).update(body).digest('hex');
      assert.equal((await hook.POST(new Request('https://example.invalid/hook',{method:'POST',body,headers:{'x-hub-signature-256':signature}}))).status,200);
      assert.equal((await f.service.status(f.member)).instagram.username,'participante');
    });
    await t.test('private reply is sent once under concurrency and requires a reply from the actual commenter',async()=>{
      const f=await fixture({autoDirect:true});
      const responses=await Promise.all(Array.from({length:4},()=>f.service.startLink(f.member,{username:'participante'})));
      assert.equal(f.sent.length,1);assert.ok(responses.every(r=>!r.message));
      assert.equal((await f.service.status(f.member)).instagram,null);
      const code=f.sent[0].text.match(/CUPOM [A-F0-9]{24}/)[0];
      await f.service.receive(f.payload(code,1,'2222'));assert.equal((await f.service.status(f.member)).instagram,null);
      await f.service.receive(f.payload(code,0,'9911'));assert.equal((await f.service.status(f.member)).instagram,null);
      await f.service.receive(f.payload(code,1,'9911'));assert.equal((await f.service.status(f.member)).instagram.username,'participante');
      const {checks}=await f.service.check(f.member);assert.deepEqual(checks.follows,[{username:'tiolira3d',status:'complete'}]);
      await f.service.claim(f.member);assert.equal((await readRecord(PROMOTION_KEY)).data.claims.length,1);
    });
    await t.test('uncertain private reply delivery falls back to one Direct without resending',async()=>{
      const f=await fixture({autoDirect:true,sendFails:true});
      let result=await f.service.startLink(f.member,{username:'participante'});assert.equal(result.delivery,'manual');assert.match(result.message,/^CUPOM /);
      result=await f.service.startLink(f.member,{username:'participante'});assert.equal(f.sent.length,1);
      await f.service.receive(f.payload(result.message,1));assert.ok((await f.service.status(f.member)).instagram);
    });
    await t.test('HTTP routes enforce sessions, origin and private response boundaries',async()=>{
      const f=await fixture();const cookie=`${clubCookieName}=${await makeSession(f.member.version,{memberId:f.member.id})}`;
      async function call(route,method='GET',auth='',origin='http://localhost'){
        let result;await handler({url:`/api/${route}`,method,body:{},headers:{host:'localhost',origin,cookie:auth},socket:{remoteAddress:'test'}},{setHeader(){},set statusCode(v){this.status=v},end(v){result={status:this.status,body:JSON.parse(v)}}});return result;
      }
      assert.equal((await call('club/instagram-promotion')).status,401);
      for(const route of ['club/instagram-promotion/direct','admin/instagram-promotion/direct/configure','admin/instagram-promotion/direct/test']){
        assert.equal((await call(route,'POST')).status,401);
        assert.equal((await call(route,'POST',cookie,'https://evil.invalid')).status,route.startsWith('admin/')?401:403);
      }
      assert.equal((await call('admin/instagram-promotion/direct/configure','POST',cookie)).status,401);
      assert.equal((await call('club/instagram-promotion/claim','POST',cookie,'https://evil.invalid')).status,403);
      assert.equal((await call('admin/instagram-promotion','GET',cookie)).status,401);
      const result=await call('club/instagram-promotion','GET',cookie);assert.equal(result.status,200);
      for(const key of ['identityOwners','claims','challenges','hash','version'])assert.ok(!(key in result.body));
    });
  } finally {for(const [k,v] of Object.entries(env))if(v===undefined)delete process.env[k];else process.env[k]=v;await rm(root,{recursive:true,force:true});}
});

test('comment rules require two distinct external handles, correct author and date',()=>{
  assert.deepEqual(distinctFriendMentions('@amigo @AMIGO @tiolira @tiolira3d @eu','eu'),['amigo']);
  assert.deepEqual(distinctFriendMentions('Oi @amigo_um e @outro.amigo!','eu'),['amigo_um','outro.amigo']);
  assert.deepEqual(distinctFriendMentions('email@exemplo.com','eu'),[]);
  assert.deepEqual(distinctFriendMentions('@amigo. @outro.','eu'),['amigo','outro']);
  const config={accountId:accounts[0].id,startsAt:'2026-11-10T00:00:00Z',endsAt:'2026-11-30T23:59:59Z'};
  const binding={username:'eu',accounts:{[accounts[0].id]:{senderId:'123'}}};
  const comment={id:'456',from:{id:'123',username:'eu'},timestamp:'2026-11-15T00:00:00Z',text:'@amigo @outro'};
  assert.equal(validPromotionComment(comment,binding,config),true);
  for(const patch of [{hidden:true},{text:'@amigo @amigo'},{from:{id:'999',username:'eu'}},{timestamp:'2026-01-01T00:00:00Z'}])assert.equal(validPromotionComment({...comment,...patch},binding,config),false);
  assert.equal(instagramPostUrl('https://evil.invalid/p/abc'), '');assert.equal(instagramPostUrl('https://instagram.com/p/abc/?igsh=tracking'),'https://www.instagram.com/p/abc/');
});

test('API ignores a deleted cached comment and verifies live media comments without trusting cached mentions',async()=>{
  const config={accountId:accounts[0].id,mediaId:'222',startsAt:'2026-11-10T00:00:00Z',endsAt:'2026-11-30T23:59:59Z'};
  const binding={username:'eu',accounts:{[accounts[0].id]:{senderId:'123'}}};let calls=[];
  const api=instagramPromotionApi({env:{[accounts[0].env]:'test-token'},fetcher:async(url,options)=>{
    calls.push(String(url));assert.equal(options.headers.Authorization,'Bearer test-token');assert.ok(!String(url).includes('test-token'));
    return String(url).includes('/222/comments')?Response.json({data:[{id:'555',from:{id:'123',username:'eu'},text:'@one @two',timestamp:'2026-11-15T00:00:00Z'}]}):Response.json({error:{code:100}},{status:400});
  }});
  assert.equal((await api.findComment(config,binding,['444'])).id,'555');assert.equal(calls.length,2);
});


test('branded verification email keeps the code readable and escapes recipient details',()=>{
  const mail=partnerVerificationEmail({code:'00112233',name:'<img>'});
  assert.ok(mail.html.includes('&lt;img&gt;'));assert.ok(!mail.html.includes('<img>'));
  assert.ok(mail.html.includes('00112233'));assert.ok(mail.text.includes('00112233'));
  assert.ok(mail.html.includes('tl-monogram-3d-icon.png'));assert.ok(mail.html.includes('15 minutos'));
  assert.throws(()=>partnerVerificationEmail({code:'<script>'}));
  assert.throws(()=>partnerVerificationEmail({code:'12345678',origin:'javascript:alert(1)'}));
});

test('private reply API uses the comment ID and only the tiolira3d token',async()=>{
  let sent;
  const api=instagramPromotionApi({env:{[accounts[1].env]:'test-token'},fetcher:async(url,options)=>{sent={url:String(url),...options};return Response.json({message_id:'message1'});}});
  assert.equal(api.ready(),true);await api.sendPrivateReply('123','Confirme');
  assert.ok(sent.url.includes(accounts[1].id));assert.equal(sent.headers.Authorization,'Bearer test-token');assert.deepEqual(JSON.parse(sent.body),{recipient:{comment_id:'123'},message:{text:'Confirme'}});
});
