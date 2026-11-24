import {markSubscriberWelcome} from '../lib/subscriber-welcome.mjs';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {readRecord,updateRecord} from './store.mjs';
import {purchaseEmailConfig} from './purchase-email.mjs';
import {withMembershipLock} from './makerworld-links.mjs';
import {asaas,asaasConfig} from './asaas.mjs';
import {syncAnnual} from './maker-asaas-annual.mjs';
import {subscriptionDashboard} from './maker-subscriptions.mjs';
import {currentPurchase,purchaseEnvironment} from './maker-purchases.mjs';
import {assertNoMakerworldCheckout} from './makerworld-links.mjs';
import {MAKER_TERMS,MAKER_VERSION,yearAfter} from '../lib/maker-license.mjs';
const MEMBERS='club-members.json',PURCHASES='maker-license-purchases.json';
const fail=(m,s=409)=>{throw Object.assign(Error(m),{status:s})};
const email=z.string().trim().toLowerCase().email().max(254);
const correctionSchema=z.object({memberId:z.string().uuid(),oldEmail:email,newEmail:email,requestId:z.string().uuid()});
export async function correctMemberEmail(admin,input){
 const p=correctionSchema.parse(input),config=purchaseEmailConfig();
 if(p.oldEmail===p.newEmail)fail('Informe um e-mail diferente.',400);
 if(!config)fail('Serviço de e-mail indisponível; cadastro não alterado.',503);
 return withMembershipLock(p.memberId,async()=>{
  const catalog=(await readRecord('catalog.json'))?.data;
  const candidate=catalog?.stores?.find(s=>s.email?.toLowerCase()===p.oldEmail);
  const record=await updateRecord(MEMBERS,d=>{
   const m=d?.members?.find(m=>m.id===p.memberId);if(!m)fail('Cadastro não encontrado.',404);
   const prior=d.emailCorrections?.find(j=>j.id===p.requestId);
   if(prior){if(prior.memberId!==p.memberId||prior.oldEmail!==p.oldEmail||prior.newEmail!==p.newEmail)fail('Solicitação diferente da correção registrada.');if(m.email!==p.newEmail)fail('O cadastro mudou depois desta correção.');return d;}
   if(m.email.toLowerCase()!==p.oldEmail)fail('O e-mail mudou. Recarregue o cadastro.');
   if(d.members.some(x=>x.id!==m.id&&x.email.toLowerCase()===p.newEmail))fail('O e-mail correto já pertence a outro cadastro. É necessária conferência; nenhuma conta foi unificada.');
   const at=new Date().toISOString();
   m.email=p.newEmail;m.version=randomUUID();delete m.emailVerification;delete m.passwordReset;
   if(candidate&&!m.storeId)m.storeId=candidate.id;
   const link=`${config.origin}/pt/clube`;
   (d.emailCorrections||=[]).push({id:p.requestId,memberId:m.id,oldEmail:p.oldEmail,newEmail:p.newEmail,at,actor:admin.email,status:'pending',payload:{from:config.from,to:[p.newEmail],subject:'Seu e-mail foi corrigido — Tio Lira',text:`Olá!\n\nCorrigimos o e-mail do seu cadastro ${m.name} para ${p.newEmail}, conforme solicitado.\n\nVocê já pode entrar no Clube com o endereço correto e a mesma senha:\n${link}\n\nSeu cadastro e histórico foram preservados. Se não lembrar a senha, use “Esqueci minha senha” na tela de acesso.\n\nObrigado por fazer parte do Clube!\nTio Lira\ntiolira.com.br`}});
   return d;
  });
  const job=record.emailCorrections.find(j=>j.id===p.requestId),m=record.members.find(m=>m.id===p.memberId);
  // Preserve the stable store/member relation; never overwrite another store's email.
  if(catalog&&m.storeId)await updateRecord('catalog.json',d=>{const s=d?.stores?.find(s=>s.id===m.storeId);if(s&&s.email?.toLowerCase()===p.oldEmail){s.email=p.newEmail;d.updatedAt=new Date().toISOString();}return d;});
  if(job.status!=='sent'){
   if(job.firstAttemptAt&&Date.now()-Date.parse(job.firstAttemptAt)>23*3600_000)fail('E-mail corrigido; envio antigo precisa de conferência antes de repetir.');
   await updateRecord(MEMBERS,d=>{const j=d.emailCorrections.find(j=>j.id===p.requestId);j.firstAttemptAt||=new Date().toISOString();j.status='sending';return d});
   try{
    const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${config.key}`,'Content-Type':'application/json','Idempotency-Key':`member-email-correction/${job.id}`},body:JSON.stringify(job.payload),signal:AbortSignal.timeout(15000)});
    if(!r.ok)throw Error('send');const result=await r.json();if(!result.id)throw Error('send');
    await updateRecord(MEMBERS,d=>{const j=d.emailCorrections.find(j=>j.id===job.id);Object.assign(j,{status:'sent',providerId:result.id,sentAt:new Date().toISOString()});return d});
   }catch{await updateRecord(MEMBERS,d=>{const j=d.emailCorrections.find(j=>j.id===job.id);if(j.status!=='sent')j.status='uncertain';return d});fail('E-mail corrigido, mas o envio não foi confirmado. Tente novamente nesta mesma solicitação.',503);}
  }
  return {ok:true,member:{id:m.id,name:m.name,email:m.email},emailStatus:'sent'};
 });
}
const receiptSchema=z.object({memberId:z.string().uuid(),confirmed:z.literal(true),reference:z.string().trim().min(10).max(150),paymentDate:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),valueCents:z.literal(4990)});
const cashPaid=p=>(p.billingType==='RECEIVED_IN_CASH'||p.status==='RECEIVED_IN_CASH')&&['RECEIVED','CONFIRMED','RECEIVED_IN_CASH'].includes(p.status);
export async function recordDirectAnnualPayment(admin,input){
 const p=receiptSchema.parse(input),date=Date.parse(p.paymentDate+'T03:00:00Z');
 if(!Number.isFinite(date)||new Date(date).toISOString().slice(0,10)!==p.paymentDate||date>Date.now())fail('Data de recebimento inválida.',400);
 return withMembershipLock(p.memberId,async()=>{
  const member=(await readRecord(MEMBERS))?.data?.members?.find(m=>m.id===p.memberId);if(!member)fail('Cadastro não encontrado.',404);
  const rows=(await readRecord(PURCHASES))?.data?.purchases||[];
  const repeated=rows.find(r=>r.directReceipt?.reference===p.reference);
  if(repeated&&repeated.memberId!==p.memberId)fail('Comprovante já registrado para outro cadastro.');
  const roots=rows.filter(r=>r.memberId===p.memberId&&r.provider==='asaas'&&r.environment===asaasConfig().environment&&r.annual&&r.subscriptionId&&r.paymentId&&(['pending','overdue'].includes(r.status)||r.directReceipt?.reference===p.reference));
  if(roots.length!==1)fail('Selecione um cadastro com uma única cobrança anual pendente.');
  const root=roots[0];
  if(root.directReceipt&&(root.directReceipt.reference!==p.reference||root.directReceipt.paymentDate!==p.paymentDate))fail('Já existe outro recebimento em conferência para esta cobrança.');
  const remote=await asaas(`/payments/${encodeURIComponent(root.paymentId)}`);
  if(remote.id!==root.paymentId||remote.customer!==root.customerId||remote.subscription!==root.subscriptionId||Math.round(Number(remote.value)*100)!==4990||remote.deleted||remote.paymentDunning||(remote.refunds||[]).some(r=>r.status!=='CANCELLED'))fail('A cobrança exige conferência antes da baixa manual.');
  if(!root.directReceipt&&(!['PENDING','OVERDUE'].includes(remote.status)||remote.billingType!==root.billingType))fail('O pagamento já mudou no Asaas. Consulte a situação antes de registrar.');
  if(root.directReceipt&&!cashPaid(remote)&&!['PENDING','OVERDUE'].includes(remote.status))fail('Situação do Asaas exige conferência.');
  await updateRecord(PURCHASES,d=>{const r=d.purchases.find(r=>r.id===root.id);if(d.purchases.some(x=>x.id!==r.id&&x.directReceipt?.reference===p.reference))fail('Comprovante já utilizado.');if(r.directReceipt&&r.directReceipt.reference!==p.reference)fail('Outro recebimento em andamento.');r.directReceipt||={reference:p.reference,paymentDate:p.paymentDate,valueCents:4990,bank:'Recebimento externo confirmado pelo administrador',actor:admin.email,at:new Date().toISOString(),paymentId:r.paymentId,status:'authorized'};return d});
  if(!cashPaid(remote)){
   if(root.directReceipt?.attemptAt)fail('Confirmação anterior ainda não aparece no Asaas. Confira antes de repetir.');
   await updateRecord(PURCHASES,d=>{const r=d.purchases.find(r=>r.id===root.id);if(r.directReceipt.attemptAt)fail('Confirmação em andamento.');r.directReceipt.attemptAt=new Date().toISOString();return d});
   await asaas(`/payments/${encodeURIComponent(root.paymentId)}/receiveInCash`,{method:'POST',body:{paymentDate:p.paymentDate,value:49.9,notifyCustomer:false}});
  }
  await syncAnnual(root.id);
  const result=await subscriptionDashboard(member);if(!result.active)fail('Recebimento registrado, mas a liberação ainda precisa de conferência.');
  return {ok:true,active:true,validUntil:result.validUntil,paymentId:root.paymentId};
 });
}
export async function inspectAnnualPayment(memberId){
 const member=(await readRecord(MEMBERS))?.data?.members?.find(m=>m.id===memberId);if(!member)fail('Cadastro não encontrado.',404);
 const roots=((await readRecord(PURCHASES))?.data?.purchases||[]).filter(r=>r.memberId===memberId&&r.provider==='asaas'&&r.environment===asaasConfig().environment&&r.annual);
 if(!roots.length)fail('Nenhuma assinatura anual Asaas para consultar.');
 const payments=[];for(const r of roots){const result=await syncAnnual(r.id);if(result)payments.push(...result.payments)}
 const d=await subscriptionDashboard(member);return {active:d.active,validUntil:d.validUntil,payments};
}

const manualSchema=z.object({memberId:z.string().uuid(),requestId:z.string().uuid(),confirmed:z.literal(true),kind:z.enum(['external','courtesy']),reason:z.string().trim().min(10).max(500),reference:z.string().trim().max(150).default('')});
export async function searchAnnualMembers(input){
 const query=z.string().trim().min(3).max(254).parse(input.query);
 const normalize=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const q=normalize(query),members=(await readRecord(MEMBERS))?.data?.members||[];
 return {members:members.filter(m=>normalize(m.name).includes(q)||normalize(m.email).includes(q)).slice(0,20).map(m=>({id:m.id,name:m.name,email:m.email}))};
}
export async function activateManualAnnual(admin,input){
 const p=manualSchema.parse(input);
 if(p.kind==='external'&&p.reference.length<10)fail('Informe a referência do pagamento recebido (mínimo de 10 caracteres).',400);
 return withMembershipLock(p.memberId,async()=>{
  const member=(await readRecord(MEMBERS))?.data?.members?.find(m=>m.id===p.memberId);if(!member)fail('Cadastro não encontrado.',404);
  const data=(await readRecord(PURCHASES))?.data,prior=data?.purchases?.find(r=>r.id===p.requestId);
  const same=r=>r.memberId===p.memberId&&r.provider==='manual'&&r.manualActivation?.kind===p.kind&&r.manualActivation.reason===p.reason&&r.manualActivation.reference===p.reference;
  if(prior){if(!same(prior))fail('Solicitação já utilizada com outros dados.');return {ok:true,active:prior.status==='paid'&&Date.parse(prior.endsAt)>Date.now(),validUntil:prior.endsAt,alreadyApplied:true};}
  await assertNoMakerworldCheckout(member);
  const dashboard=await subscriptionDashboard(member);
  if(dashboard.active)fail('Este cadastro já possui assinatura ativa. Nenhum período foi duplicado.');
  if(dashboard.purchase||dashboard.recurring||dashboard.legacyPending||dashboard.autoRenew)fail('Existe cobrança ou assinatura em andamento. Use a conferência de pagamento para evitar duplicidade.');
  const now=new Date().toISOString(),endsAt=yearAfter(now);
  const record=await updateRecord(PURCHASES,d=>{
   d||={purchases:[]};const existing=d.purchases.find(r=>r.id===p.requestId);
   if(existing){if(!same(existing))fail('Solicitação já utilizada com outros dados.');return d;}
   const own=d.purchases.filter(r=>r.memberId===p.memberId&&currentPurchase(r));
   if(own.some(r=>['creating','pending','overdue','review','scheduled'].includes(r.status)||r.status==='paid'&&Date.parse(r.endsAt)>Date.now()))fail('A situação da assinatura mudou. Atualize antes de liberar.');
   if(p.kind==='external'&&d.purchases.some(r=>r.directReceipt?.reference===p.reference||r.manualActivation?.kind==='external'&&r.manualActivation.reference===p.reference))fail('Este comprovante já foi utilizado.');
   d.purchases.push({id:p.requestId,memberId:member.id,name:member.name,email:member.email,whatsapp:member.whatsapp||'',countryCode:member.countryCode||'',provider:'manual',environment:purchaseEnvironment('manual'),status:'paid',billingType:p.kind==='external'?'Pagamento externo':'Cortesia',currency:'BRL',totalCents:p.kind==='external'?4990:0,lang:'pt',createdAt:now,paidAt:now,startsAt:now,endsAt,terms:MAKER_TERMS,termsVersion:MAKER_VERSION,manualActivation:{kind:p.kind,reason:p.reason,reference:p.reference,actor:admin.email,at:now}});
   markSubscriberWelcome(d.purchases.at(-1),d.purchases,now);
   return d;
  });
  const row=record.purchases.find(r=>r.id===p.requestId);
  return {ok:true,active:true,validUntil:row.endsAt};
 });
}
