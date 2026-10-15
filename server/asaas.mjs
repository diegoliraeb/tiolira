import {timingSafeEqual} from 'node:crypto';
export {invoiceUrl} from '../lib/asaas-payment.mjs';
// Private API key stays on the server. Card details are entered only on Asaas.
export function asaasConfig(){
 const environment=process.env.ASAAS_ENVIRONMENT||'sandbox';
 if(!['sandbox','production'].includes(environment))throw Object.assign(new Error('Ambiente Asaas inválido.'),{status:503});
 return {environment,key:process.env.ASAAS_API_KEY,base:environment==='production'?'https://api.asaas.com/v3':'https://api-sandbox.asaas.com/v3'};
}
export function paymentsReady(){return Boolean(asaasConfig().key&&process.env.ASAAS_WEBHOOK_TOKEN?.length>=32);}
export async function asaas(path,{method='GET',body,timeoutMs=15000}={}){
 const {base,key}=asaasConfig();
 if(!paymentsReady())throw Object.assign(new Error('Os pagamentos ainda não estão configurados.'),{status:503});
 let response;
 try{response=await fetch(base+path,{method,headers:{access_token:key,'Content-Type':'application/json','User-Agent':'TioLira/1.0'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(timeoutMs)});}
 catch{throw Object.assign(new Error('Não foi possível confirmar a resposta do Asaas. Consulte o pedido antes de tentar novamente.'),{status:503,uncertain:true});}
 const data=await response.json().catch(()=>null);
 if(!response.ok||!data)throw Object.assign(new Error('O Asaas não concluiu a operação. Confira os dados ou consulte o pedido.'),{status:502,uncertain:response.status>=500||!data});
 return data;
}
export function paymentReturnUrl(orderId,lang='pt'){
 if(process.env.ASAAS_PAYMENT_REDIRECT_ENABLED==='false')return '';
 try{const u=new URL(process.env.SITE_URL);if(u.protocol==='https:'&&!u.username&&!u.password)return `${u.origin}/${['pt','en','es','fr'].includes(lang)?lang:'pt'}/clube?pedido=${encodeURIComponent(orderId)}&retorno=asaas#compras`;}catch{}
 return '';
}
export async function checkAsaasConnection(webhookUrl){
 const {environment}=asaasConfig();
 if(!paymentsReady())return {connected:false,environment,configured:false};
 const result=await asaas('/webhooks?limit=100');
 const webhook=result.data?.find(w=>w.url===webhookUrl);
 const expected=Buffer.from(process.env.ASAAS_WEBHOOK_TOKEN),actual=Buffer.from(webhook?.authToken||'');
 // Return only diagnostics; provider payloads may contain authentication tokens.
 return {configured:true,connected:true,environment,webhookFound:Boolean(webhook),webhookEnabled:webhook?.enabled===true,queueActive:webhook?.interrupted===false,
  tokenMatches:webhook?.authToken?actual.length===expected.length&&timingSafeEqual(actual,expected):null,
  eventsReady:['PAYMENT_CONFIRMED','PAYMENT_RECEIVED','PAYMENT_REFUNDED','PAYMENT_PARTIALLY_REFUNDED','PAYMENT_CHARGEBACK_REQUESTED'].every(event=>webhook?.events?.includes(event))};
}

export async function configurePurchaseEmailWebhook(){
 const u=new URL(process.env.SITE_URL);if(u.protocol!=='https:'||u.username||u.password)throw Object.assign(Error('Configure o endereço HTTPS oficial do site.'),{status:503});
 if(!process.env.RESEND_API_KEY||!process.env.EMAIL_FROM)throw Object.assign(Error('Configure o Resend antes de ativar os avisos.'),{status:503});
 const root=u.origin,url=`${root}/api/webhooks/purchase-email`,result=await asaas('/webhooks?limit=100');
 const primary=result.data?.find(w=>w.url===`${root}/api/webhooks/asaas`),existing=result.data?.find(w=>w.url===url);
 if(!primary?.email)throw Object.assign(Error('Configure primeiro o webhook principal de pagamentos.'),{status:409});
 const body={name:'Tio Lira - avisos de compra por e-mail',url,email:primary.email,enabled:true,interrupted:false,apiVersion:3,authToken:process.env.ASAAS_WEBHOOK_TOKEN,sendType:'NON_SEQUENTIALLY',events:['PAYMENT_CONFIRMED','PAYMENT_RECEIVED']};
 const webhook=await asaas(existing?`/webhooks/${encodeURIComponent(existing.id)}`:'/webhooks',{method:existing?'PUT':'POST',body});
 if(webhook.url!==url||!webhook.enabled||webhook.interrupted!==false)throw Object.assign(Error('Não foi possível confirmar a ativação dos avisos.'),{status:502});
 return {ready:true};
}
