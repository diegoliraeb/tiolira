import {readRecord,updateRecord} from './store.mjs';
import {LINK_KEY,withMembershipLock} from './makerworld-links.mjs';
import {purchaseEmailConfig} from './purchase-email.mjs';
const response='A assinatura do Tio Lira pelo MakerWorld ainda não está disponível. A vinculação foi temporariamente desativada. Assine diretamente em https://www.tiolira.com.br/pt/assinatura. Se já pagou pelo site, não pague novamente: sua assinatura permanece válida.';
export async function pauseMakerworldLinks(admin){return withMembershipLock('makerworld-pause-notifications',async()=>{
 const config=purchaseEmailConfig();if(!config)throw Object.assign(Error('Serviço de e-mail indisponível.'),{status:503});
 const members=(await readRecord('club-members.json'))?.data?.members||[];
 const record=await updateRecord(LINK_KEY,d=>{
  d||={requests:[]};d.acceptingRequests=false;d.pausedAt||=new Date().toISOString();d.pausedBy||=admin.email||'administrador';d.pauseNotifications||=[];
  for(const r of d.requests.filter(r=>r.status==='pending')){
   r.status='rejected';r.response=response;r.reviewedAt=new Date().toISOString();r.version++;r.audit||=[];r.audit.push({action:'rejected',at:r.reviewedAt,actor:admin.email||'administrador',response});
   const m=members.find(m=>m.id===r.memberId)||r;
   // One immutable notification per affected member; retries reuse its payload and key.
   if(!d.pauseNotifications.some(j=>j.memberId===r.memberId))d.pauseNotifications.push({id:r.id,memberId:r.memberId,status:'pending',payload:{from:config.from,to:[m.email],subject:'Sua assinatura Tio Lira: faça pelo site',text:`Olá, ${m.name}!\n\nA assinatura do Tio Lira pelo MakerWorld ainda não está disponível. Por isso, encerramos sua solicitação de vinculação e desativamos temporariamente essa opção.\n\nPara obter sua licença comercial e acessar as obras incluídas, faça a assinatura anual diretamente no nosso site:\n${config.origin}/pt/assinatura\n\nSe você já assinou ou pagou pelo site, não pague novamente. Sua assinatura e o período pago permanecem válidos.\n\nA solicitação de vinculação não gerou nenhuma cobrança. Se precisar de ajuda com um pagamento já realizado, entre em contato antes de tentar pagar novamente.\n\nObrigado por apoiar meu trabalho!\nDiego — Tio Lira\ntiolira.com.br`}});
  }return d;
 });
 for(const candidate of record.pauseNotifications.filter(j=>j.status!=='sent'&&j.status!=='review').slice(0,10)){
  const updated=await updateRecord(LINK_KEY,d=>{const j=d.pauseNotifications.find(j=>j.id===candidate.id);if(j.firstAttemptAt&&Date.now()-Date.parse(j.firstAttemptAt)>=23*3600000){j.status='review';return d}j.firstAttemptAt||=new Date().toISOString();j.status='sending';return d});
  const job=updated.pauseNotifications.find(j=>j.id===candidate.id);if(job.status==='review')continue;
  try{
   const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${config.key}`,'Content-Type':'application/json','Idempotency-Key':`makerworld-pause/${job.id}`},body:JSON.stringify(job.payload),signal:AbortSignal.timeout(10000)});
   if(!r.ok)throw Error('send');const result=await r.json();if(!result.id)throw Error('send');
   await updateRecord(LINK_KEY,d=>{Object.assign(d.pauseNotifications.find(j=>j.id===job.id),{status:'sent',providerId:result.id,sentAt:new Date().toISOString()});return d});
  }catch{await updateRecord(LINK_KEY,d=>{const j=d.pauseNotifications.find(j=>j.id===job.id);if(j.status!=='sent')j.status='uncertain';return d})}
 }
 const jobs=(await readRecord(LINK_KEY)).data.pauseNotifications;
 return {ok:true,sent:jobs.filter(j=>j.status==='sent').length,pending:jobs.filter(j=>j.status!=='sent').length};
});}
