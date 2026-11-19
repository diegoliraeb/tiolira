import {paypalConfig} from './paypal.mjs';
import {randomUUID} from 'node:crypto';
import {asaas,asaasConfig,invoiceUrl} from './asaas.mjs';
import {readRecord,updateRecord} from './store.mjs';
import {MAKER_PRICE,yearAfter} from '../lib/maker-license.mjs';
import {purchaseValidity} from '../lib/maker-purchases.mjs';
const KEY='maker-license-purchases.json',enc=encodeURIComponent;
const fail=(m,s=409)=>{throw Object.assign(Error(m),{status:s})};
const current=r=>r.provider==='asaas'&&r.environment===asaasConfig().environment;
export const annualOpen=r=>r.annual===true&&!['cancelled','failed'].includes(r.annualState);
export const annualRoot=rows=>rows.filter(annualOpen).at(-1);
export function annualPublic(r){return r?{id:r.id,state:r.annualState,subscriptionId:r.subscriptionId||null,billingType:r.billingType,nextDueDate:r.nextDueDate||null,firstDueDate:r.firstDueDate,migrated:!!r.migrationSourceId,autoRenew:r.billingType==='CREDIT_CARD',cancelledAt:r.cancelledAt||null}:null;}
async function rootRow(id){const r=(await readRecord(KEY))?.data?.purchases?.find(r=>r.id===id&&current(r)&&r.annual);if(!r)fail('Assinatura anual não encontrada.',404);return r;}
const ref=r=>`tl-maker-annual:${r.id}`;
function validate(s,r){if(!/^sub_[\w-]+$/.test(s.id||'')||s.externalReference!==ref(r)||s.customer!==r.customerId||s.billingType!==r.billingType||s.cycle!=='YEARLY'||Math.round(Number(s.value)*100)!==MAKER_PRICE||r.subscriptionId&&s.id!==r.subscriptionId)fail('Assinatura anual não corresponde ao cadastro.');}
async function list(path){const all=[];for(let offset=0;offset<10000;offset+=100){const p=await asaas(`${path}${path.includes('?')?'&':'?'}limit=100&offset=${offset}`);if(!Array.isArray(p.data))fail('Lista de cobranças não confirmada.',502);all.push(...p.data);if(!p.hasMore)return all;}fail('Lista extensa: conferência necessária.');}
// Ceil to midnight in Brasília: the renewal must never precede the paid expiry instant.
export function renewalDate(expiry){const t=Date.parse(expiry);if(!Number.isFinite(t))fail('Validade inválida.');return new Date(Math.ceil((t-3*3600000)/86400000)*86400000+3*3600000).toISOString().slice(0,10);}
async function bind(r,s){validate(s,r);await updateRecord(KEY,d=>{const row=d.purchases.find(x=>x.id===r.id);validate(s,row);row.subscriptionId=s.id;row.nextDueDate=s.nextDueDate||row.firstDueDate;if(s.deleted||s.status==='INACTIVE'){row.annualState='cancelled';row.cancelledAt||=new Date().toISOString();}else if(row.annualState!=='cancelled')row.annualState='active';row.checkedAt=new Date().toISOString();return d;});}
export async function createAnnual(id){
 const r=await rootRow(id);if(r.subscriptionId)return syncAnnual(id);
 // This function is called only by the request which won the durable creation claim.
 // No retries after an ambiguous POST: recovery only searches the immutable reference.
 try{
  const customerSubs=await list(`/subscriptions?customer=${enc(r.customerId)}&includeDeleted=true`);
  if(customerSubs.some(s=>!s.deleted&&s.status!=='INACTIVE'&&(String(s.externalReference||'').startsWith('tl-maker')||s.cycle==='YEARLY'&&Math.round(Number(s.value)*100)===MAKER_PRICE)))fail('Já existe uma assinatura deste cliente no Asaas. Confira antes de criar outra.');
  await updateRecord(KEY,d=>{const row=d.purchases.find(x=>x.id===id);if(row.createAttemptAt)fail('Criação já iniciada. Atualize para conferir.');row.createAttemptAt=new Date().toISOString();return d});
  const remote=await asaas('/subscriptions',{method:'POST',body:{customer:r.customerId,billingType:r.billingType,value:MAKER_PRICE/100,nextDueDate:r.firstDueDate,cycle:'YEARLY',description:'Assinatura anual Tio Lira — Licença comercial Site / MakerWorld',externalReference:ref(r),...(r.billingType==='PIX'?{pixAutomaticAuthorizationMode:'DISABLED'}:{}),...(r.callback?{callback:{successUrl:r.callback,autoRedirect:true}}:{})}});
  await bind(r,remote);await syncAnnual(id);
 }catch(e){await updateRecord(KEY,d=>{const row=d.purchases.find(x=>x.id===id);if(!row.subscriptionId){row.annualState=e.uncertain===false?'failed':'review';row.status=row.annualState==='failed'?'failed':'review';}return d});throw e;}
}
export async function applyAnnualPayment(id,p){return updateRecord(KEY,d=>{
 const root=d?.purchases.find(r=>r.id===id&&current(r)&&r.annual);
 if(!root||!root.subscriptionId||!/^pay_[\w-]+$/.test(p.id||'')||p.subscription!==root.subscriptionId||p.customer!==root.customerId||p.billingType!==root.billingType||!/^\d{4}-\d{2}-\d{2}$/.test(p.dueDate||'')||p.dueDate<root.firstDueDate)fail('Cobrança não corresponde à assinatura anual.');
 const revoked=['REFUNDED','REFUND_REQUESTED','REFUND_IN_PROGRESS','CHARGEBACK_REQUESTED','CHARGEBACK_DISPUTE','AWAITING_CHARGEBACK_REVERSAL'].includes(p.status)||(p.refunds||[]).some(x=>x.status!=='CANCELLED');
 let row=d.purchases.find(x=>current(x)&&x.paymentId===p.id);
 if(row&&row.id!==root.id&&row.subscriptionRootId!==root.id)fail('Cobrança já vinculada a outro registro.');
 if(Math.round(Number(p.value)*100)!==MAKER_PRICE&&!(revoked&&row?.paymentId===p.id))fail('Valor da assinatura não corresponde à licença.');
 if(!row){
  if(!root.migrationSourceId&&!root.paymentId&&p.dueDate===root.firstDueDate)row=root;
  else {row={id:randomUUID(),memberId:root.memberId,name:root.name,email:root.email,whatsapp:root.whatsapp,countryCode:root.countryCode,provider:'asaas',environment:root.environment,billingType:root.billingType,currency:'BRL',totalCents:MAKER_PRICE,createdAt:new Date().toISOString(),lang:root.lang,terms:root.terms,termsVersion:root.termsVersion,consentedAt:root.consentedAt,subscriptionRootId:root.id,subscriptionId:root.subscriptionId,customerId:root.customerId};d.purchases.push(row);}
 }
 let status=revoked?'revoked':['CONFIRMED','RECEIVED'].includes(p.status)?'paid':p.deleted?'cancelled':['REPROVED_BY_RISK_ANALYSIS','CREDIT_CARD_CAPTURE_REFUSED'].includes(p.status)?'failed':p.status==='OVERDUE'?'overdue':'pending';
 if(row.status==='revoked')status='revoked';else if(row.status==='paid'&&!revoked)status='paid';
 row.paymentId=p.id;row.paymentUrl=invoiceUrl(p.invoiceUrl);row.dueDate=p.dueDate;row.status=status;row.checkedAt=new Date().toISOString();
 if(status==='paid'&&!row.startsAt){
  if(d.purchases.some(x=>x.id!==row.id&&x.subscriptionId===root.subscriptionId&&x.dueDate===p.dueDate&&x.status==='paid'))fail('Outro pagamento deste ciclo já foi confirmado. Conferência necessária.');
  const paymentDate=p.clientPaymentDate||p.paymentDate||p.confirmedDate;
  if(!paymentDate||!Number.isFinite(Date.parse(paymentDate)))fail('Pagamento sem data confirmada.');
  row.paidAt=new Date(paymentDate.length===10?`${paymentDate}T03:00:00Z`:paymentDate).toISOString();
  const due=Date.parse(`${p.dueDate}T03:00:00Z`),paid=Date.parse(row.paidAt);
  const others=d.purchases.filter(x=>x.id!==row.id&&x.memberId===root.memberId&&x.status==='paid'&&x.endsAt&&Date.parse(x.startsAt)<=Math.max(due,paid));
  const end=Math.max(0,...others.map(x=>Date.parse(x.endsAt)));
  // Preserve previously paid time. Never grant another year for a replayed payment ID.
  row.startsAt=new Date(end>paid?end:row.id===root.id?paid:Math.max(due,paid)).toISOString();row.endsAt=yearAfter(row.startsAt);
 }
 return d;
});}
export async function syncAnnual(id){
 let r=await rootRow(id),remote;
 if(r.subscriptionId){remote=await asaas(`/subscriptions/${enc(r.subscriptionId)}`);}
 else {const found=await list(`/subscriptions?externalReference=${enc(ref(r))}&includeDeleted=true`);if(found.length>1)fail('Mais de uma assinatura encontrada. Conferência necessária.');if(!found.length)return;remote=found[0];}
 await bind(r,remote);r=await rootRow(id);
 const payments=await list(`/subscriptions/${enc(r.subscriptionId)}/payments`);
 for(const p of payments.sort((a,b)=>(a.dueDate||'').localeCompare(b.dueDate||'')||(a.id||'').localeCompare(b.id||'')))await applyAnnualPayment(id,p);
 const pending=payments.filter(p=>!p.deleted&&['PENDING','OVERDUE','AWAITING_RISK_ANALYSIS'].includes(p.status)).map(p=>p.dueDate).sort()[0];
 const paidDue=payments.filter(p=>!p.deleted&&['RECEIVED','CONFIRMED'].includes(p.status)).map(p=>p.dueDate).sort().at(-1);
 const next=pending||[remote.nextDueDate,paidDue?yearAfter(paidDue+'T03:00:00Z').slice(0,10):r.firstDueDate].filter(Boolean).sort().at(-1);
 if(next)await updateRecord(KEY,d=>{d.purchases.find(x=>x.id===id).nextDueDate=next;return d;});
 if(r.annualState==='cancelled')await updateRecord(KEY,d=>{for(const x of d.purchases.filter(x=>x.id===id||x.subscriptionRootId===id))if(['creating','pending','overdue','review','scheduled'].includes(x.status))x.status='cancelled';return d;});
}
export async function annualEvent(e){const rows=(await readRecord(KEY))?.data?.purchases||[],s=e.subscription||{},p=e.payment||{};const r=rows.find(x=>current(x)&&x.annual&&(x.subscriptionId&&[s.id,p.subscription].includes(x.subscriptionId)||s.externalReference===ref(x)||p.externalReference===ref(x)));if(!r)return false;await syncAnnual(r.id);return true;}
export async function cancelAnnual(id,memberId){let r=await rootRow(id);if(r.memberId!==memberId)fail('Assinatura não encontrada.',404);await syncAnnual(id);r=await rootRow(id);if(!r.subscriptionId)fail('Aguarde a confirmação da criação antes de cancelar.');if(r.annualState!=='cancelled'){const result=await asaas(`/subscriptions/${enc(r.subscriptionId)}`,{method:'DELETE'});if(result.deleted!==true)fail('Cancelamento não confirmado.',502);await updateRecord(KEY,d=>{const x=d.purchases.find(x=>x.id===id);x.annualState='cancelled';x.cancelledAt=new Date().toISOString();for(const p of d.purchases.filter(p=>p.id===id||p.subscriptionRootId===id))if(['creating','pending','overdue','review','scheduled'].includes(p.status))p.status='cancelled';return d;});}}
function migrationCandidate(rows,memberId,legacy){const own=rows.filter(x=>x.memberId===memberId&&current(x)),all=rows.filter(x=>x.memberId===memberId&&x.environment===(x.provider==='paypal'?paypalConfig().environment:asaasConfig().environment)),v=purchaseValidity(all),seed=own.filter(x=>x.status==='paid'&&x.endsAt).sort((a,b)=>a.endsAt.localeCompare(b.endsAt)).at(-1),existing=annualRoot(own);
 if(existing)return {memberId,eligible:false,reason:'Assinatura anual já cadastrada',annual:annualPublic(existing)};
 if(own.some(x=>x.annual))return {memberId,eligible:false,reason:'Assinatura anterior encerrada; preservar o cancelamento'};
 if(!seed||!v.active)return {memberId,eligible:false,reason:'Sem licença Asaas paga e ativa'};
 if(legacy.some(x=>x.memberId===memberId&&!['failed','expired','cancelled'].includes(x.status)))return {memberId,eligible:false,reason:'Assinatura anterior exige conferência'};
 if(all.some(x=>['creating','pending','overdue','review'].includes(x.status)))return {memberId,eligible:false,reason:'Existe cobrança pendente; confira antes de agendar'};
 if(!seed.customerId||!seed.paymentId)return {memberId,eligible:false,reason:'Pagamento sem identificador do Asaas'};
 return {memberId,name:seed.name,eligible:true,seedId:seed.id,validUntil:v.validUntil,firstDueDate:renewalDate(v.validUntil),billingType:'PIX'};
}
export async function annualMigrationPreview(){const rows=(await readRecord(KEY))?.data?.purchases||[],legacy=(await readRecord('maker-subscriptions.json'))?.data?.subscriptions?.filter(x=>x.environment===asaasConfig().environment)||[];return {candidates:[...new Set(rows.filter(current).map(x=>x.memberId))].map(id=>migrationCandidate(rows,id,legacy))};}
export async function migrateAnnual(memberId){
 const rows=(await readRecord(KEY))?.data?.purchases||[],existing=annualRoot(rows.filter(x=>current(x)&&x.memberId===memberId));if(existing){await syncAnnual(existing.id);return {annual:annualPublic(await rootRow(existing.id)),alreadyScheduled:true};}
 const legacy=(await readRecord('maker-subscriptions.json'))?.data?.subscriptions?.filter(x=>x.environment===asaasConfig().environment)||[];
 const candidate=migrationCandidate(rows,memberId,legacy);if(!candidate.eligible)fail(candidate.reason);
 const seed=rows.find(x=>x.id===candidate.seedId),p=await asaas(`/payments/${enc(seed.paymentId)}`);
 if(p.id!==seed.paymentId||p.customer!==seed.customerId||p.billingType!==seed.billingType||p.externalReference!==`tl-maker-purchase:${seed.id}`||Math.round(Number(p.value)*100)!==MAKER_PRICE||!['RECEIVED','CONFIRMED'].includes(p.status)||p.deleted||(p.refunds||[]).some(x=>x.status!=='CANCELLED')||p.subscription)fail('Pagamento anterior precisa de conferência; nenhuma cobrança criada.');
 const id=randomUUID();await updateRecord(KEY,d=>{const c=migrationCandidate(d.purchases,memberId,legacy);if(!c.eligible||c.validUntil!==candidate.validUntil||c.seedId!==seed.id)fail('Os pagamentos mudaram. Atualize antes de agendar.');d.purchases.push({id,memberId,name:seed.name,email:seed.email,whatsapp:seed.whatsapp,countryCode:seed.countryCode,lang:seed.lang||'pt',provider:'asaas',environment:asaasConfig().environment,currency:'BRL',totalCents:MAKER_PRICE,billingType:'PIX',customerId:seed.customerId,createdAt:new Date().toISOString(),status:'scheduled',annual:true,annualState:'creating',firstDueDate:c.firstDueDate,nextDueDate:c.firstDueDate,migrationSourceId:seed.id,paidThrough:c.validUntil,terms:seed.terms,termsVersion:seed.termsVersion,migrationPolicy:'annual-pix-no-automatic-debit'});return d;});
 await createAnnual(id);return {annual:annualPublic(await rootRow(id)),alreadyScheduled:false};
}
