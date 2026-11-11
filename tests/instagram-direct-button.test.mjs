import test from 'node:test';
import assert from 'node:assert/strict';
import {directButtonEvents,DIRECT_PAYLOAD} from '../server/instagram-direct-button.mjs';
import {instagramDirectApi,mergeDirectProfile} from '../server/instagram-direct-api.mjs';
import {PROMOTION_VERIFICATION_ACCOUNT as account} from '../server/instagram-promotion-rules.mjs';
import {partnerRoute} from '../lib/partner-navigation.mjs';

test('only valid participant postbacks/quick replies to tiolira3d trigger a Direct',()=>{
  const event={sender:{id:'1234'},recipient:{id:account.id},timestamp:123456,postback:{mid:'mid',payload:DIRECT_PAYLOAD}};
  const wrap=e=>({object:'instagram',entry:[{id:account.id,messaging:[e]}]});
  assert.equal(directButtonEvents(wrap(event)).length,1);
  for(const patch of [{postback:{payload:DIRECT_PAYLOAD}},{recipient:{id:'123'}},{sender:{id:account.id}},{timestamp:1.1},{message:{is_echo:true}},{postback:{mid:'mid',payload:'OTHER'}}])assert.equal(directButtonEvents(wrap({...event,...patch})).length,0);
  assert.equal(directButtonEvents(wrap({...event,postback:undefined,message:{mid:'quick',quick_reply:{payload:DIRECT_PAYLOAD}}})).length,1);
  assert.equal(directButtonEvents({object:'page',entry:wrap(event).entry}).length,0);
});
test('adding a promotion preserves existing menu options and refuses to displace a full menu',()=>{
  const existing={persistent_menu:[{locale:'default',call_to_actions:[{type:'web_url',title:'Loja',url:'https://www.tiolira.com.br'}]}],ice_breakers:[{question:'Ajuda',payload:'HELP'}]};
  const next=mergeDirectProfile(existing);
  assert.equal(next.persistent_menu[0].call_to_actions[0].title,'Loja');assert.equal(next.ice_breakers[0].payload,'HELP');
  assert.deepEqual(mergeDirectProfile(next),next);
  assert.equal(existing.persistent_menu[0].call_to_actions.length,1);
  assert.throws(()=>mergeDirectProfile({persistent_menu:[{locale:'default',call_to_actions:[1,2,3].map(n=>({payload:String(n)}))}]}),/cheio/);
  assert.throws(()=>mergeDirectProfile({ice_breakers:[1,2,3,4].map(n=>({payload:String(n)}))}),/cheias/);
});
test('Meta configuration preserves subscription fields and verifies both button surfaces',async()=>{
  let stored={},subscribed;const requests=[];
  const api=instagramDirectApi({env:{[account.env]:'fake'},fetcher:async(url,options)=>{
    requests.push({url:String(url),options});assert.equal(options.headers.Authorization,'Bearer fake');
    if(String(url).includes('subscribed_apps')){
      if(options.method==='POST'){subscribed=JSON.parse(options.body);return Response.json({success:true});}
      return Response.json({data:[{id:'2411384412934986',subscribed_fields:['messages','comments','messaging_seen']}]});
    }
    if(options.method==='POST'){stored=JSON.parse(options.body);return Response.json({success:true});}
    return Response.json({data:[stored]});
  }});
  assert.deepEqual(await api.configureDirectButton(),{configured:true});
  assert.ok(subscribed.subscribed_fields.includes('messaging_seen'));assert.ok(subscribed.subscribed_fields.includes('messaging_postbacks'));
  assert.equal(requests.length,5);
});
test('Direct links use a fragment and navigation stays on promotion',async()=>{
  const ticket='a'.repeat(64);const messages=[];
  const api=instagramDirectApi({env:{[account.env]:'fake'},fetcher:async(url,options)=>{messages.push(JSON.parse(options.body));return Response.json({message_id:'sent'});}});
  await api.sendDirectLink('1234',`https://www.tiolira.com.br/pt/clube#promocao/instagram/${ticket}`);
  assert.equal(messages.length,2);
  assert.equal(messages[0].recipient.id,'1234');
  assert.ok(messages[0].message.text.includes(`https://www.tiolira.com.br/pt/clube#promocao/instagram/${ticket}`));
  const message=messages[1];
  assert.equal(message.recipient.id,'1234');
  const url=new URL(message.message.attachment.payload.buttons[0].url);assert.equal(url.search,'');assert.equal(partnerRoute(url.hash).section,'promocao');
  assert.equal(partnerRoute('#promocao/instagram/not-a-ticket').section,'inicio');
});

 test('PARTICIPAR text works without a button; unrelated text, echoes and deleted messages do not',()=>{
  const wrap=(text,extra={})=>({object:'instagram',entry:[{id:account.id,messaging:[{sender:{id:'1234'},recipient:{id:account.id},timestamp:123456,message:{mid:'text-mid',text,...extra}}]}]});
  for(const text of ['PARTICIPAR','participar','  Participar\n'])assert.equal(directButtonEvents(wrap(text)).length,1);
  for(const text of ['Oi','Não quero participar','PARTICIPAR agora','TESTE CUPOM',''])assert.equal(directButtonEvents(wrap(text)).length,0);
  assert.equal(directButtonEvents(wrap('PARTICIPAR',{is_echo:true})).length,0);
  assert.equal(directButtonEvents(wrap('PARTICIPAR',{is_deleted:true})).length,0);
 });
 test('a hidden or failed mobile template cannot invalidate an already delivered text link',async()=>{
   let calls=0;
   const api=instagramDirectApi({env:{[account.env]:'fake'},fetcher:async()=>++calls===1?Response.json({message_id:'text-sent'}):Response.json({error:{code:100}},{status:400})});
   assert.deepEqual(await api.sendDirectLink('1234','https://www.tiolira.com.br/pt/clube#test'),{sent:true,buttonSent:false});
   assert.equal(calls,2);
   const unavailable=instagramDirectApi({env:{[account.env]:'fake'},fetcher:async()=>Response.json({error:{code:10}},{status:400})});
   await assert.rejects(unavailable.sendDirectLink('1234','https://www.tiolira.com.br/pt/clube#test'));
 });
