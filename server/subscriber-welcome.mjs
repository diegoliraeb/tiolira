import {createHash,randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {readRecord,updateRecord} from './store.mjs';
import {asaasConfig} from './asaas.mjs';
import {paypalConfig} from './paypal.mjs';
import {purchaseEmailConfig} from './purchase-email.mjs';
import {purchaseValidity} from '../lib/maker-purchases.mjs';
import template from './subscriber-welcome-template.mjs';

const KEY='subscriber-welcome-emails.json',VERSION='welcome-2026-11-24';
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const current=r=>r.environment===(r.provider==='paypal'?paypalConfig().environment:asaasConfig().environment);
const jobId=r=>createHash('sha256').update(`${r.environment}:${r.memberId}`).digest('hex');
const state=d=>({jobs:{},...d});
const allowed=()=>!process.env.VERCEL||process.env.VERCEL_ENV==='production';

export function subscriberWelcomeMessage(member,validUntil,origin){
 const root=new URL(origin);if(root.protocol!=='https:'||root.username||root.password)throw Error('Invalid site URL');
 const date=new Date(validUntil);if(!Number.isFinite(date.getTime()))throw Error('Invalid validity');
 const name=String(member.name||'assinante'),expiry=date.toLocaleDateString('pt-BR',{timeZone:'America/Maceio'});
 const html=template.replaceAll('{{nome}}',escape(name)).replaceAll('{{data_validade}}',escape(expiry)).replaceAll('{{origin}}',escape(root.origin));
 return {subject:'Bem-vindo ao Clube Tio Lira! Sua assinatura está ativa 💚',html,text:`Olá, ${name}!\n\nSua assinatura está ativa até ${expiry}. Obrigado por apoiar minhas criações!\n\nCLICK SANCTIS I ESTÁ INCLUÍDA\nBaixe a primeira parte dos santos de montar e as obras identificadas como “Incluído na assinatura”, sem custo adicional.\n\nSEUS BENEFÍCIOS\n• Downloads das obras exclusivas e incluídas.\n• 10% de desconto nas obras pagas, conectado à sua conta.\n• Licença comercial de todas as obras elegíveis, inclusive do MakerWorld, enquanto sua assinatura estiver ativa.\n• Grupo de assinantes: o convite está na sua área.\nA licença não libera o download de todas as obras pagas. Obras de uso pessoal continuam sem autorização de venda.\n\nCOMO COMEÇAR\n1. Entre no Clube.\n2. Em Meu ateliê, filtre as obras incluídas.\n3. Baixe os arquivos disponíveis.\n4. Antes de vender, gere a licença em Licenças e copie o código para seus anúncios.\n${root.origin}/pt/clube\n\nIMPORTANTE AO ANUNCIAR\nInclua “Licença comercial: [seu código]” na descrição do anúncio. Vale também para as peças baixadas no MakerWorld. O código ajuda a identificar a autorização nas verificações de rastreabilidade. Sem ele, pode ser necessário confirmar sua autorização. Use o botão de copiar texto na área de Licenças.\n\nCompras avulsas mantêm a licença própria conforme as condições originais, independentemente da assinatura. Arquivos digitais são pessoais: não compartilhe, revenda ou redistribua. Downloads de 3MF pelo site recebem identificação individual para rastreabilidade. A autorização comercial se refere às impressões físicas elegíveis.\n\nDetalhes: ${root.origin}/pt/assinatura/sobre\nPara ajuda, use “Fale com o Criador” no site.\n\nFeito com amor. Pronto para ganhar vida nas suas mãos.\nDiego Lira · Tio Lira`};
}

async function sources(){
 const [p,l]=await Promise.all([readRecord('maker-license-purchases.json'),readRecord('maker-subscriptions.json')]);
 return [...(p?.data?.purchases||[]).filter(current).map(r=>({...r,source:'purchase'})),...(l?.data?.subscriptions||[]).filter(current).map(r=>({...r,source:'legacy'}))];
}
function active(rows,memberId,now){
 const periods=rows.filter(r=>r.memberId===memberId).flatMap(r=>r.source==='legacy'?(r.periods||[]).filter(p=>!p.revoked).map(p=>({...p,status:'paid'})):[r]);
 return purchaseValidity(periods,now);
}
function sourceActive(row,now){return row.source==='legacy'?purchaseValidity((row.periods||[]).filter(p=>!p.revoked).map(p=>({...p,status:'paid'})),now).active:row.status==='paid'&&Date.parse(row.startsAt)<=now&&Date.parse(row.endsAt)>now;}
async function discover(rows,now){
 const candidates=rows.filter(r=>r.welcomeRequestedAt&&sourceActive(r,now));if(!candidates.length)return;
 await updateRecord(KEY,d=>{d=state(d);for(const r of candidates){const id=jobId(r);d.jobs[id]||={id,memberId:r.memberId,environment:r.environment,sourceId:r.id,source:r.source,status:'pending',at:r.welcomeRequestedAt,version:VERSION,attempts:0};}return d;});
}
export async function runSubscriberWelcomeEmails(now=Date.now()){
 if(!allowed())return {sent:0};
 let rows=await sources();await discover(rows,now);
 const config=purchaseEmailConfig();if(!config)return {sent:0};
 const jobs=Object.values(state((await readRecord(KEY))?.data).jobs).filter(j=>['pending','failed','sending'].includes(j.status)&&!(j.leaseUntil>now)).slice(0,2);
 let sent=0;
 for(const candidate of jobs){
  rows=await sources();const row=rows.find(r=>r.id===candidate.sourceId&&r.source===candidate.source&&r.memberId===candidate.memberId&&r.environment===candidate.environment);
  const member=(await readRecord('club-members.json'))?.data?.members?.find(m=>m.id===candidate.memberId);
  const validity=active(rows,candidate.memberId,now);
  const suppression=member?.email?(await readRecord('email-suppressions.json'))?.data?.[createHash('sha256').update(member.email.trim().toLowerCase()).digest('hex')]:null;
  if(!row||!sourceActive(row,now)||!validity.active||!member?.email||suppression){await updateRecord(KEY,d=>{const j=d.jobs[candidate.id];if(j.status!=='sent'&&!(j.leaseUntil>now)){j.status='cancelled';j.reason=suppression?'Endereço com restrição de entrega.':'Assinatura ou cadastro não disponível.';}return d;});continue;}
  const owner=randomUUID();
  const claimed=await updateRecord(KEY,d=>{
   const j=d.jobs[candidate.id];if(!['pending','failed','sending'].includes(j.status)||j.leaseUntil>now)return d;
   if(j.firstAttemptAt&&now-Date.parse(j.firstAttemptAt)>=23*3600000){j.status='review';j.reason='Confira no Resend antes de repetir: prazo de repetição segura encerrado.';return d;}
   if(j.payload&&j.payload.to[0]!==member.email){j.status='review';j.reason='E-mail do cadastro mudou após tentativa; conferir entrega antes de reenviar.';return d;}
   j.payload||={from:config.from,to:[member.email],...subscriberWelcomeMessage(member,validity.validUntil,config.origin)};
   j.firstAttemptAt||=new Date(now).toISOString();j.attempts++;j.status='sending';j.owner=owner;j.leaseUntil=now+60000;j.lastAttemptAt=new Date(now).toISOString();return d;
  });
  const job=claimed.jobs[candidate.id];if(job.owner!==owner||job.status!=='sending')continue;
  try{
   const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${config.key}`,'Content-Type':'application/json','Idempotency-Key':`subscriber-welcome/${job.id}`},body:JSON.stringify(job.payload),signal:AbortSignal.timeout(8000)});
   if(!response.ok)throw Error('delivery');const result=await response.json();if(typeof result.id!=='string'||!result.id)throw Error('delivery');
   await updateRecord(KEY,d=>{const j=d.jobs[job.id];if(j.owner===owner){j.status='sent';j.providerId=result.id;j.sentAt=new Date().toISOString();delete j.reason;delete j.leaseUntil;}return d;});sent++;
  }catch{await updateRecord(KEY,d=>{const j=d.jobs[job.id];if(j.owner===owner&&j.status!=='sent'){j.status='failed';j.reason='Envio não confirmado; próxima tentativa conserva a mensagem e a chave.';delete j.leaseUntil;}return d;});}
  if(jobs.length>1)await delay(600);
 }
 return {sent};
}
export async function subscriberWelcomeReport(){
 const data=state((await readRecord(KEY))?.data);
 const jobs=await Promise.all(Object.values(data.jobs).filter(j=>j.environment===asaasConfig().environment||j.environment===paypalConfig().environment).map(async j=>({id:j.id,memberId:j.memberId,status:j.status,at:j.at,sentAt:j.sentAt||null,attempts:j.attempts,reason:j.reason||null,providerId:j.providerId||null,delivery:j.providerId?(await readRecord(`email-events/${j.providerId}.json`))?.data?.events||{}:{}})));
 return {enabled:true,configured:!!purchaseEmailConfig(),intervalMinutes:5,retroactive:false,version:VERSION,jobs,summary:{sent:jobs.filter(j=>j.status==='sent').length,pending:jobs.filter(j=>['pending','sending','failed'].includes(j.status)).length,review:jobs.filter(j=>j.status==='review').length,delivered:jobs.filter(j=>j.delivery.delivered).length,opened:jobs.filter(j=>j.delivery.opened).length}};
}
export async function attachSubscriberWelcome(report){
 const welcome=await subscriberWelcomeReport();
 for(const r of report.subscriptions)for(const j of welcome.jobs.filter(j=>j.memberId===r.memberId))r.notices.push({...j,purpose:'welcome',channel:'email'});
 report.welcomeEmail={enabled:welcome.enabled,configured:welcome.configured,summary:welcome.summary};return report;
}
