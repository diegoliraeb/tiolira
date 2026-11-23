import {z} from 'zod';
import {readRecord,getCatalog} from './store.mjs';
import {memberLicenses} from './commerce.mjs';
import {clubProducts,issueLicense} from './club.mjs';
import {subscriptionDashboard,annualLicense} from './maker-subscriptions.mjs';
const fail=(message,status=403)=>{throw Object.assign(Error(message),{status})};
async function rights(member){
 const [catalog,purchases,stored,subscription]=await Promise.all([getCatalog(),memberLicenses(member),readRecord(`club-licenses/${member.id}.json`),subscriptionDashboard(member)]);
 const documents=stored?.data||{},owned=new Set(purchases.filter(l=>l.status==='active').map(l=>l.productId));
 const legacy=new Set([...(documents.licenses||[]).map(l=>l.productId),...(documents.collectionLicenses||[]).flatMap(l=>l.productIds||[])]);
 return {data:catalog.data,purchases,documents,subscription,products:clubProducts(catalog.data,owned,subscription.active,legacy)};
}
export async function issueProductCommercialLicense(member,productId){
 const state=await rights(member),product=state.products.find(p=>p.id===productId);
 if(!product?.canLicense)fail('Licença comercial indisponível para esta obra e este cadastro.');
 if(product.licenseSource==='purchase')return state.purchases.find(l=>l.productId===product.id&&l.status==='active');
 if(product.licenseSource==='legacy')return state.documents.licenses?.find(l=>l.productId===product.id)||state.documents.collectionLicenses?.find(l=>l.productIds?.includes(product.id));
 if(product.licenseSource==='annual')return annualLicense(member);
 if(product.licenseSource==='free')return issueLicense(member,product,state.data.collections);
 fail('Licença comercial indisponível.');
}
export async function adminCommercialRights(memberId){
 z.string().uuid().parse(memberId);
 const member=(await readRecord('club-members.json'))?.data?.members?.find(m=>m.id===memberId);if(!member)fail('Cadastro não encontrado.',404);
 const {products,purchases,documents,subscription}=await rights(member);
 const certificates=documents.annualCertificates||[];
 return {member:{id:member.id,name:member.name,email:member.email},active:subscription.active,validUntil:subscription.validUntil,products:products.map(p=>{
  const license=p.licenseSource==='purchase'?purchases.find(l=>l.productId===p.id&&l.status==='active'):p.licenseSource==='annual'?certificates.findLast(l=>l.validUntil===subscription.validUntil&&l.productIds?.includes(p.id)):documents.licenses?.find(l=>l.productId===p.id)||documents.collectionLicenses?.find(l=>l.productIds?.includes(p.id));
  return {id:p.id,name:p.name,source:p.licenseSource,canLicense:p.canLicense,download:p.downloadUrl||p.printProfiles?.some(p=>p.downloadUrl)?p.access==='maker'?'makerworld':'site':'purchase',personalOnly:p.commercialPolicy==='noncommercial',validUntil:p.licenseSource==='annual'?subscription.validUntil:null,code:license?.code||null};
 }),certificates:certificates.map(l=>({code:l.code,issuedAt:l.issuedAt,validUntil:l.validUntil,termsVersion:l.termsVersion,productCount:l.productIds?.length||0}))};
}
