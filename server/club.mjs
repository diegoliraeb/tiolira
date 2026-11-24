import {membershipSummary} from '../lib/club-library.mjs';
import {canDownloadProduct} from '../lib/subscriber-access.mjs';
import {commercialPolicy,commercialEntitlement} from '../lib/maker-license.mjs';
import {subscriptionDashboard} from './maker-subscriptions.mjs';
import {PRINT_REWARDS_KEY} from './print-rewards-access.mjs';
import {complimentaryAccess as collectionAccess} from './print-rewards-access.mjs';
import {hasProductFiles,publicPrintProfiles} from '../lib/print-profiles.mjs';
import {productPrintEstimate} from '../lib/print-estimates.mjs';
import {internationalBuyer,marketCatalog} from '../lib/international-pricing.mjs';
import {memberAccessIds,isPaidProduct,memberLicenses,canPurchaseProduct} from './commerce.mjs';
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
export function clubProducts(data,owned=new Set(),annual=false,legacy=new Set()){
 const collections=new Set(data.collections.filter(c=>c.published).map(c=>c.id));
 return data.products.filter(p=>p.published&&collections.has(p.collection)&&['site','maker','paid','subscribers'].includes(p.access)&&isAvailable(p)&&(!isPaidProduct(p)||owned.has(p.id)||!data.collections.some(c=>c.id===p.collection&&c.comingSoon))).map(({filePath,fileProfile,printProfiles,...p})=>({
  ...p,printEstimate:productPrintEstimate({...p,filePath}),canPurchase:!owned.has(p.id)&&canPurchaseProduct({...p,filePath,printProfiles},data,annual),downloadUrl:canDownloadProduct(p,{owned:owned.has(p.id),annual})&&hasProductFiles({filePath,printProfiles})?`/api/download?id=${encodeURIComponent(p.id)}`:p.access==='subscribers'?'':p.access==='maker'?p.url:!isPaidProduct(p)?p.url:'',
  printProfiles:publicPrintProfiles({...p,filePath,fileProfile,printProfiles},canDownloadProduct(p,{owned:owned.has(p.id),annual})),
  commercialPolicy:commercialPolicy(p,data.collections),licenseSource:commercialEntitlement(p,{owned:owned.has(p.id),legacy:legacy.has(p.id),annual,collections:data.collections}),canLicense:Boolean(commercialEntitlement(p,{owned:owned.has(p.id),legacy:legacy.has(p.id),annual,collections:data.collections}))
 }));
}
export const licenseTerms='Autorizada a impressão e venda das peças físicas desta obra pelo parceiro identificado. Esta licença é pessoal e intransferível. Não autoriza revender, compartilhar ou redistribuir os arquivos digitais.';
export async function issueLicense(member,product,collections=[]){
 if(commercialPolicy(product,collections)!=='free')throw Object.assign(Error('Licença gratuita indisponível para esta obra.'),{status:403});
 const record=await updateRecord(`club-licenses/${member.id}.json`,old=>{
  const licenses=old?.licenses||[];
  if(licenses.some(item=>item.productId===product.id))return old;
  return {...old,licenses:[...licenses,{code:`TL-${randomUUID().toUpperCase()}`,memberId:member.id,partnerName:member.name,productId:product.id,productName:product.name,issuedAt:new Date().toISOString(),terms:licenseTerms,productTerms:product.license||''}]};
 });
 return record.licenses.find(item=>item.productId===product.id);
}
export const collectionLicenseTerms='Autorizada a impressão e venda das peças físicas disponibilizadas gratuitamente nesta coleção pelo parceiro identificado. Esta licença é pessoal e intransferível. Não autoriza revender, compartilhar ou redistribuir os arquivos digitais.';
export async function ensureCollectionLicenses(member,data){
 const key=`club-licenses/${member.id}.json`,current=(await readRecord(key))?.data||{};
 const update=old=>{const next=structuredClone(old||{});next.collectionLicenses||=[];
 for(const license of next.collectionLicenses)if(!license.productIds){const ids=data.migrations?.makerLegacyProducts?.[license.collectionId];license.productIds=data.products.filter(p=>(ids?ids.includes(p.id):p.collection===license.collectionId&&p.published)&&commercialPolicy(p,data.collections)!=='noncommercial').map(p=>p.id);}
 for(const c of data.collections.filter(c=>c.published&&c.free)){
  const ids=data.products.filter(p=>p.collection===c.id&&p.published&&commercialPolicy(p,data.collections)==='free').map(p=>p.id);
  if(ids.length&&!next.collectionLicenses.some(l=>l.collectionId===c.id))next.collectionLicenses.push({kind:'collection',code:`TL-COL-${randomUUID().toUpperCase()}`,memberId:member.id,partnerName:member.name,collectionId:c.id,collectionName:c.name,issuedAt:new Date().toISOString(),terms:'Autorizada a impressão e venda das peças físicas das obras expressamente incluídas nesta licença. Não inclui obras de licença anual nem Ayrton Senna. Proibida a redistribuição dos arquivos digitais.',productIds:ids});
 }return next;};
 const next=update(current);if(JSON.stringify(next)===JSON.stringify(current))return current;return updateRecord(key,update);
}
export async function clubDashboard(member,data){
 if(member.profilePending){member=await syncPartnerProfile(member);data=(await getCatalog()).data;}
 const [owned,granted,rewards]=await Promise.all([memberAccessIds(member),collectionAccess(member,data),readRecord(PRINT_REWARDS_KEY)]);
 const rewardCollections=new Set(rewards?.data?.config?.enabled?rewards.data.config.collectionIds:[]);
 const [licenses,coupons,purchases,subscription]=await Promise.all([ensureCollectionLicenses(member,data),readRecord('partner-coupons.json'),memberLicenses(member),subscriptionDashboard(member)]);
 const legacy=new Set([...(licenses.licenses||[]).map(l=>l.productId),...(licenses.collectionLicenses||[]).flatMap(l=>l.productIds||[])]);
 return {member:partnerProfile(member,data),subscription:membershipSummary(subscription),collections:data.collections.filter(c=>c.published).map(c=>({...c,printRewardEligible:rewardCollections.has(c.id),...(granted.collectionIds.has(c.id)?{complimentary:true,priceCents:0,priceUsdCents:0}:{})})),network:await ensurePartnerListing(member),downloads:clubProducts(marketCatalog(data,internationalBuyer(member)?'USD':'BRL'),owned,subscription.active,legacy).map(p=>granted.productIds.has(p.id)?{...p,complimentary:true,priceCents:0,priceUsdCents:0}:p),licenses:[...(licenses.licenses||[]).filter(l=>!data.products.some(p=>p.id===l.productId&&isPaidProduct(p))),...purchases],collectionLicenses:licenses.collectionLicenses||[],coupons:(coupons?.data?.coupons||[]).filter(c=>c.active&&(!c.expiresAt||Date.parse(c.expiresAt)>Date.now()))};
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
 const lang=['pt','en','es','fr'].includes(input.lang)?input.lang:'pt';
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
  member.hash=hash;member.version=randomUUID();delete member.passwordReset;delete member.temporaryPassword;
  return old;
 });
}
