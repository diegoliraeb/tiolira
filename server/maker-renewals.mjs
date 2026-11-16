import {createHash,randomUUID} from 'node:crypto';
import {readRecord,updateRecord} from './store.mjs';
import {makerPurchases,purchasePublic} from './maker-purchases.mjs';
import {purchaseValidity,reminderWindow} from '../lib/maker-purchases.mjs';
import {paymentsReady,asaasConfig} from './asaas.mjs';
import {paypalReady,paypalConfig} from './paypal.mjs';
import {internationalBuyer} from '../lib/international-pricing.mjs';
import {purchaseEmailConfig} from './purchase-email.mjs';
const KEY='maker-renewal-notices.json',fail=(m,s=409)=>{throw Object.assign(Error(m),{status:s})};
function renewalMessage(row,origin){const date=new Date(row.validUntil).toLocaleDateString(row.lang==='pt'?'pt-BR':row.lang||'pt-BR',{timeZone:'America/Maceio'}),link=`${origin}/${['pt','en','es','fr'].includes(row.lang)?row.lang:'pt'}/clube#assinatura`;
 const copy={pt:[`Olá, ${row.name}! Sua licença comercial MakerWorld Tio Lira vence em ${date}.`,`Renove para continuar imprimindo e vendendo as peças físicas cobertas. A renovação antecipada acrescenta um ano à validade atual.`,`Renovar minha licença:`,`Lembrete de renovação — licença MakerWorld Tio Lira`],en:[`Hello, ${row.name}! Your Tio Lira MakerWorld commercial license expires on ${date}.`,`Renew to keep printing and selling covered physical models. Early renewal adds one year after your current expiry date.`,`Renew my license:`,`Renewal reminder — Tio Lira MakerWorld license`],es:[`¡Hola, ${row.name}! Tu licencia comercial MakerWorld Tio Lira vence el ${date}.`,`Renueva para seguir imprimiendo y vendiendo las piezas físicas cubiertas. Renovar antes suma un año a la fecha de vencimiento actual.`,`Renovar mi licencia:`,`Recordatorio de renovación — licencia MakerWorld Tio Lira`],fr:[`Bonjour ${row.name} ! Votre licence commerciale MakerWorld Tio Lira expire le ${date}.`,`Renouvelez pour continuer à imprimer et vendre les modèles physiques couverts. Un renouvellement anticipé ajoute un an après l’échéance actuelle.`,`Renouveler ma licence :`,`Rappel de renouvellement — licence MakerWorld Tio Lira`]};const c=copy[row.lang]||copy.pt;return {subject:c[3],text:`${c[0]}\n\n${c[1]}\n\n${c[2]}\n${link}\n\nTio Lira · tiolira.com.br`};}
export function checkoutRecoveryMessage(name,origin){
 return {subject:'Corrigimos o pagamento da licença MakerWorld — tente novamente',text:`Olá, ${name}!

Aqui é o Tio Lira. Identificamos uma falha na tentativa de compra da sua licença comercial MakerWorld e corrigimos o fluxo de pagamento. Desculpe pelo transtorno!

Você já pode tentar novamente por este link:
${origin}/pt/clube#assinatura

Entre com o mesmo e-mail do seu cadastro, atualize a página e escolha PIX ou cartão de crédito pelo Asaas, no Brasil. Para compras do exterior, o pagamento é pelo PayPal.

A licença vale por 12 meses e fica disponível para download em PDF após a confirmação do pagamento. Esta é uma compra única, sem cobrança automática de renovação.

Use o link acima para iniciar a nova tentativa, em vez do link de pagamento antigo. Se já concluiu o pagamento, não precisa comprar novamente.

Obrigado pela compreensão e pelo apoio!
Tio Lira
tiolira.com.br`};
}
export function licenseSummary(subscriptions,purchases,legacy=[]){
 const paid=new Map();
 for(const r of purchases.filter(r=>r.status==='paid'))paid.set(`${r.provider}:${r.paymentId||r.id}`,r);
 for(const s of legacy)for(const p of s.confirmedPayments||[])paid.set(`${s.provider}:${p.id}`,p);
 const payments=[...paid.values()];
 return {activeSubscribers:new Set(subscriptions.filter(s=>s.active).map(s=>s.memberId)).size,confirmedPurchases:payments.length,totalCents:payments.filter(p=>p.currency==='BRL').reduce((n,p)=>n+p.totalCents,0),totalUsdCents:payments.filter(p=>p.currency==='USD').reduce((n,p)=>n+p.totalCents,0)};
}
export async function renewalReport(legacy={subscriptions:[]}){
 const [purchases,membersRecord,notices]=await Promise.all([makerPurchases(),readRecord('club-members.json'),readRecord(KEY)]),members=membersRecord?.data?.members||[],jobs=Object.values(notices?.data?.jobs||{}),ids=new Set([...purchases.map(p=>p.memberId),...legacy.subscriptions.map(s=>s.memberId)]);
 const subscriptions=[...ids].map(memberId=>{const rows=purchases.filter(p=>p.memberId===memberId),l=legacy.subscriptions.filter(s=>s.memberId===memberId).at(-1),member=members.find(m=>m.id===memberId),latest=rows.at(-1),v=purchaseValidity(rows),validUntil=[v.validUntil,l?.validUntil].filter(Boolean).sort().at(-1)||v.lastExpiry||l?.lastExpiry||null,active=v.active||l?.active||false,window=active&&!l?.autoRenew?reminderWindow(validUntil):null;
 const row={id:memberId,memberId,name:member?.name||latest?.name||l?.name,email:member?.email||latest?.email||l?.email,whatsapp:member?.whatsapp||member?.directoryProfile?.whatsapp||latest?.whatsapp||'',lang:latest?.lang||'pt',provider:latest?.provider||l?.provider,active,createdAt:rows[0]?.createdAt||l?.createdAt||null,lastActivityAt:latest?.paidAt||latest?.createdAt||l?.createdAt||null,validFrom:v.validFrom||l?.validFrom||null,validUntil,daysRemaining:validUntil?Math.ceil((Date.parse(validUntil)-Date.now())/86400000):null,autoRenew:l?.autoRenew||false,status:active?'active':rows.some(r=>['creating','pending','overdue','review'].includes(r.status))?'pending':validUntil?'expired':latest?.status||l?.status||'none',eligible:!!window,window,recoveryEligible:l?.status==='failed'&&!active&&!rows.some(r=>r.status!=='failed')&&!legacy.subscriptions.some(s=>s.memberId===memberId&&(s.active||s.autoRenew||!['failed','cancelled','expired'].includes(s.status))),history:[...rows.map(purchasePublic),...legacy.subscriptions.filter(s=>s.memberId===memberId).map(s=>({id:s.id,source:'legacy',provider:s.provider,billingType:'Assinatura anterior',currency:'BRL',totalCents:s.priceCents,status:s.active?'paid':s.status,createdAt:s.createdAt,startsAt:s.validFrom,endsAt:s.validUntil||s.lastExpiry}))].sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||'')),notices:jobs.filter(j=>j.memberId===memberId).map(({payload,...j})=>j).sort((a,b)=>(b.at||'').localeCompare(a.at||''))};
 let origin='https://www.tiolira.com.br';try{origin=new URL(process.env.SITE_URL).origin}catch{}const message=window?renewalMessage(row,origin).text:'';let phone=row.whatsapp.replace(/\D/g,'');if(!internationalBuyer(member||latest||{})&&/^\d{10,11}$/.test(phone))phone='55'+phone;row.whatsappUrl=window&&/^\d{10,15}$/.test(phone)?`https://wa.me/${phone}?text=${encodeURIComponent(message)}`:'';return row;
 }).sort((a,b)=>(a.daysRemaining??999999)-(b.daysRemaining??999999));
 const summary=licenseSummary(subscriptions,purchases,legacy.subscriptions);
 return {summary,providers:{asaas:{ready:paymentsReady(),environment:asaasConfig().environment},paypal:{ready:paypalReady(),environment:paypalConfig().environment}},emailReady:!!purchaseEmailConfig(),subscriptions};
}
export async function sendRenewalNotice(memberId,channel,legacy){
 const recovery=channel==='recovery-email',email=channel!=='whatsapp';
 if(!['email','whatsapp','recovery-email'].includes(channel))fail('Canal inválido.',400);
 const report=await renewalReport(legacy),row=report.subscriptions.find(r=>r.memberId===memberId);if(recovery?!row?.recoveryEligible:!row?.eligible)fail('O lembrete fica disponível nos últimos 30 dias de uma licença ativa sem renovação automática.');
 if(channel==='whatsapp'&&!row.whatsappUrl)fail('Cadastre um WhatsApp válido.');
 const config=purchaseEmailConfig();if(email&&!config)fail('E-mail indisponível.',503);
 const id=createHash('sha256').update(recovery?`checkout-fix-2026-11-16:${row.email.trim().toLowerCase()}`:`${memberId}:${row.validUntil}:${row.window}:${channel}`).digest('hex'),owner=randomUUID();
 const d=await updateRecord(KEY,d=>{d||={jobs:{}};const existing=d.jobs[id];if(existing?.status==='sent'||existing?.status==='opened')return d;if(existing?.leaseUntil>Date.now())fail('Envio já em andamento.');if(existing?.status==='review'||existing?.firstAttemptAt&&Date.now()-Date.parse(existing.firstAttemptAt)>23*3600000)fail('Envio sem confirmação: confira o provedor antes de repetir.');const j=d.jobs[id]||={id,memberId,channel,purpose:recovery?'checkout-fix':'renewal',expiry:row.validUntil,window:row.window,at:new Date().toISOString()};j.leaseUntil=Date.now()+60000;j.owner=owner;j.firstAttemptAt||=new Date().toISOString();j.status='sending';j.attempts=(j.attempts||0)+1;if(email)j.payload||={from:config.from,to:[row.email],...(recovery?checkoutRecoveryMessage(row.name,config.origin):renewalMessage(row,config.origin))};return d});
 const job=d.jobs[id];if(['sent','opened'].includes(job.status))return {status:job.status,...(channel==='whatsapp'?{url:row.whatsappUrl}:{})};
 try{
 let providerId;
 if(email){const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${config.key}`,'Content-Type':'application/json','Idempotency-Key':`maker-renewal/${id}`},body:JSON.stringify(job.payload),signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('E-mail não confirmado.');const data=await r.json();if(!data.id)throw Error('E-mail não confirmado.');providerId=data.id;}
 await updateRecord(KEY,d=>{const j=d.jobs[id];if(j.owner===owner){j.status=email?'sent':'opened';j.sentAt=email?new Date().toISOString():null;j.openedAt=channel==='whatsapp'?new Date().toISOString():null;j.providerId=providerId||null;j.leaseUntil=0;}return d});
 return {status:email?'sent':'opened',...(channel==='whatsapp'?{url:row.whatsappUrl}:{})};
 }catch(e){await updateRecord(KEY,d=>{const j=d.jobs[id];if(j.owner===owner){j.leaseUntil=0;j.status='pending';}return d});throw Object.assign(Error('Envio não confirmado. Tente novamente; a chave de envio evita duplicação.'),{status:503})}
}
