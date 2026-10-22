import {createHash} from 'node:crypto';
import {readRecord,updateRecord} from './store.mjs';
import {downloadPartners} from './download-history.mjs';
import {currentOrderEnvironment} from './payment-environment.mjs';
import {purchaseEmailConfig} from './purchase-email.mjs';
import {purchaseEmailLanguage} from './purchase-email-i18n.mjs';
import {auditProductFile} from './file-audit.mjs';
import {productFiles} from '../lib/print-profiles.mjs';
const KEY='product-update-emails.json';
const fail=m=>{throw Error(m);};
const state=s=>({campaigns:{},jobs:{},...s});
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const sameUpdateFiles=(a,b)=>JSON.stringify(a.map(f=>[f.id,f.filePath]))===JSON.stringify(b.map(f=>[f.id,f.filePath]));
const productId='916d4c3f-cf6b-4f0e-8ca1-0f7ecb9b7cdf';
const copy={
 pt:{subject:'O Beijo de Maria ganhou uma atualização ✨',hello:'Olá!',body:'Fiz um ajuste no rosto do Menino Jesus na obra O Beijo de Maria. A versão atualizada já está disponível no site.',instruction:'Antes da próxima impressão, entre na Área do Parceiro e baixe novamente o arquivo da obra para usar a nova versão.',thanks:'Obrigado por dar vida às minhas criações!',cta:'Baixar versão atualizada'},
 es:{subject:'O Beijo de Maria tiene una actualización ✨',hello:'¡Hola!',body:'He ajustado el rostro del Niño Jesús en la obra O Beijo de Maria. La versión actualizada ya está disponible en el sitio.',instruction:'Antes de tu próxima impresión, entra en el Área de Socios y descarga de nuevo el archivo de la obra para utilizar la nueva versión.',thanks:'¡Gracias por dar vida a mis creaciones!',cta:'Descargar versión actualizada'},
 en:{subject:'O Beijo de Maria has been updated ✨',hello:'Hello!',body:'I have refined the face of Baby Jesus in O Beijo de Maria. The updated version is now available on the website.',instruction:'Before your next print, sign in to the Partner Area and download the artwork file again to use the new version.',thanks:'Thank you for bringing my creations to life!',cta:'Download updated version'},
 fr:{subject:'O Beijo de Maria a été mis à jour ✨',hello:'Bonjour !',body:'J’ai retouché le visage de l’Enfant Jésus dans l’œuvre O Beijo de Maria. La version mise à jour est disponible sur le site.',instruction:'Avant votre prochaine impression, connectez-vous à l’Espace Partenaire et téléchargez à nouveau le fichier de l’œuvre pour utiliser la nouvelle version.',thanks:'Merci de donner vie à mes créations !',cta:'Télécharger la nouvelle version'}
};
export function updateEmail(language,origin){
 const c=copy[language];if(!c)fail('Idioma inválido.');const url=new URL(origin);if(url.protocol!=='https:')fail('Endereço inválido.');const link=`${url.origin}/${language}/clube#colecoes`;
 return {subject:c.subject,text:`${c.hello}\n\n${c.body}\n\n${c.instruction}\n\n${c.cta}: ${link}\n\n${c.thanks}\nTio Lira`,html:`<!doctype html><html lang="${language}"><meta charset="utf-8"><body style="margin:0;background:#f4f0e5;font-family:Arial,sans-serif;color:#303c2b"><div style="max-width:560px;margin:28px auto;padding:32px;background:#fffaf1;border-radius:22px"><img src="${esc(url.origin)}/assets/tl-monogram-3d-icon.png" width="64" height="64" alt="Tio Lira"><h1 style="font-size:28px">${esc(c.subject)}</h1><p>${c.hello}</p><p style="line-height:1.7">${c.body}</p><p style="line-height:1.7">${c.instruction}</p><p style="margin:30px 0"><a href="${esc(link)}" style="display:inline-block;padding:17px 24px;background:#404934;color:white;text-decoration:none;border-radius:30px;font-weight:bold">${c.cta} →</a></p><p>${c.thanks}<br><strong>Tio Lira</strong></p></div></body></html>`};
}
export function updateRecipients(commerce,members,product){
 const orders=(commerce.orders||[]).filter(o=>o.status==='paid'&&currentOrderEnvironment(o)&&(o.productIds||[]).includes(product.id));
 const paidIds=new Set(orders.map(o=>o.memberId));const ids=new Set([...paidIds,...downloadPartners(commerce).filter(d=>d.productId===product.id).map(d=>d.memberId)]);
 const seen=new Set();return members.filter(m=>ids.has(m.id)&&(product.access!=='paid'||paidIds.has(m.id))).flatMap(m=>{const email=m.email?.trim().toLowerCase();if(!email||!/^\S+@\S+\.\S+$/.test(email)||seen.has(email))return [];seen.add(email);const order=orders.filter(o=>o.memberId===m.id).sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''))[0];return [{memberId:m.id,email,language:purchaseEmailLanguage({...m,lang:order?.lang||m.lang,countryCode:m.countryCode||order?.countryCode})}];});
}
export async function queueBeijoUpdate(campaignId){
 if(!/^[a-z0-9-]{10,100}$/.test(campaignId))fail('Campanha inválida.');
 const [c,m,p]=await Promise.all([readRecord('commerce.json'),readRecord('club-members.json'),readRecord('catalog.json')]);const product=p.data.products.find(p=>p.id===productId&&p.published);
 if(!product||!productFiles(product).length)fail('Arquivo indisponível.');const recipients=updateRecipients(c.data,m.data.members,product);
 await updateRecord(KEY,old=>{const s=state(old);if(s.campaigns[campaignId])return s;s.campaigns[campaignId]={id:campaignId,productId,createdAt:new Date().toISOString(),approvedText:'beijo-face-v1',files:productFiles(product),status:'pending',recipientCount:recipients.length};for(const r of recipients){const id=createHash('sha256').update(campaignId+':'+r.email).digest('hex');s.jobs[id]={...r,id,campaignId,status:'pending',attempts:0};}return s;});
 return {campaignId,recipients:recipients.length};
}
export async function runProductUpdateEmails(now=Date.now()){
 if(process.env.VERCEL&&process.env.VERCEL_ENV!=='production')return {sent:0};const config=purchaseEmailConfig();if(!config)return {sent:0};
 const s=state((await readRecord(KEY))?.data);let sent=0;
 for(const campaign of Object.values(s.campaigns).filter(c=>['pending','sending'].includes(c.status)).slice(0,1)){
  const [catalog,commerce,members]=await Promise.all([readRecord('catalog.json'),readRecord('commerce.json'),readRecord('club-members.json')]);const product=catalog.data.products.find(p=>p.id===campaign.productId&&p.published);
  if(!product||!sameUpdateFiles(productFiles(product),campaign.files))continue;
  if(!campaign.fileAudit){try{const audits=[];for(const file of campaign.files)audits.push(await auditProductFile({...product,filePath:file.filePath}));await updateRecord(KEY,old=>{old.campaigns[campaign.id].fileAudit=audits;return old;});}catch{await updateRecord(KEY,old=>{old.campaigns[campaign.id].status='review';old.campaigns[campaign.id].error='Arquivo precisa de revisão; avisos não enviados.';return old;});continue;}}
  const eligible=updateRecipients(commerce.data,members.data.members,product);
  for(const job of Object.values(s.jobs).filter(j=>j.campaignId===campaign.id&&['pending','failed'].includes(j.status)).slice(0,2)){
   if(!eligible.some(r=>r.memberId===job.memberId&&r.email===job.email)){await updateRecord(KEY,old=>{old.jobs[job.id].status='cancelled';return old;});continue;}
   const record=await updateRecord(KEY,old=>{const j=old.jobs[job.id];if(!['pending','failed'].includes(j.status))return old;if(j.firstAttemptAt&&now-Date.parse(j.firstAttemptAt)>=23*3600000){j.status='review';return old;}j.payload||={from:config.from,to:[j.email],...updateEmail(j.language,config.origin)};j.firstAttemptAt||=new Date(now).toISOString();j.attempts++;return old;});
   const j=record.jobs[job.id];if(!['pending','failed'].includes(j.status))continue;
   try{const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${config.key}`,'Content-Type':'application/json','Idempotency-Key':`product-update/${j.id}`},body:JSON.stringify(j.payload),signal:AbortSignal.timeout(8000)});if(!response.ok)throw Error('delivery');const r=await response.json();if(!r.id)throw Error('delivery');await updateRecord(KEY,old=>{Object.assign(old.jobs[j.id],{status:'sent',providerId:r.id,sentAt:new Date().toISOString()});return old;});sent++;}catch{await updateRecord(KEY,old=>{if(old.jobs[j.id].status!=='sent')old.jobs[j.id].status='failed';return old;});}
  }
  await updateRecord(KEY,old=>{if(Object.values(old.jobs).filter(j=>j.campaignId===campaign.id).every(j=>['sent','cancelled'].includes(j.status)))old.campaigns[campaign.id].status='complete';return old;});
 }
 return {sent};
}
