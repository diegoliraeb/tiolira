import {passwordResetEmail} from './club-email.mjs';
import {partnerProfile,syncPartnerProfile} from './partner-profile.mjs';
import {partnerForRecovery,ensurePartnerListing} from './partners.mjs';
import {createHash,randomBytes,randomUUID} from 'node:crypto';
import {z} from 'zod';
import {getCatalog,readRecord,updateRecord} from './store.mjs';
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
  canLicense:p.collection==='presepio'||p.allowPhysicalSales===true||data.collections.some(c=>c.id===p.collection&&c.free)
 }));
}
export const licenseTerms='Autorizada a impressão e venda das peças físicas desta obra pelo parceiro identificado. Esta licença é pessoal e intransferível. Não autoriza revender, compartilhar ou redistribuir os arquivos digitais.';
export async function issueLicense(member,product){
 const record=await updateRecord(`club-licenses/${member.id}.json`,old=>{
  const licenses=old?.licenses||[];
  if(licenses.some(item=>item.productId===product.id))return old;
  return {...old,licenses:[...licenses,{code:`TL-${randomUUID().toUpperCase()}`,memberId:member.id,partnerName:member.name,productId:product.id,productName:product.name,issuedAt:new Date().toISOString(),terms:licenseTerms,productTerms:product.license||''}]};
 });
 return record.licenses.find(item=>item.productId===product.id);
}
export const collectionLicenseTerms='Autorizada a impressão e venda das peças físicas disponibilizadas gratuitamente nesta coleção pelo parceiro identificado. Esta licença é pessoal e intransferível. Não autoriza revender, compartilhar ou redistribuir os arquivos digitais.';
export async function ensureCollectionLicenses(member,data){
 const collections=data.collections.filter(c=>c.published&&c.free).sort((a,b)=>(a.id==='presepio'?-1:0)-(b.id==='presepio'?-1:0));
 const key=`club-licenses/${member.id}.json`,current=(await readRecord(key))?.data||{};
 if(collections.every(c=>current.collectionLicenses?.some(l=>l.collectionId===c.id)))return current;
 return updateRecord(key,old=>{
  const collectionLicenses=[...(old?.collectionLicenses||[])];
  for(const collection of collections)if(!collectionLicenses.some(l=>l.collectionId===collection.id))collectionLicenses.push({kind:'collection',code:`TL-COL-${randomUUID().toUpperCase()}`,memberId:member.id,partnerName:member.name,collectionId:collection.id,collectionName:collection.name,issuedAt:new Date().toISOString(),terms:collectionLicenseTerms});
  return {...old,collectionLicenses};
 });
}
export async function clubDashboard(member,data){
 if(member.profilePending){member=await syncPartnerProfile(member);data=(await getCatalog()).data;}
 const [licenses,coupons]=await Promise.all([ensureCollectionLicenses(member,data),readRecord('partner-coupons.json')]);
 return {member:partnerProfile(member,data),collections:data.collections.filter(c=>c.published),network:await ensurePartnerListing(member),downloads:clubProducts(data),licenses:licenses.licenses||[],collectionLicenses:licenses.collectionLicenses||[],coupons:(coupons?.data?.coupons||[]).filter(c=>c.active&&(!c.expiresAt||Date.parse(c.expiresAt)>Date.now()))};
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
 const lang=['pt','en','es'].includes(input.lang)?input.lang:'pt';
 // A fragment keeps the token out of request logs and Referer headers.
 const link=`${config.origin}/${lang}/clube#reset=${token}`;
 try{
  const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${config.key}`,'Content-Type':'application/json'},body:JSON.stringify({from:config.from,to:[email],...passwordResetEmail({name:member.name,lang,origin:config.origin,link})}),signal:AbortSignal.timeout(15_000)});
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
