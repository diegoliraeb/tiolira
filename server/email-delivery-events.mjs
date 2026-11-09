import {currentOrderEnvironment} from './payment-environment.mjs';
import {createHmac,timingSafeEqual} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {readRecord,updateRecord} from './store.mjs';
import {purchaseEmailConfig} from './purchase-email.mjs';
const KEY='email-delivery-config.json';
const events=['email.sent','email.delivered','email.opened','email.bounced','email.complained','email.delivery_delayed','email.failed'];
const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
export async function deliveryTrackingStatus(){const c=(await readRecord(KEY))?.data;return {configured:Boolean(c?.secret),openTracking:Boolean(c?.openTracking),configuredAt:c?.configuredAt||null};}
async function resend(path,method='GET',body){
 const config=purchaseEmailConfig();if(!config)fail('Serviço de e-mail indisponível.',503);
 let r;
 for(let attempt=0;attempt<3;attempt++){
  r=await fetch('https://api.resend.com'+path,{method,headers:{Authorization:`Bearer ${config.key}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(12000)});
  if(r.status!==429)break;
  await delay(1200);
 }
 if(!r.ok)fail(r.status===401||r.status===403?'A chave do Resend permite enviar, mas não configurar o relatório. Conecte o webhook e habilite o registro de aberturas no painel do Resend.':`Não foi possível configurar o relatório no Resend (HTTP ${r.status}).`,503);
 return r.json();
}
export async function configureDeliveryTracking(){
 const config=purchaseEmailConfig();if(!config)fail('Serviço de e-mail indisponível.',503);
 const endpoint=config.origin+'/api/webhooks/email-delivery';
 const hooks=await resend('/webhooks');
 const existing=hooks.data?.find(h=>h.endpoint===endpoint);
 const hook=existing?await resend('/webhooks/'+encodeURIComponent(existing.id)):await resend('/webhooks','POST',{endpoint,events});
 if(!hook.signing_secret||!hook.id)fail('O Resend não retornou a confirmação do webhook.',502);
 await updateRecord(KEY,old=>({...old,id:hook.id,secret:hook.signing_secret,endpoint,configuredAt:new Date().toISOString()}));
 if(existing)await resend('/webhooks/'+encodeURIComponent(hook.id),'PATCH',{events,status:'enabled'});
 const address=config.from.match(/<?([^<>\s]+@[^<>\s]+)>?$/)?.[1];const domain=address?.split('@')[1]?.toLowerCase();
 const domains=await resend('/domains');
 const owned=domains.data?.filter(d=>domain===d.name||domain?.endsWith('.'+d.name)).sort((a,b)=>b.name.length-a.name.length)[0];
 if(!owned)fail('Webhook conectado. Ative o registro de aberturas no domínio de envio do Resend.',409);
 await resend('/domains/'+encodeURIComponent(owned.id),'PATCH',{open_tracking:true});
 await updateRecord(KEY,old=>({...old,domainId:owned.id,openTracking:true}));
 return deliveryTrackingStatus();
}
// Svix's documented HMAC signature format; verify the exact raw body and freshness.
export function verifyEmailEvent(headers,raw,secret,now=Date.now()){
 const id=headers['svix-id'],ts=headers['svix-timestamp'],signatures=headers['svix-signature'];
 if(typeof id!=='string'||id.length>200||typeof ts!=='string'||!/^\d{10,12}$/.test(ts)||typeof signatures!=='string'||signatures.length>2000||typeof raw!=='string'||Buffer.byteLength(raw)>1_000_000||!secret?.startsWith('whsec_'))fail('Evento não autorizado.',401);
 if(Math.abs(now/1000-Number(ts))>300)fail('Evento expirado.',401);
 const key=Buffer.from(secret.slice(6),'base64');if(key.length<16)fail('Configuração inválida.',503);
 const digest=createHmac('sha256',key).update(`${id}.${ts}.${raw}`).digest();
 if(!signatures.split(' ').some(s=>{const [version,value]=s.split(',');const given=Buffer.from(value||'','base64');return version==='v1'&&given.length===digest.length&&timingSafeEqual(given,digest)}))fail('Assinatura inválida.',401);
 let event;try{event=JSON.parse(raw)}catch{fail('Evento inválido.')};return {event,id};
}
export async function receiveEmailDelivery(headers,raw){
 const config=(await readRecord(KEY))?.data;if(!config?.secret)fail('Relatório de entrega ainda não configurado.',503);
 const {event,id}=verifyEmailEvent(headers,raw,config.secret);
 const emailId=event.data?.email_id;
 if(!events.includes(event.type))return;
 if(typeof emailId!=='string'||!/^[a-f0-9-]{36}$/i.test(emailId)||!Number.isFinite(Date.parse(event.created_at)))fail('Evento inválido.');
 await updateRecord(`email-events/${emailId}.json`,old=>{
  const state=old||{events:{},ids:[]};if(state.ids.includes(id))return state;
  const type=event.type.slice(6),at=new Date(event.created_at).toISOString();
  if(!state.events[type]||at<state.events[type])state.events[type]=at;
  state.ids=[...state.ids.slice(-99),id];return state;
 });
}
export async function attachDeliveryReport(campaign,orders){
 if(!campaign)return null;
 const recipients=await Promise.all(campaign.recipients.map(async r=>{
  const events=r.providerId?(await readRecord(`email-events/${r.providerId}.json`))?.data?.events||{}:{};
  const redemption=orders.find(o=>currentOrderEnvironment(o)&&o.courtesy?.campaignId===campaign.id&&o.courtesy.recipientId===r.id);
  const {payload,...recipient}=r;
  return {...recipient,delivery:events,redemption:redemption?{orderId:redemption.id,at:redemption.paidAt,status:redemption.status,works:redemption.items.map(i=>i.name)}:null};
 }));
 return {...campaign,recipients,summary:{recipients:recipients.length,sent:recipients.filter(r=>r.sentAt||r.delivery.sent).length,delivered:recipients.filter(r=>r.delivery.delivered).length,opened:recipients.filter(r=>r.delivery.opened).length,failed:recipients.filter(r=>r.delivery.bounced||r.delivery.failed||r.status==='failed'||r.status==='review').length,redeemed:recipients.filter(r=>r.redemption?.status==='paid').length}};
}
