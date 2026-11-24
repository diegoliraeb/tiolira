import {randomUUID} from 'node:crypto';
import {readRecord,updateRecord} from './store.mjs';
import {partnerEmailVerification} from './instagram-promotion-runtime.mjs';
import {recoverFailedCartReminder} from './cart-reminders.mjs';
export const RECOVERY_KEY='operations/email-recovery.json';
export async function emailRecoveryReport(){
 const d=(await readRecord(RECOVERY_KEY))?.data;
 return (d?.jobs||[]).map(({id,email,kind,status,result})=>({id,email,kind,status,result}));
}
export async function recoverEmailJob(id,actor){
 if(process.env.VERCEL&&process.env.VERCEL_ENV!=='production')throw Error('Reenvios somente em produção.');
 if(!/^[a-f0-9-]{36}$/.test(id))throw Error('Aviso inválido.');
 const owner=randomUUID();let job;
 await updateRecord(RECOVERY_KEY,d=>{
  const j=d?.jobs?.find(x=>x.id===id);
  if(!j||j.status!=='pending'||!Number.isFinite(Date.parse(j.authorizedAt))||Date.now()-Date.parse(j.authorizedAt)>86400000)throw Error('Aviso já processado ou autorização expirada.');
  j.status='processing';j.owner=owner;j.startedAt=new Date().toISOString();j.actor=actor;job=structuredClone(j);return d;
 });
 try{
  const member=(await readRecord('club-members.json'))?.data?.members?.find(m=>m.id===job.memberId&&m.email.toLowerCase()===job.email);
  if(!member||member.disabled||member.deletedAt)throw Error('Cadastro alterado ou indisponível.');
  let result;
  if(job.kind==='verification')result=await partnerEmailVerification.request(member);
  else if(job.kind==='cart')result=await recoverFailedCartReminder(job.cartJobId,job.failedProviderId);
  else throw Error('Tipo de aviso não permitido.');
  await updateRecord(RECOVERY_KEY,d=>{const j=d.jobs.find(x=>x.id===id);if(j.owner===owner){j.status=result.verified?'skipped':'sent';j.result=result.verified?'E-mail já confirmado; não reenviado.':'Reenvio aceito pelo provedor.';j.completedAt=new Date().toISOString();}return d;});
 }catch(e){
  await updateRecord(RECOVERY_KEY,d=>{const j=d.jobs.find(x=>x.id===id);if(j.owner===owner){j.status='review';j.result=String(e.message).slice(0,200);}return d;});throw e;
 }
}
