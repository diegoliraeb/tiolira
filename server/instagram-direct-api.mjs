import {PROMOTION_VERIFICATION_ACCOUNT as account} from './instagram-promotion-rules.mjs';
import {DIRECT_PAYLOAD} from './instagram-direct-button.mjs';
const fail = message => {throw Object.assign(Error(message),{status:503});};
export function mergeDirectProfile(profile) {
  const menu = structuredClone(profile.persistent_menu || [{locale:'default',composer_input_disabled:false,call_to_actions:[]}]);
  if(!menu.some(m=>m.locale==='default')) menu.push({locale:'default',composer_input_disabled:false,call_to_actions:[]});
  for(const m of menu){
    m.call_to_actions=(m.call_to_actions||[]).filter(a=>a.payload!==DIRECT_PAYLOAD);
    if(m.call_to_actions.length>=3) fail('O menu do Direct já está cheio. Revise as opções existentes antes de adicionar a promoção.');
    m.call_to_actions.push({type:'postback',title:'Participar da promoção',payload:DIRECT_PAYLOAD});
  }
  const ice = structuredClone(profile.ice_breakers || []);
  const add = items => {
    const remaining=items.filter(i=>i.payload!==DIRECT_PAYLOAD);
    if(remaining.length>=4) fail('As perguntas iniciais do Direct já estão cheias. Revise as opções antes de adicionar a promoção.');
    return [...remaining,{question:'Participar da promoção',payload:DIRECT_PAYLOAD}];
  };
  const iceBreakers=ice.some(i=>Array.isArray(i.call_to_actions)) ? ice.map(i=>({...i,call_to_actions:add(i.call_to_actions||[])})) : add(ice);
  return {platform:'instagram',persistent_menu:menu,ice_breakers:iceBreakers};
}
export function instagramDirectApi({fetcher=fetch,env=process.env}={}) {
  async function request(path,{method='GET',body,query={}}={}) {
    const token=env[account.env]; if(!token)fail('Conexão do Instagram indisponível.');
    const url=new URL(`https://graph.facebook.com/v27.0/${account.id}/${path}`);
    for(const [k,v]of Object.entries(query))url.searchParams.set(k,v);
    const response=await fetcher(url,{method,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(8000),cache:'no-store'});
    const data=await response.json();
    if(!response.ok || data.error)fail(`A Meta não concluiu ${path} (código ${Number(data.error?.code)||response.status}${Number(data.error?.error_subcode)?`/${Number(data.error.error_subcode)}`:''}).`);
    return data;
  }
  async function send(recipient,message) {
    const result=await request('messages',{method:'POST',body:{recipient:{id:recipient},message}});
    if(!result.message_id)fail('A Meta não confirmou o envio do Direct.');
    return {sent:true};
  }
  return {
    async configureDirectButton() {
      const existing=await request('messenger_profile',{query:{platform:'instagram',fields:'ice_breakers,persistent_menu'}});
      const profile=Object.assign({},...(existing.data||[]));
      const next=mergeDirectProfile(profile);
      const subscriptions=await request('subscribed_apps');
      const current=subscriptions.data?.find(a=>a.id==='2411384412934986');
      const fields=[...new Set([...(current?.subscribed_fields||[]),'messages','comments','messaging_postbacks'])];
      await request('subscribed_apps',{method:'POST',body:{subscribed_fields:fields}});
      await request('messenger_profile',{method:'POST',body:next});
      const verified=await request('messenger_profile',{query:{platform:'instagram',fields:'ice_breakers,persistent_menu'}});
      const value=Object.assign({},...(verified.data||[]));
      if(!JSON.stringify(value.ice_breakers||[]).includes(DIRECT_PAYLOAD) || !JSON.stringify(value.persistent_menu||[]).includes(DIRECT_PAYLOAD))fail('A Meta ainda não confirmou o botão. Tente configurar novamente.');
      return {configured:true};
    },
    async sendDirectLink(senderId,url) {
      // A real text message keeps the URL clickable on Instagram Web, where
      // template buttons may be hidden. Both messages use the same one-use ticket.
      await send(senderId,{text:`Confirme seu Instagram no Clube Tio Lira pelo link abaixo:\n\n${url}\n\nEntre na sua conta e confirme seu e-mail, se necessário. O link é pessoal, vale por 30 minutos e não deve ser compartilhado.`});
      try {
        await send(senderId,{attachment:{type:'template',payload:{template_type:'button',text:'No aplicativo do Instagram, você também pode usar este botão para abrir o mesmo link de confirmação.',buttons:[{type:'web_url',title:'Confirmar no site',url}]}}});
        return {sent:true,buttonSent:true};
      } catch {
        // Text delivery already succeeded. A mobile-button failure must not mark
        // the usable link as failed or cause duplicate confirmation messages.
        return {sent:true,buttonSent:false};
      }
    },
    sendDirectTest() {
      // Explicitly authorized test account @tiolirapescador; never accept an arbitrary recipient.
      return send('1112002325053280',{attachment:{type:'template',payload:{template_type:'button',text:'Participar da promoção · Tio Lira. Toque no botão ou envie PARTICIPAR para receber seu link de confirmação.',buttons:[{type:'postback',title:'Participar',payload:DIRECT_PAYLOAD}]}}});
    },
  };
}
