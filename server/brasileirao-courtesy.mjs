import {attachDeliveryReport,deliveryTrackingStatus} from './email-delivery-events.mjs';
import {createHash} from 'node:crypto';
import {getCatalog,readRecord,updateRecord} from './store.mjs';
import {currentOrderEnvironment} from './payment-environment.mjs';
import {purchaseEmailLanguage} from './purchase-email-i18n.mjs';
import {purchaseEmailConfig} from './purchase-email.mjs';
import {productFiles} from '../lib/print-profiles.mjs';
import {COURTESY_CODE,brasileiraoCourtesyEmail} from './brasileirao-courtesy-email.mjs';
export {COURTESY_CODE};
export const COURTESY_ID='brasileirao-face-update-2026-11';
export const SOURCE_COLLECTION='noeis-brasileirao';
const KEY='commerce.json',slot='brasileiraoCourtesy';
const fail=(m,status=400)=>{throw Object.assign(Error(m),{status});};
export const isCourtesyCode=code=>String(code||'').trim().toUpperCase()===COURTESY_CODE;
const validPurchase=o=>o.status==='paid'&&o.totalCents>0&&currentOrderEnvironment(o);
export function courtesyRecipients(orders,members,data,cutoff){
 const products=new Set(data.products.filter(p=>p.collection===SOURCE_COLLECTION).map(p=>p.id));
 const purchases=orders.filter(o=>validPurchase(o)&&(!o.createdAt||o.createdAt<=cutoff)&&((o.productIds||[]).some(id=>products.has(id))||(o.items||[]).some(i=>i.collection===SOURCE_COLLECTION||i.kind==='collection'&&i.id===SOURCE_COLLECTION)));
 const groups=new Map();
 for(const m of members){
  const owned=purchases.filter(o=>o.memberId===m.id);if(!owned.length)continue;
  const email=m.email?.trim().toLowerCase();if(!email||!/^\S+@\S+\.\S+$/.test(email))continue;
  const latest=owned.toSorted((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''))[0];
  const recipient=groups.get(email)||{id:createHash('sha256').update(COURTESY_ID+':'+email).digest('hex'),memberIds:[],orderIds:[],email,name:m.name,language:purchaseEmailLanguage({...m,lang:latest.lang||m.lang,countryCode:m.countryCode||latest.countryCode}),status:'draft'};
  recipient.memberIds.push(m.id);recipient.orderIds.push(...owned.map(o=>o.id));groups.set(email,recipient);
 }
 return [...groups.values()];
}
export function courtesyQuote(quote,{campaign,orders,memberId}={}){
 if(!campaign?.coupon?.active||campaign.id!==COURTESY_ID)fail('Esta cortesia aguarda a conclusão da atualização dos arquivos.',409);
 const recipient=campaign.recipients.find(r=>r.memberIds.includes(memberId));
 if(!recipient||!orders.some(o=>recipient.orderIds.includes(o.id)&&o.memberId===memberId&&validPurchase(o)))fail('Este cupom é exclusivo dos compradores contemplados da coleção Brasileirão.',403);
 if(orders.some(o=>o.courtesy?.campaignId===COURTESY_ID&&o.courtesy.recipientId===recipient.id&&currentOrderEnvironment(o)))fail('Você já utilizou esta cortesia. Consulte a obra em Meus pedidos.',409);
 if(quote.items.length!==1||quote.items[0].kind!=='product'||(quote.items[0].quantity||1)!==1)fail('Para usar a cortesia, deixe somente uma obra individual no carrinho. Pacotes completos não participam.');
 const subtotalCents=quote.totalCents;
 return {...quote,subtotalCents,totalCents:0,discountCents:subtotalCents,couponDiscountCents:subtotalCents,promotion:null,natalPromotion:null,coupon:{id:COURTESY_ID,code:COURTESY_CODE,type:'courtesy',value:100},courtesy:{campaignId:COURTESY_ID,recipientId:recipient.id},items:quote.items.map(i=>({...i,discountCents:i.priceCents,totalCents:0}))};
}
export async function prepareBrasileiraoCourtesy(){
 const [{data},members]=await Promise.all([getCatalog(),readRecord('club-members.json')]);
 if(!data.collections.some(c=>c.id===SOURCE_COLLECTION))fail('Coleção Brasileirão não encontrada.');
 const now=new Date().toISOString();
 await updateRecord(KEY,old=>{
  const s=old||{orders:[],downloads:{},recentDownloads:[]};
  if(s[slot]&&s[slot].status!=='awaiting_files')fail('Esta campanha já foi liberada. O rascunho não pode ser recriado.',409);
  const cutoff=s[slot]?.cutoff||now;
  s[slot]={id:COURTESY_ID,collectionId:SOURCE_COLLECTION,createdAt:s[slot]?.createdAt||now,updatedAt:now,cutoff,status:'awaiting_files',coupon:{code:COURTESY_CODE,active:false,usesPerCustomer:1,individualOnly:true},recipients:courtesyRecipients(s.orders,members?.data?.members||[],data,cutoff)};
  return s;
 });
 return adminBrasileiraoCourtesy();
}
export async function adminBrasileiraoCourtesy(){
 const state=(await readRecord(KEY))?.data;
 const campaign=await attachDeliveryReport(state?.[slot]||null,state?.orders||[]);
 const origin=purchaseEmailConfig()?.origin||'https://www.tiolira.com.br';
 return {campaign,tracking:await deliveryTrackingStatus(),previews:Object.fromEntries(['pt','en','es','fr'].map(l=>[l,brasileiraoCourtesyEmail(l,origin)]))};
}
// Explicit admin release is required. Preparing a draft never queues an email.
export async function releaseBrasileiraoCourtesy(input){
 if(input.confirmation!=='ARQUIVOS ATUALIZADOS; LIBERAR E ENVIAR')fail('Confirme a conclusão dos arquivos e o envio.');
 const [{data},members]=await Promise.all([getCatalog(),readRecord('club-members.json')]);
 const collection=data.collections.find(c=>c.id===SOURCE_COLLECTION);
 if(!collection?.published||collection.comingSoon)fail('Conclua a atualização e retire a coleção de Em preparação antes de enviar.',409);
 if(!purchaseEmailConfig())fail('Configure o serviço de e-mail antes de liberar.',503);
 await updateRecord(KEY,old=>{
  const campaign=old?.[slot];if(!campaign)fail('Prepare primeiro o rascunho.');
  if(campaign.status!=='awaiting_files')return old;
  const recipients=courtesyRecipients(old.orders,members?.data?.members||[],data,campaign.cutoff);
  if(!recipients.length)fail('Nenhum comprador elegível para envio.');
  const affected=new Set(old.orders.filter(o=>recipients.some(r=>r.orderIds.includes(o.id))).flatMap(o=>o.productIds||[]));
  const files=data.products.filter(p=>p.collection===SOURCE_COLLECTION&&affected.has(p.id));
  if(!files.length||files.some(p=>!productFiles(p).length))fail('Há obras compradas sem arquivos disponíveis.');
  const releasedAt=new Date().toISOString();
  Object.assign(campaign,{status:'sending',releasedAt,files:files.map(p=>({id:p.id,profiles:productFiles(p).map(f=>({id:f.id,filePath:f.filePath}))})),recipients:recipients.map(r=>({...r,status:'pending'})),coupon:{...campaign.coupon,active:true}});return old;
 });
 return adminBrasileiraoCourtesy();
}
export async function runBrasileiraoCourtesyEmails(now=Date.now()){
 if(process.env.VERCEL&&process.env.VERCEL_ENV!=='production')return {sent:0};
 const current=(await readRecord(KEY))?.data?.[slot];
 if(current?.status!=='sending'||!current.releasedAt||!current.coupon.active)return {sent:0};
 const config=purchaseEmailConfig();if(!config)return {sent:0};
 const [{data},members]=await Promise.all([getCatalog(),readRecord('club-members.json')]);
 if(data.collections.find(c=>c.id===SOURCE_COLLECTION)?.comingSoon)return {sent:0};
 let sent=0;
 for(const job of current.recipients.filter(r=>['pending','failed'].includes(r.status)).slice(0,2)){
  const state=await updateRecord(KEY,old=>{
   const c=old?.[slot],j=c?.recipients.find(r=>r.id===job.id);if(c?.status!=='sending'||!j||!['pending','failed'].includes(j.status))return old;
   const eligible=courtesyRecipients(old.orders,members?.data?.members||[],data,c.cutoff).find(r=>r.id===j.id);
   if(!eligible){j.status='cancelled';return old;}
   if(j.firstAttemptAt&&now-Date.parse(j.firstAttemptAt)>=23*3600000){j.status='review';return old;}
   j.payload||={from:config.from,to:[j.email],...brasileiraoCourtesyEmail(j.language,config.origin)};j.firstAttemptAt||=new Date(now).toISOString();j.attempts=(j.attempts||0)+1;return old;
  });
  const j=state[slot].recipients.find(r=>r.id===job.id);if(!['pending','failed'].includes(j.status))continue;
  try{
   const res=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${config.key}`,'Content-Type':'application/json','Idempotency-Key':`${COURTESY_ID}/${j.id}`},body:JSON.stringify(j.payload),signal:AbortSignal.timeout(8000)});
   if(!res.ok)throw Error('delivery');const result=await res.json();if(!result.id)throw Error('delivery');
   await updateRecord(KEY,old=>{Object.assign(old[slot].recipients.find(r=>r.id===j.id),{status:'sent',providerId:result.id,sentAt:new Date().toISOString()});return old;});sent++;
  }catch{await updateRecord(KEY,old=>{const target=old[slot].recipients.find(r=>r.id===j.id);if(target.status!=='sent')target.status='failed';return old;});}
 }
 await updateRecord(KEY,old=>{const c=old[slot];if(c.recipients.every(r=>['sent','cancelled'].includes(r.status)))c.status='complete';return old;});
 return {sent};
}
