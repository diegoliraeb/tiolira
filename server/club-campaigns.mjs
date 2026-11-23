import {randomUUID,createHmac,createHash} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {z} from 'zod';
import {readRecord,updateRecord} from './store.mjs';
import {securityConfig,safeEqual} from './auth.mjs';
import {subscriptionReport,subscriptionDashboard} from './maker-subscriptions.mjs';
import {makerPurchases} from './maker-purchases.mjs';
import {purchaseEmailLanguage} from './purchase-email-i18n.mjs';
import {purchaseEmailConfig} from './purchase-email.mjs';
import {deliveryTrackingStatus} from './email-delivery-events.mjs';
import {storeCountry,countryName} from '../lib/geography.mjs';
import {campaignEmail,CAMPAIGN_VERSION} from './club-campaign-email.mjs';
const INDEX='club-campaigns/index.json',PREFS='club-campaigns/preferences.json',DAY=86400000;
const fail=(m,s=400)=>{throw Object.assign(Error(m),{status:s})};
const emailHash=email=>createHash('sha256').update(String(email).trim().toLowerCase()).digest('hex');
const key=id=>{if(!z.uuid().safeParse(id).success)fail('Campanha inválida.');return `club-campaigns/${id}.json`};
const iso=()=>new Date().toISOString();
const live=()=>!process.env.VERCEL||process.env.VERCEL_ENV==='production';
async function context(){
 const [members,subscriptions,prefs,carts,orders,index,suppressed]=await Promise.all([readRecord('club-members.json'),subscriptionReport(),readRecord(PREFS),readRecord('analytics/cart-reminders.json'),readRecord('commerce.json'),readRecord(INDEX),readRecord('email-suppressions.json')]);
 return {members:members?.data?.members||[],subscriptions:subscriptions.subscriptions,prefs:prefs?.data||{},cartOptOut:carts?.data?.optOut||{},orders:orders?.data?.orders||[],index:index?.data||{runs:[]},suppressed:suppressed?.data||{}};
}
export function campaignAudience(ctx,now=Date.now()){
 const active=new Set(ctx.subscriptions.filter(s=>s.active).map(s=>s.memberId));
 const activeEmails=new Set(ctx.members.filter(m=>active.has(m.id)).map(m=>m.email.trim().toLowerCase()));
 const seen=new Set(),excluded={active:0,optOut:0,invalid:0,recent:0,duplicate:0};const recipients=[];
 for(const m of ctx.members){
  const email=String(m.email||'').trim().toLowerCase(),hash=emailHash(email);
  if(!z.email().safeParse(email).success||m.disabled||m.deletedAt){excluded.invalid++;continue;}
  if(active.has(m.id)||activeEmails.has(email)){excluded.active++;continue;}
  if(ctx.prefs.optOut?.[hash]||ctx.prefs.memberOptOut?.[m.id]||ctx.cartOptOut[m.id]||ctx.suppressed[hash]||m.emailOptOut||m.marketingOptOut){excluded.optOut++;continue;}
  if(ctx.prefs.lastSent?.[hash]&&now-Date.parse(ctx.prefs.lastSent[hash])<30*DAY){excluded.recent++;continue;}
  if(seen.has(email)){excluded.duplicate++;continue;}seen.add(email);
  const countryCode=storeCountry(m)||storeCountry(m.directoryProfile||{})||'',country=countryCode?countryName(countryCode):m.country||'Não informado';
  const latest=ctx.orders.filter(o=>o.memberId===m.id&&o.lang).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)))[0];
  const lang=purchaseEmailLanguage({emailLanguage:m.emailLanguage||m.preferredLanguage,lang:m.lang||latest?.lang,countryCode});
  recipients.push({id:randomUUID(),memberId:m.id,name:m.name,email,countryCode,country,lang,languageSource:m.emailLanguage||m.preferredLanguage?'preferência':m.lang||latest?.lang&&latest.lang!=='pt'?'idioma usado no site':countryCode?'país do cadastro':'padrão do site',status:'pending'});
 }
 return {recipients,excluded,total:ctx.members.length};
}
async function tokens(run,r,purpose){const {sessionSecret}=await securityConfig();if(!sessionSecret)fail('Segurança indisponível.',503);return `${run.id}.${r.id}.`+createHmac('sha256',sessionSecret).update(`${purpose}:${run.id}:${r.id}:${r.memberId}`).digest('base64url')}
async function resolveToken(token,purpose){
 if(typeof token!=='string'||!/^[a-f0-9-]{36}\.[a-f0-9-]{36}\.[A-Za-z0-9_-]{43}$/.test(token))fail('Link inválido.',410);
 const [id,rid]=token.split('.'),run=(await readRecord(key(id)))?.data,r=run?.recipients.find(r=>r.id===rid);
 if(!r||!safeEqual(token,await tokens(run,r,purpose)))fail('Link inválido.',410);
 return {run,r};
}
export async function campaignVisit(token,page){
 const {run,r}=await resolveToken(token,'visit');
 if(!['sending','complete','paused'].includes(run.status))fail('Link indisponível.',410);
 await updateRecord(key(run.id),d=>{const recipient=d.recipients.find(x=>x.id===r.id);recipient.clickedAt||=iso();recipient.lastClickedAt=iso();return d});
 return `/${r.lang}/assinatura${page==='about'?'/sobre':''}`;
}
const unsubscribeCopy={pt:['Preferências de e-mail','Deixar de receber novidades do Clube','Seu pedido foi registrado. Você não receberá novos convites promocionais do Clube. Os avisos sobre suas compras continuam.'],en:['Email preferences','Unsubscribe from Club news','Your request has been saved. You will no longer receive promotional Club invitations. Purchase messages will continue.'],es:['Preferencias de correo','Dejar de recibir novedades del Club','Tu solicitud se ha guardado. No recibirás más invitaciones promocionales del Club. Los avisos de tus compras continuarán.'],fr:['Préférences e-mail','Ne plus recevoir les nouveautés du Club','Votre demande a été enregistrée. Vous ne recevrez plus les invitations promotionnelles du Club. Les messages concernant vos achats continueront.']};
export async function campaignUnsubscribe(token,confirm=false){
 const {run,r}=await resolveToken(token,'stop');
 if(confirm){await updateRecord(PREFS,d=>{d||={};d.optOut||={};d.memberOptOut||={};d.optOut[emailHash(r.email)]={at:iso()};d.memberOptOut[r.memberId]={at:iso()};return d});await updateRecord(key(run.id),d=>{d.recipients.find(x=>x.id===r.id).unsubscribedAt||=iso();return d})}
 const c=unsubscribeCopy[r.lang]||unsubscribeCopy.en;
 return `<!doctype html><html lang="${r.lang}"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${c[0]}</title><body style="background:#f5f0e4;font:17px/1.7 Arial;color:#30452f;padding:24px"><main style="max-width:560px;margin:40px auto"><h1>${c[0]}</h1>${confirm?`<p>${c[2]}</p>`:`<form method="post" action="/api/club-campaigns/unsubscribe?token=${encodeURIComponent(token)}"><button style="padding:18px;background:#30452f;color:white;border:0;border-radius:10px;font-size:16px">${c[1]}</button></form>`}<p>Tio Lira · tiolira.com.br</p></main></body></html>`;
}
export async function prepareClubCampaign(actor,input){
 if(!live())fail('Campanhas disponíveis apenas em produção.',409);
 const id=z.uuid().parse(input.requestId),existing=(await readRecord(key(id)))?.data;
 if(existing)return {id:existing.id};
 const ctx=await context();if(ctx.index.runs.some(r=>['draft','sending'].includes(r.status)))fail('Já existe uma campanha preparada ou em envio.',409);
 const audience=campaignAudience(ctx);if(!audience.recipients.length)fail('Nenhum membro elegível neste momento.',409);
 const config=purchaseEmailConfig();if(!config)fail('E-mail não configurado.',503);
 const previews=Object.fromEntries(['pt','en','es','fr'].map(lang=>[lang,campaignEmail({lang,member:{countryCode:lang==='pt'?'BR':'US'},origin:config.origin,visit:`${config.origin}/${lang}/assinatura`,stop:`${config.origin}/${lang}/clube`})]));
 const run={id,title:'Convite à assinatura · '+new Date().toLocaleDateString('pt-BR',{timeZone:'America/Maceio'}),createdAt:iso(),createdBy:actor.email,version:CAMPAIGN_VERSION,status:'draft',recipients:audience.recipients,excluded:audience.excluded,previews};
 await updateRecord(INDEX,d=>{d||={runs:[]};if(d.runs.some(r=>r.id===id))return d;if(d.runs.some(r=>['draft','sending'].includes(r.status)))fail('Já existe uma campanha preparada ou em envio.',409);d.runs.unshift({id,title:run.title,createdAt:run.createdAt,status:'draft'});return d});
 await updateRecord(key(id),d=>d||run);return {id};
}
export async function releaseClubCampaign(id){
 if(!live()||!purchaseEmailConfig())fail('Envio indisponível neste ambiente.',503);
 const tracking=await deliveryTrackingStatus();if(!tracking.configured||!tracking.openTracking)fail('Configure o relatório de entrega e abertura antes de enviar.',409);
 await updateRecord(key(id),d=>{if(!d)fail('Campanha não encontrada.',404);if(d.status==='draft'){d.status='sending';d.releasedAt=iso()}return d});
 await updateRecord(INDEX,d=>{const r=d.runs.find(r=>r.id===id);if(r?.status==='draft')r.status='sending';return d});return {ok:true};
}
export async function pauseClubCampaign(id){await updateRecord(key(id),d=>{if(!d)fail('Campanha não encontrada.',404);if(d.status==='sending')d.status='paused';return d});await updateRecord(INDEX,d=>{const r=d.runs.find(r=>r.id===id);if(r)r.status='paused';return d});return {ok:true};}
async function skip(runId,rid,reason){await updateRecord(key(runId),d=>{const r=d.recipients.find(r=>r.id===rid);r.status='skipped';r.reason=reason;r.leaseUntil=0;return d})}
export async function runClubCampaign(id,{limit=15}={}){
 if(!live())return {sent:0};const config=purchaseEmailConfig();if(!config)fail('E-mail indisponível.',503);
 let run=(await readRecord(key(id)))?.data;if(run?.status!=='sending')return {sent:0};if(run.notBefore&&Date.parse(run.notBefore)>Date.now())return {sent:0,pending:run.recipients.filter(r=>['pending','retry','sending'].includes(r.status)).length,notBefore:run.notBefore};
 const ctx=await context();const eligible=new Set(campaignAudience(ctx).recipients.map(r=>r.memberId));let sent=0;const started=Date.now();
 for(const candidate of run.recipients.filter(r=>['pending','retry','sending'].includes(r.status)).slice(0,limit)){
  if(Date.now()-started>35000)break;
  run=(await readRecord(key(id)))?.data;if(run.status!=='sending')break;
  const r=run.recipients.find(x=>x.id===candidate.id);if(r.leaseUntil>Date.now()||r.status==='sent')continue;
  const member=ctx.members.find(m=>m.id===r.memberId);
  if(!eligible.has(r.memberId)||member?.email?.trim().toLowerCase()!==r.email){await skip(id,r.id,'Assinante ativo, descadastro, envio recente ou cadastro alterado.');continue;}
  if((await subscriptionDashboard(member)).active){await skip(id,r.id,'Assinatura ativada antes do envio.');continue;}
  const freshPrefs=(await readRecord(PREFS))?.data;if(freshPrefs?.optOut?.[emailHash(r.email)]||freshPrefs?.memberOptOut?.[r.memberId]){await skip(id,r.id,'Descadastro antes do envio.');continue;}
  const visit=`${config.origin}/api/club-campaigns/visit?token=${await tokens(run,r,'visit')}`,stop=`${config.origin}/api/club-campaigns/unsubscribe?token=${await tokens(run,r,'stop')}`,owner=randomUUID();
  const payload=r.payload||{from:config.from,to:[r.email],...campaignEmail({lang:r.lang,member:{...member,countryCode:r.countryCode},origin:config.origin,visit,stop}),headers:{'List-Unsubscribe':`<${stop}>`,'List-Unsubscribe-Post':'List-Unsubscribe=One-Click'},tags:[{name:'campaign',value:id}]};
  let claimed=false;
  const claimedRun=await updateRecord(key(id),d=>{claimed=false;const job=d.recipients.find(x=>x.id===r.id);if(d.status!=='sending'||!['pending','retry','sending'].includes(job.status)||job.leaseUntil>Date.now())return d;if(job.firstAttemptAt&&Date.now()-Date.parse(job.firstAttemptAt)>=23*3600000){job.status='review';job.error='Tentativa antiga sem confirmação. Conferir no provedor antes de repetir.';return d;}job.status='sending';job.owner=owner;job.leaseUntil=Date.now()+60000;job.firstAttemptAt||=iso();job.attempts=(job.attempts||0)+1;job.payload||=payload;claimed=true;return d});
  if(!claimed)continue;const job=claimedRun.recipients.find(x=>x.id===r.id);
  try{
   const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${config.key}`,'Content-Type':'application/json','Idempotency-Key':`club-campaign/${id}/${r.id}`},body:JSON.stringify(job.payload),signal:AbortSignal.timeout(10000)});
   const result=await response.json().catch(()=>({}));
   if(!response.ok){const e=Error(`Provedor retornou HTTP ${response.status}${typeof result.message==='string'?': '+result.message.slice(0,160):''}`);e.retry=response.status===429;e.dailyQuota=e.retry&&(result.name==='daily_quota_exceeded'||/daily.*quota/i.test(result.message||''));e.rejected=response.status>=400&&response.status<500&&response.status!==409;throw e;}
   if(!result.id)throw Error('Provedor não confirmou o identificador de envio.');
   await updateRecord(key(id),d=>{const j=d.recipients.find(x=>x.id===r.id);if(j.owner===owner){j.status='sent';j.sentAt=iso();j.providerId=result.id;j.leaseUntil=0;delete d.notBefore;delete d.waitReason;delete j.payload;delete j.error;}return d});
   await updateRecord(PREFS,d=>{d||={};d.lastSent||={};d.lastSent[emailHash(r.email)]=iso();return d});sent++;
  }catch(e){await updateRecord(key(id),d=>{const j=d.recipients.find(x=>x.id===r.id);if(j.owner===owner&&j.status!=='sent'){j.status=e.retry?'retry':e.rejected?'failed':'review';j.error=e.message;j.leaseUntil=0;if(e.retry){delete j.firstAttemptAt;if(e.dailyQuota){const next=new Date();next.setUTCHours(24,5,0,0);d.notBefore=next.toISOString();d.waitReason='Limite diário do Resend atingido. A fila retoma automaticamente após a renovação da cota.';}else{d.notBefore=new Date(Date.now()+60000).toISOString();d.waitReason='Aguardando limite de envio do provedor.';}}}return d});break;}
  await delay(600);
 }
 run=(await readRecord(key(id)))?.data;const pending=run.recipients.filter(r=>['pending','retry','sending'].includes(r.status)).length;
 if(!pending){await updateRecord(key(id),d=>{if(d.status==='sending'){d.status='complete';d.completedAt=iso()}return d});await updateRecord(INDEX,d=>{const r=d.runs.find(x=>x.id===id);if(r)r.status='complete';return d})}
 return {sent,pending};
}
export async function runClubCampaignQueue(){const index=(await readRecord(INDEX))?.data;const run=index?.runs.find(r=>r.status==='sending');return run?runClubCampaign(run.id):{sent:0};}
export function campaignConversions(runs,purchases){
 const result=new Map();
 for(const p of purchases.filter(p=>p.status==='paid'&&p.manualActivation?.kind!=='courtesy'&&p.paidAt)){
  const touch=runs.flatMap(run=>run.recipients.filter(r=>r.memberId===p.memberId&&r.sentAt&&r.clickedAt&&Date.parse(r.sentAt)<=Date.parse(p.createdAt)&&Date.parse(r.clickedAt)<=Date.parse(p.createdAt)&&Date.parse(p.createdAt)-Date.parse(r.clickedAt)<=30*DAY).map(r=>({run,r}))).sort((a,b)=>b.r.clickedAt.localeCompare(a.r.clickedAt))[0];
  if(touch){const id=touch.run.id+':'+touch.r.id;if(!result.has(id))result.set(id,{orderId:p.id,paidAt:p.paidAt,currency:p.currency,totalCents:p.totalCents});}
 }
 return result;
}
function counts(rows){return {recipients:rows.length,sent:rows.filter(r=>r.sentAt).length,delivered:rows.filter(r=>r.delivery?.delivered).length,opened:rows.filter(r=>r.delivery?.opened).length,clicked:rows.filter(r=>r.clickedAt).length,subscribed:rows.filter(r=>r.conversion).length,unsubscribed:rows.filter(r=>r.unsubscribedAt).length,failed:rows.filter(r=>['failed','review'].includes(r.status)||r.delivery?.bounced||r.delivery?.failed||r.delivery?.complained||r.delivery?.suppressed).length,pending:rows.filter(r=>['pending','retry','sending'].includes(r.status)).length,skipped:rows.filter(r=>r.status==='skipped').length};}
export async function clubCampaignReport(id){
 const [ctx,tracking,purchases]=await Promise.all([context(),deliveryTrackingStatus(),makerPurchases()]);
 const audience=campaignAudience(ctx),runs=await Promise.all(ctx.index.runs.map(async r=>(await readRecord(key(r.id)))?.data));
 const validRuns=runs.filter(Boolean),selected=validRuns.find(r=>r.id===id)||validRuns[0],conversions=campaignConversions(validRuns,purchases);
 let campaign=null;
 if(selected){const rows=[];for(let i=0;i<selected.recipients.length;i+=20)rows.push(...await Promise.all(selected.recipients.slice(i,i+20).map(async r=>{const {payload,owner,leaseUntil,...safe}=r;return {...safe,delivery:r.providerId?(await readRecord(`email-events/${r.providerId}.json`))?.data?.events||{}:{},conversion:conversions.get(selected.id+':'+r.id)||null}})));
  campaign={...selected,recipients:rows,summary:counts(rows)};
 }
 const group=rows=>Object.values(rows.reduce((a,r)=>{const id=`${r.countryCode}:${r.lang}`;a[id]||={country:r.country,countryCode:r.countryCode,lang:r.lang,rows:[]};a[id].rows.push(r);return a},{})).map(({rows,...g})=>({...g,...counts(rows)})).sort((a,b)=>b.recipients-a.recipients);
 return {emailReady:!!purchaseEmailConfig(),tracking,template:{version:CAMPAIGN_VERSION,title:'Convite à assinatura — Click Sanctis'},audience:{total:audience.total,eligible:audience.recipients.length,excluded:audience.excluded,groups:group(audience.recipients)},runs:ctx.index.runs,campaign,groups:campaign?group(campaign.recipients):[],metricNote:'Aberturas são estimadas e não comprovam leitura; bloqueios de imagens e robôs podem afetar os números. Cliques também podem incluir verificadores automáticos. Conversão: assinatura paga, sem cortesia, iniciada após um clique registrado nos últimos 30 dias; atribuída à campanha mais recente elegível. Estornos deixam de contar.'};
}
