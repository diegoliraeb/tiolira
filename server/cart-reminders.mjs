import {z} from 'zod';
import {asaasConfig} from './asaas.mjs';
import {paypalConfig} from './paypal.mjs';
import {createHmac,randomUUID} from 'node:crypto';
import {readRecord,updateRecord} from './store.mjs';
import {securityConfig,safeEqual} from './auth.mjs';
import {cartState,cartKey} from './cart-state.mjs';
import {currentOrderEnvironment} from './payment-environment.mjs';
import {shop,quoteCheckout} from './commerce.mjs';
import {cartSelection} from '../lib/cart-lines.mjs';
import {purchaseEmailConfig} from './purchase-email.mjs';
import {reminderCopy} from '../lib/cart-reminder-copy.mjs';

const KEY='analytics/cart-reminders.json',CARTS='analytics/carts.json',HOUR=3600000,DAY=24*HOUR;
const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
const state=data=>({jobs:{},optOut:{},...data});
const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const live=()=>!process.env.VERCEL||process.env.VERCEL_ENV==='production';
export function assertReminderCron(req){if(!process.env.CRON_SECRET||!safeEqual(req.headers.authorization,`Bearer ${process.env.CRON_SECRET}`))fail('Não autorizado.',401);}
async function context(){const [c,r,o,m]=await Promise.all([readRecord(CARTS),readRecord(KEY),readRecord('commerce.json'),readRecord('club-members.json')]);return {carts:Object.values(c?.data?.carts||{}),reminders:state(r?.data),orders:o?.data?.orders||[],members:m?.data?.members||[]};}
// Only the newest cart for an account can generate a reminder, even if it was cleared.
function reason(cart,ctx,now,mode='manual'){
 if(!cart||!currentOrderEnvironment(cart))return 'Carrinho indisponível.';
 if(!ctx.members.some(m=>m.id===cart.memberId&&m.email===cart.memberEmail))return 'Cadastro alterado ou indisponível.';
 if(ctx.reminders.optOut[cart.memberId])return 'Cliente desativou os lembretes.';
 const latest=ctx.carts.filter(c=>c.memberId===cart.memberId&&currentOrderEnvironment(c)).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)||b.createdAt.localeCompare(a.createdAt)||b.cartId.localeCompare(a.cartId))[0];
 if(mode!=='test'&&latest&&cartKey(latest)!==cartKey(cart))return 'Existe um carrinho mais recente.';
 if(!(mode==='test'?['active','abandoned']:['abandoned']).includes(cartState(cart,ctx.orders,now)))return 'Carrinho ativo, vazio ou com pedido em andamento/concluído.';
 if(now-Date.parse(cart.updatedAt)>30*DAY)return 'Carrinho com mais de 30 dias.';
 if(mode==='automatic'&&now-Date.parse(cart.updatedAt)<6*HOUR)return 'Aguardando 6 horas.';
 const job=ctx.reminders.jobs[cartKey(cart)];
 if(job?.status==='sent')return 'Lembrete já enviado.';
 if(job?.status==='cancelled')return 'Envio cancelado porque o carrinho mudou.';
 if(job?.status==='review'||job?.firstAttemptAt&&now-Date.parse(job.firstAttemptAt)>=23*HOUR)return 'Envio sem confirmação; verificar no provedor antes de outra tentativa.';
 if(job?.leaseUntil>now)return 'Envio em andamento.';
 if(Object.values(ctx.reminders.jobs).some(j=>j.memberId===cart.memberId&&j.id!==job?.id&&(j.leaseUntil>now||j.sentAt&&now-Date.parse(j.sentAt)<DAY||j.firstAttemptAt&&now-Date.parse(j.firstAttemptAt)<DAY)))return 'Limite de um lembrete por cliente a cada 24 horas.';
 return null;
}
async function tokenFor(job,purpose){const {sessionSecret}=await securityConfig();if(!sessionSecret||sessionSecret.length<32)fail('Segurança de e-mail indisponível.',503);return job.id+'.'+createHmac('sha256',sessionSecret).update(`cart-reminder:${purpose}:${job.id}:${job.createdAt}`).digest('base64url');}
async function tokenJob(token,purpose,now){if(typeof token!=='string'||!/^[a-f0-9]{64}\.[A-Za-z0-9_-]{43}$/.test(token))fail('Link inválido ou expirado.',410);const job=state((await readRecord(KEY))?.data).jobs[token.split('.')[0]];if(!job||!safeEqual(token,await tokenFor(job,purpose))||purpose==='recover'&&now-Date.parse(job.createdAt)>30*DAY)fail('Link inválido ou expirado.',410);return job;}
export function reminderEmail(cart,origin,recoverToken,stopToken){
 const lang=cart.lang||'pt',c=reminderCopy(lang),link=`${origin}/${lang}/clube#recuperar=${recoverToken}`,stop=`${origin}/${lang}/lembretes#cancelar=${stopToken}`,names=cart.items.map(i=>i.name);
 return {subject:c.subject,text:`${c.title}\n\n${c.intro}\n\n${names.join('\n')}\n\n${c.cta}:\n${link}\n\n${c.note}\n\n${c.stop}:\n${stop}\n\nTio Lira`,html:`<!doctype html><html lang="${lang}"><meta charset="utf-8"><body style="margin:0;background:#f4f0e5;font-family:Arial,sans-serif;color:#303c2b"><div style="max-width:560px;margin:28px auto;padding:32px;background:#fffaf1;border-radius:22px"><table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 26px"><tr><td style="vertical-align:middle;padding-right:14px"><img src="${escape(origin.replace(/\/$/, ''))}/assets/tl-monogram-3d-icon.png" width="64" height="64" alt="Logomarca Tio Lira" style="display:block;border:0;width:64px;height:64px"></td><td style="vertical-align:middle;font-size:28px;font-weight:bold;color:#303c2b;letter-spacing:-1px">tio lira</td></tr></table><h1 style="font-size:30px;line-height:1.2">${escape(c.title)}</h1><p style="line-height:1.7">${escape(c.intro)}</p><div style="padding:18px;background:#eee8da;border-radius:14px">${names.map(n=>`<p style="font-weight:bold">${escape(n)}</p>`).join('')}</div><p style="margin:30px 0"><a href="${escape(link)}" style="display:inline-block;padding:17px 24px;background:#404934;color:white;text-decoration:none;border-radius:30px;font-weight:bold">${escape(c.cta)} →</a></p><p style="font-size:13px;line-height:1.6">${escape(c.note)}</p><p style="font-size:12px;margin-top:32px"><a href="${escape(stop)}" style="color:#69715d">${escape(c.stop)}</a></p></div></body></html>`};
}
export async function sendCartReminder(id,{mode='manual',now=Date.now(),testCart=null}={}){
 if(!live())fail('Lembretes são enviados apenas no ambiente de produção.',409);
 const config=purchaseEmailConfig();if(!config)fail('Configure o envio de e-mail.',503);
 if(typeof id!=='string'||!/^[a-f0-9]{64}$/.test(id))fail('Carrinho inválido.');
 let ctx=await context();if(mode==='test'&&testCart)ctx.carts=[...ctx.carts,testCart];let cart=ctx.carts.find(c=>cartKey(c)===id),blocked=reason(cart,ctx,now,mode);if(blocked)fail(blocked,409);
 const member=ctx.members.find(m=>m.id===cart.memberId),selection=cart.items.map(({id,kind})=>({id,kind}));
 // Revalidate ownership, availability and current prices, without creating any order.
 await quoteCheckout(member,{items:selection,couponCode:''});
 const attempt=randomUUID(),fresh={...(mode==='test'?{testCart}:{}),id,cartId:cart.cartId,memberId:cart.memberId,memberName:member.name,memberEmail:member.email,mode,lang:cart.lang||'pt',createdAt:new Date(now).toISOString(),cartUpdatedAt:cart.updatedAt,sequence:cart.sequence,items:selection,coupon:cart.coupon||'',status:'sending',attempts:0};
 const newPayload={from:config.from,to:[member.email],...reminderEmail(cart,config.origin,await tokenFor(fresh,'recover'),await tokenFor(fresh,'stop'))};
 if(mode==='test')newPayload.subject='[TESTE] '+newPayload.subject;
 await updateRecord(KEY,old=>{
  const s=state(old),why=reason(cart,{...ctx,reminders:s},now,mode);if(why)fail(why,409);
  const job=s.jobs[id]||fresh;
  if(job.sequence!==cart.sequence||job.cartUpdatedAt!==cart.updatedAt)fail('O carrinho mudou desde a tentativa de envio.',409);
  job.payload ||= newPayload;job.firstAttemptAt ||= new Date(now).toISOString();job.status='sending';job.attempts++;job.leaseUntil=now+60000;job.attempt=attempt;s.jobs[id]=job;return s;
 });
 // A purchase, opt-out or newer cart may have arrived while the message was prepared.
 ctx=await context();if(mode==='test'&&testCart)ctx.carts=[...ctx.carts,testCart];const job=ctx.reminders.jobs[id];cart=ctx.carts.find(c=>cartKey(c)===id);
 const check=structuredClone(ctx);check.reminders.jobs[id].leaseUntil=0;
 blocked=reason(cart,check,now,mode);
 if(blocked||!cart||cart.sequence!==job.sequence||cart.updatedAt!==job.cartUpdatedAt){await updateRecord(KEY,old=>{const s=state(old);if(s.jobs[id]?.attempt===attempt){s.jobs[id].status='cancelled';s.jobs[id].leaseUntil=0;delete s.jobs[id].payload;}return s;});fail(blocked||'O carrinho mudou; envio cancelado.',409);}
 try{
  const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${config.key}`,'Content-Type':'application/json','Idempotency-Key':`cart-reminder/${id}`},body:JSON.stringify(job.payload),signal:AbortSignal.timeout(8000)});
  if(!response.ok)throw Error('delivery');const result=await response.json();if(typeof result.id!=='string'||!result.id)throw Error('delivery');
  await updateRecord(KEY,old=>{const s=state(old),j=s.jobs[id];if(j?.attempt===attempt){j.status='sent';j.sentAt=new Date(now).toISOString();j.providerId=result.id;j.leaseUntil=0;delete j.payload;delete j.error;}return s;});
  return {ok:true,status:'sent'};
 }catch{
  await updateRecord(KEY,old=>{const s=state(old),j=s.jobs[id];if(j?.attempt===attempt&&j.status!=='sent'){j.status='failed';j.leaseUntil=0;j.error='Provedor não confirmou o envio. Nova tentativa usa a mesma mensagem, sem duplicar.';}return s;});fail('Envio não confirmado. Uma nova tentativa não duplicará a mensagem.',503);
 }
}

// Admin-requested test: no order, no synthetic abandoned-cart analytics and no account creation.
export async function sendTestCartReminder(input,now=Date.now()){
 const parsed=z.object({email:z.string().trim().toLowerCase().email().max(254),requestId:z.string().uuid()}).parse(input);
 const ctx=await context(),member=ctx.members.find(m=>m.email.toLowerCase()===parsed.email);
 if(!member)fail('Este e-mail não está cadastrado na Área do Parceiro. Use o e-mail da conta para testar a recuperação.',404);
 const available=await shop(member),piece=available.products.find(p=>!p.owned&&/saci/i.test(p.name))||available.products.find(p=>!p.owned);
 if(!piece)fail('A conta não possui uma peça disponível para montar o carrinho de teste.',409);
 const id=cartKey({memberId:member.id,cartId:parsed.requestId}),existing=ctx.reminders.jobs[id];
 if(existing&&existing.mode!=='test')fail('Identificador de teste inválido.',409);
 const quote=await quoteCheckout(member,{items:[{kind:'product',id:piece.id}],couponCode:''}),stamp=new Date(now).toISOString();
 const cart=existing?.testCart||{cartId:parsed.requestId,memberId:member.id,memberName:member.name,memberEmail:member.email,createdAt:stamp,updatedAt:stamp,sequence:1,lang:'pt',provider:available.paymentProvider,environment:(available.currency==='USD'?paypalConfig():asaasConfig()).environment,currency:available.currency,items:quote.items,productIds:quote.productIds,totalCents:quote.totalCents,coupon:null};
 const result=await sendCartReminder(id,{mode:'test',now,testCart:cart});
 return {...result,email:member.email,items:cart.items.map(i=>i.name)};
}

export async function runCartReminders(now=Date.now()){
 if(!live()||!purchaseEmailConfig())fail('Automação de e-mail não configurada neste ambiente.',503);
 const ctx=await context(),candidates=ctx.carts.filter(c=>!reason(c,ctx,now,'automatic')).sort((a,b)=>a.updatedAt.localeCompare(b.updatedAt));
 const result={checked:candidates.length,sent:0,skipped:0,failed:0};const started=Date.now();
 for(const cart of candidates.slice(0,10)){
  if(Date.now()-started>40000)break;
  try{await sendCartReminder(cartKey(cart),{mode:'automatic',now});result.sent++;}catch(e){if(e.status===409||e.status===400)result.skipped++;else result.failed++;}
 }
 await updateRecord(KEY,old=>({...state(old),lastRun:{at:new Date(now).toISOString(),...result}}));return result;
}
export async function unsubscribeCartReminders(token,now=Date.now()){
 const job=await tokenJob(token,'stop',now);await updateRecord(KEY,old=>{const s=state(old);s.optOut[job.memberId]={at:new Date(now).toISOString()};return s;});return {ok:true};
}
export async function recoverCart(member,token,now=Date.now()){
 const job=await tokenJob(token,'recover',now);if(job.memberId!==member.id)fail('Entre com a conta que recebeu este lembrete.',403);
 const ctx=await context(),cart=ctx.carts.find(c=>cartKey(c)===job.id)||job.testCart;
 if(!cart||!currentOrderEnvironment(cart)||!cart.items.length)fail('Este carrinho não está mais disponível.',410);
 const orders=ctx.orders.filter(o=>o.memberId===member.id&&currentOrderEnvironment(o)&&Date.parse(o.createdAt)>=Date.parse(cart.createdAt)-5000&&cart.productIds.every(id=>o.productIds?.includes(id)));
 const order=orders.find(o=>o.status==='paid')||orders.find(o=>['pending','creating','overdue','review'].includes(o.status));
 if(order)return {orderId:order.id,items:[],status:'order'};
 const available=await shop(member),items=cartSelection(available,cart.items).lines.map(({id,kind})=>({id,kind}));
 let coupon=cart.coupon||'',changed=items.length!==cart.items.length;
 if(items.length){try{await quoteCheckout(member,{items,couponCode:coupon});}catch{coupon='';changed=true;await quoteCheckout(member,{items,couponCode:''});}}
 return {items,couponCode:coupon,cartId:cart.cartId,sequence:cart.sequence,status:!items.length?'empty':changed?'changed':'restored'};
}
export async function reminderReport(carts,orders,now=Date.now()){
 const [record,members]=await Promise.all([readRecord(KEY),readRecord('club-members.json')]),s=state(record?.data),ctx={carts,orders,reminders:s,members:members?.data?.members||[]};
 const entries={};for(const c of carts){const id=cartKey(c),j=s.jobs[id],blocked=reason(c,ctx,now);entries[c.cartId+':'+c.memberId]={id,status:j?.status||'waiting',sentAt:j?.sentAt||null,mode:j?.mode||null,error:j?.error||null,blocked,canSend:live()&&Boolean(purchaseEmailConfig())&&!blocked};}
 const history=Object.values(s.jobs).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,100).map(j=>({id:j.id,memberName:j.memberName,memberEmail:j.memberEmail,createdAt:j.createdAt,sentAt:j.sentAt,status:j.status,mode:j.mode,error:j.error}));
 return {emailReady:Boolean(purchaseEmailConfig()),automaticReady:live()&&Boolean(purchaseEmailConfig()&&process.env.CRON_SECRET),delayHours:6,lastRun:s.lastRun||null,carts:entries,history};
}
