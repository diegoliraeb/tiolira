import {purchaseEmailLanguage,internationalPurchaseEmail} from './purchase-email-i18n.mjs';
import {frenchPurchaseEmail} from './purchase-email-fr.mjs';
import {readRecord,updateRecord} from './store.mjs';
import {currentOrderEnvironment} from './payment-environment.mjs';
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function purchaseEmailConfig(){
 const {RESEND_API_KEY,EMAIL_FROM,SITE_URL}=process.env;
 try{const u=new URL(SITE_URL);if(RESEND_API_KEY&&EMAIL_FROM&&u.protocol==='https:'&&!u.username&&!u.password)return {key:RESEND_API_KEY,from:EMAIL_FROM,origin:u.origin};}catch{}
 return null;
}
export function purchaseApprovedEmail(order,origin){
 const site=new URL(origin);if(site.protocol!=='https:'||site.username||site.password)throw Error('Invalid email origin');
 const lang=purchaseEmailLanguage(order);
 if(lang==='fr')return frenchPurchaseEmail(order,site.origin);
 if(lang==='en'||lang==='es')return internationalPurchaseEmail(order,site.origin,lang);
 const link=`${site.origin}/pt/clube?pedido=${encodeURIComponent(order.id)}#compras`,url=escape(link),root=escape(site.origin),names=order.items.map(i=>i.name);
 const subject='Pagamento aprovado! Seus arquivos e licenças estão liberados — Tio Lira';
 const html=`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Pagamento aprovado — Tio Lira</title></head><body style="margin:0;background:#f8f6f0;color:#292b25;font-family:Arial,Helvetica,sans-serif"><div style="display:none;max-height:0;overflow:hidden">Sua compra foi aprovada. Baixe os arquivos e sua licença para vender as peças impressas.</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:28px 16px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px"><tr><td style="padding:0 8px 24px"><img src="${root}/assets/tl-monogram-3d-icon.png" width="52" height="52" alt="Tio Lira" style="vertical-align:middle;margin-right:14px"><strong style="font-size:30px;vertical-align:middle">tio lira</strong></td></tr><tr><td style="padding:30px 28px;background:#404934;color:#fff;border-radius:14px 14px 0 0"><p style="font-size:10px;letter-spacing:2px;margin:0 0 14px">SUA PRÓXIMA CRIAÇÃO COMEÇA AQUI</p><h1 style="font-size:30px;line-height:1.2;margin:0">Pagamento aprovado!</h1></td></tr><tr><td style="padding:30px 28px;background:#fffdf8;border:1px solid #deded3;border-top:0;border-radius:0 0 14px 14px"><p style="margin:0 0 16px;font-size:17px;font-weight:bold">Olá, ${escape(order.memberName)}!</p><p style="font-size:15px;line-height:1.7;color:#696b61">Recebemos a confirmação do seu pagamento. Os arquivos para impressão 3D e as licenças para vender as peças impressas já estão liberados na sua área do parceiro.</p><div style="padding:18px;background:#edf0e6;border-radius:8px;margin:24px 0"><p style="margin:0 0 10px;font-size:11px;letter-spacing:1px;color:#404934;font-weight:bold">SUA COMPRA</p>${names.map(name=>`<p style="margin:6px 0;font-size:15px;font-weight:bold">${escape(name)}</p>`).join('')}</div><p style="font-size:14px;line-height:1.7"><strong>1. Baixe os arquivos</strong> para começar a imprimir.<br><strong>2. Baixe a licença em PDF</strong> e guarde sua autorização de venda.</p><table role="presentation" cellpadding="0" cellspacing="0" style="margin:26px 0"><tr><td bgcolor="#c7512f" style="border-radius:7px"><a href="${url}" style="display:inline-block;padding:17px 22px;color:#fff;text-decoration:none;font-size:15px;font-weight:bold;line-height:1.4">Acessar meus arquivos e licença &rarr;</a></td></tr></table><p style="font-size:12px;line-height:1.6;color:#696b61">Entre com o mesmo e-mail usado na compra. Os downloads continuam disponíveis em <strong>Meus arquivos</strong> e <strong>Meus pedidos</strong>.</p><p style="font-size:12px;line-height:1.6;color:#696b61">Se o botão não abrir, copie este endereço:<br><a href="${url}" style="color:#404934;word-break:break-all">${url}</a></p><p style="margin-top:24px;padding-top:20px;border-top:1px solid #deded3;font-size:12px;line-height:1.6;color:#696b61">A licença permite vender as peças físicas impressas. Os arquivos digitais não podem ser revendidos ou compartilhados.</p></td></tr><tr><td align="center" style="padding:28px 12px;color:#696b61;font-size:12px;line-height:1.7">Feito de fé, afeto e criatividade brasileira.<br><a href="${root}/pt" style="color:#404934">tiolira.com.br</a></td></tr></table></td></tr></table></body></html>`;
 return {subject,html,text:`Olá, ${order.memberName}!\n\nPagamento aprovado! Os arquivos para impressão 3D e as licenças para vender as peças impressas estão liberados.\n\nSua compra: ${names.join(', ')}.\n\n1. Baixe os arquivos para imprimir.\n2. Baixe a licença de venda em PDF.\n\nAcessar meus arquivos e licença:\n${link}\n\nEntre com o mesmo e-mail usado na compra. Os downloads ficam em Meus arquivos e Meus pedidos.\n\nA licença permite vender as peças físicas impressas. Os arquivos digitais não podem ser revendidos ou compartilhados.\n\nTio Lira — tiolira.com.br`};
}
const fail=()=>{throw Object.assign(Error('Aviso de compra aguardando envio por e-mail.'),{status:503});};
const active=o=>o?.status==='paid'&&currentOrderEnvironment(o);
export async function sendPurchaseEmail(orderId){
 let order=(await readRecord('commerce.json'))?.data?.orders.find(o=>o.id===orderId);
 if(!active(order)||!order.purchaseEmail||order.purchaseEmail.status==='sent')return;
 const config=purchaseEmailConfig();if(!config)fail();
 // Freeze the exact payload once. Retries (including after a deploy) must match
 // Resend's idempotency key, which is retained for 24 hours.
 const record=await updateRecord('commerce.json',old=>{
  const o=old.orders.find(o=>o.id===orderId);if(!active(o)||o.purchaseEmail?.status==='sent')return old;
  const job=o.purchaseEmail;if(!job)return old;
  if(!job.payload){job.language=purchaseEmailLanguage(o);job.payload={from:config.from,to:[o.memberEmail],...purchaseApprovedEmail(o,config.origin)};}
  if(!job.firstAttemptAt)job.firstAttemptAt=new Date().toISOString();
  if(Date.now()-Date.parse(job.firstAttemptAt)>=23*60*60*1000){job.status='review';return old;}
  job.attempts=(job.attempts||0)+1;job.lastAttemptAt=new Date().toISOString();return old;
 });
 order=record.orders.find(o=>o.id===orderId);if(!active(order)||!order.purchaseEmail||order.purchaseEmail.status==='sent')return;
 if(order.purchaseEmail.status==='review')fail();
 try{
  const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${config.key}`,'Content-Type':'application/json','Idempotency-Key':`purchase-approved/${order.environment}/${order.id}`},body:JSON.stringify(order.purchaseEmail.payload),signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw Error('delivery');const result=await response.json();if(typeof result.id!=='string'||!result.id)throw Error('delivery');
  await updateRecord('commerce.json',old=>{const job=old.orders.find(o=>o.id===orderId)?.purchaseEmail;if(job){job.status='sent';job.providerId=result.id;job.sentAt=new Date().toISOString();delete job.lastError;}return old;});
 }catch{
  await updateRecord('commerce.json',old=>{const job=old.orders.find(o=>o.id===orderId)?.purchaseEmail;if(job&&job.status!=='sent'){job.lastError='Envio não confirmado. Aguardando nova tentativa.';}return old;});fail();
 }
}
