import {partnerForRecovery,ensurePartnerListing} from './partners.mjs';
import {createHash,randomBytes,randomUUID} from 'node:crypto';
import {z} from 'zod';
import {readRecord,updateRecord} from './store.mjs';
import {passwordHash} from './auth.mjs';
import {isAvailable} from '../lib/product-order.mjs';

const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
const digest=value=>createHash('sha256').update(value).digest('hex');
export function publicClubMember(member){
 const {id,name,email,city,state,country,createdAt}=member;
 return {id,name,email,city,state,country,createdAt};
}
export function clubProducts(data){
 const collections=new Set(data.collections.filter(c=>c.published).map(c=>c.id));
 return data.products.filter(p=>p.published&&collections.has(p.collection)&&['site','maker'].includes(p.access)&&isAvailable(p)).map(({filePath,...p})=>({
  ...p,downloadUrl:p.access==='site'&&filePath&&!p.exclusive?`/api/download?id=${encodeURIComponent(p.id)}`:p.url,
  canLicense:p.collection==='presepio'||p.allowPhysicalSales===true
 }));
}
export const licenseTerms='Autorizada a impressão e venda das peças físicas desta obra pelo parceiro identificado. Esta licença é pessoal e intransferível. Não autoriza revender, compartilhar ou redistribuir os arquivos digitais.';
export async function issueLicense(member,product){
 const record=await updateRecord(`club-licenses/${member.id}.json`,old=>{
  const licenses=old?.licenses||[];
  if(licenses.some(item=>item.productId===product.id))return old;
  return {licenses:[...licenses,{code:`TL-${randomUUID().toUpperCase()}`,memberId:member.id,partnerName:member.name,productId:product.id,productName:product.name,issuedAt:new Date().toISOString(),terms:licenseTerms,productTerms:product.license||''}]};
 });
 return record.licenses.find(item=>item.productId===product.id);
}
export async function clubDashboard(member,data){
 const [licenses,coupons]=await Promise.all([readRecord(`club-licenses/${member.id}.json`),readRecord('partner-coupons.json')]);
 return {member:publicClubMember(member),network:await ensurePartnerListing(member),downloads:clubProducts(data),licenses:licenses?.data?.licenses||[],coupons:(coupons?.data?.coupons||[]).filter(c=>c.active&&(!c.expiresAt||Date.parse(c.expiresAt)>Date.now()))};
}
export const couponSchema=z.object({
 id:z.string().uuid(),supplier:z.string().trim().min(1).max(150),code:z.string().trim().min(1).max(100),
 description:z.string().trim().min(1).max(1000),url:z.url().max(1800).refine(value=>{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password},'Use um link HTTPS válido.'),
 expiresAt:z.iso.datetime().or(z.literal('')).default(''),active:z.boolean()
});

function emailConfig(){
 const {RESEND_API_KEY,EMAIL_FROM,SITE_URL}=process.env;
 let origin;try{const url=new URL(SITE_URL);if(url.protocol==='https:'&&!url.username&&!url.password)origin=url.origin;}catch{}
 if(!RESEND_API_KEY||!EMAIL_FROM||!origin)fail('A recuperação de senha por e-mail ainda não está disponível. Entre em contato com o Tio Lira.',503);
 return {key:RESEND_API_KEY,from:EMAIL_FROM,origin};
}
const resetCopy={
 pt:['Redefina sua senha — Clube Tio Lira','Recebemos um pedido para alterar sua senha. Abra o link abaixo em até 30 minutos. Ele pode ser usado uma única vez.','Se você não fez esse pedido, ignore este e-mail.'],
 en:['Reset your password — Tio Lira Club','We received a password reset request. Open the link below within 30 minutes. It can only be used once.','If you did not request this, ignore this email.'],
 es:['Restablece tu contraseña — Club Tio Lira','Recibimos una solicitud para cambiar tu contraseña. Abre el enlace en un plazo de 30 minutos. Solo se puede usar una vez.','Si no hiciste esta solicitud, ignora este correo.']
};
export async function requestPasswordReset(input){
 const email=z.email().max(254).parse(input.email).trim().toLowerCase();
 const config=emailConfig();
 const member=await partnerForRecovery(email);
 if(!member)return;
 const token=randomBytes(32).toString('hex'),tokenHash=digest(token),now=Date.now();
 const updated=await updateRecord('club-members.json',old=>{
  const current=old?.members.find(m=>m.id===member.id);
  if(!current||current.version!==member.version)fail('Tente novamente em alguns instantes.',409);
  if(current.passwordReset?.createdAt>now-60_000)return old;
  current.passwordReset={hash:tokenHash,expiresAt:now+30*60_000,createdAt:now};
  return old;
 });
 if(updated.members.find(m=>m.id===member.id)?.passwordReset?.hash!==tokenHash)return;
 const lang=Object.hasOwn(resetCopy,input.lang)?input.lang:'pt',copy=resetCopy[lang];
 // A fragment keeps the token out of request logs and Referer headers.
 const link=`${config.origin}/${lang}/clube#reset=${token}`;
 try{
  const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${config.key}`,'Content-Type':'application/json'},body:JSON.stringify({from:config.from,to:[email],subject:copy[0],text:`${copy[1]}\n\n${link}\n\n${copy[2]}`}),signal:AbortSignal.timeout(15_000)});
  if(!response.ok)throw Error('delivery');
 }catch{
  await updateRecord('club-members.json',old=>{const current=old?.members.find(m=>m.id===member.id);if(current?.passwordReset?.hash===tokenHash)delete current.passwordReset;return old;});
  fail('Não foi possível enviar o e-mail agora. Tente novamente em alguns instantes.',503);
 }
}
export async function resetPassword(input){
 const {token,password}=z.object({token:z.string().regex(/^[a-f0-9]{64}$/),password:z.string().min(12,'Use uma senha de pelo menos 12 caracteres.').max(200)}).parse(input);
 const tokenHash=digest(token),hash=await passwordHash(password);
 await updateRecord('club-members.json',old=>{
  const member=old?.members?.find(m=>m.passwordReset?.hash===tokenHash&&m.passwordReset.expiresAt>Date.now());
  if(!member)fail('Este link é inválido ou expirou. Solicite um novo e-mail.');
  member.hash=hash;member.version=randomUUID();delete member.passwordReset;
  return old;
 });
}
