import {readRecord,updateRecord} from './store.mjs';
import {purchaseApprovedEmail,purchaseEmailConfig} from './purchase-email.mjs';
import {currentOrderEnvironment} from './payment-environment.mjs';
const KEY='purchase-email-resends.json';
const state=data=>({jobs:{},...data});
const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
const active=o=>o?.status==='paid'&&currentOrderEnvironment(o);
// Explicit operator requests only; never infer a resend from an existing paid order.
export async function queuePurchaseEmailResend({orderId,language,requestId,reason}){
 if(!['pt','en','es','fr'].includes(language)||!/^[a-zA-Z0-9-]{10,100}$/.test(requestId||'')||typeof reason!=='string'||!reason.trim()||reason.length>500)fail('Solicitação de reenvio inválida.');
 const order=(await readRecord('commerce.json'))?.data?.orders?.find(o=>o.id===orderId);
 if(!active(order))fail('Pedido pago indisponível.',409);
 await updateRecord(KEY,old=>{
  const s=state(old),existing=s.jobs[requestId];
  if(existing){if(existing.orderId!==orderId||existing.language!==language)fail('Identificador já utilizado.',409);return s;}
  s.jobs[requestId]={id:requestId,orderId,language,memberEmail:order.memberEmail,environment:order.environment,reason:reason.trim(),status:'pending',createdAt:new Date().toISOString(),attempts:0};return s;
 });
 return {id:requestId,status:(await readRecord(KEY)).data.jobs[requestId].status};
}
export async function runPurchaseEmailResends(now=Date.now()){
 if(process.env.VERCEL&&process.env.VERCEL_ENV!=='production')return {sent:0};
 const config=purchaseEmailConfig();if(!config)return {sent:0};
 const jobs=Object.values(state((await readRecord(KEY))?.data).jobs).filter(j=>['pending','failed'].includes(j.status)).slice(0,2);
 let sent=0;
 for(const candidate of jobs){
  const order=(await readRecord('commerce.json'))?.data?.orders?.find(o=>o.id===candidate.orderId);
  if(!active(order)||order.memberEmail!==candidate.memberEmail||order.environment!==candidate.environment){await updateRecord(KEY,old=>{const s=state(old);if(s.jobs[candidate.id].status!=='sent')s.jobs[candidate.id].status='cancelled';return s;});continue;}
  const result=await updateRecord(KEY,old=>{
   const s=state(old),job=s.jobs[candidate.id];if(!['pending','failed'].includes(job.status))return s;
   if(job.firstAttemptAt&&now-Date.parse(job.firstAttemptAt)>=23*3600000){job.status='review';return s;}
   job.payload||={from:config.from,to:[order.memberEmail],...purchaseApprovedEmail({...order,emailLanguage:job.language},config.origin)};
   job.firstAttemptAt||=new Date(now).toISOString();job.attempts++;job.lastAttemptAt=new Date(now).toISOString();return s;
  });
  const job=result.jobs[candidate.id];if(!['pending','failed'].includes(job.status))continue;
  try{
   const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${config.key}`,'Content-Type':'application/json','Idempotency-Key':`purchase-resend/${job.environment}/${job.id}`},body:JSON.stringify(job.payload),signal:AbortSignal.timeout(8000)});
   if(!response.ok)throw Error('delivery');const data=await response.json();if(typeof data.id!=='string'||!data.id)throw Error('delivery');
   await updateRecord(KEY,old=>{const s=state(old),j=s.jobs[job.id];j.status='sent';j.providerId=data.id;j.sentAt=new Date().toISOString();delete j.error;return s;});sent++;
  }catch{await updateRecord(KEY,old=>{const s=state(old),j=s.jobs[job.id];if(j.status!=='sent'){j.status='failed';j.error='Envio não confirmado; nova tentativa mantém a mesma mensagem e chave.';}return s;});}
 }
 return {sent};
}
