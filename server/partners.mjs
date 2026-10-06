import {randomUUID} from 'node:crypto';
import {getCatalog,readRecord,updateRecord} from './store.mjs';
import {passwordHash} from './auth.mjs';
import {storeSchema} from './schema.mjs';

export const partnerEmail=value=>String(value||'').trim().toLowerCase();
const duplicate=()=>{throw Object.assign(new Error('Este e-mail já tem um cadastro de parceiro. Use “Definir ou recuperar senha” para acessar o Clube.'),{status:409,code:'PARTNER_EXISTS'});};
const profileKeys=['name','email','countryCode','stateId','stateCode','cityId','region','city','state','country','whatsapp','website','instagram','description','delivery','serviceArea','partnershipConsent'];
const profileOf=source=>Object.fromEntries(profileKeys.filter(k=>source[k]!==undefined).map(k=>[k,source[k]]));
const listingOf=(member,data)=>data.stores.find(s=>(member.storeId&&s.id===member.storeId)||partnerEmail(s.email)===partnerEmail(member.email));

function partnerListing(member){
 const result=storeSchema.safeParse({...profileOf(member),...member.directoryProfile,email:member.email,id:member.id,status:'pending',consent:true,createdAt:member.createdAt});
 if(!result.success)throw Object.assign(new Error('Seu perfil está incompleto. Entre em contato com o Tio Lira para atualizar seus dados comerciais.'),{status:400});
 return result.data;
}

// The catalog contains only a public business profile. Credentials stay in the account record.
export async function ensurePartnerListing(member){
 const {data}=await getCatalog();
 let listing=listingOf(member,data);
 if(!listing&&member.directoryConsent&&data.settings.storesOpen){
  const entry=partnerListing(member);
  const updated=await updateRecord('catalog.json',old=>{
   const current=old||data;
   if(current.settings.storesOpen&&!listingOf(member,current))current.stores.push(entry);
   return current;
  });
  listing=listingOf(member,updated);
 }
 return listing?{status:listing.status}:null;
}

export async function registerPartner(profile,{password,directoryConsent=false,directoryProfile}={}){
 const email=partnerEmail(profile.email),{data}=await getCatalog();
 if(data.stores.some(s=>partnerEmail(s.email)===email))duplicate();
 if(directoryConsent&&!data.settings.storesOpen)throw Object.assign(new Error('Os cadastros estão temporariamente fechados.'),{status:409});
 const member={...profileOf(profile),email,id:randomUUID(),version:randomUUID(),createdAt:new Date().toISOString(),hash:password?await passwordHash(password):null,directoryConsent,...(directoryProfile?{directoryProfile}: {})};
 await updateRecord('club-members.json',old=>{
  const members=old?.members||[];
  if(members.some(m=>partnerEmail(m.email)===email))duplicate();
  return {...old,members:[...members,member]};
 });
 // If the second write fails, the persisted consent/profile lets the next login retry safely.
 await ensurePartnerListing(member);
 return member;
}

export async function partnerForRecovery(email){
 const existing=(await readRecord('club-members.json'))?.data?.members?.find(m=>partnerEmail(m.email)===email);
 if(existing)return existing;
 const {data}=await getCatalog(),store=data.stores.find(s=>partnerEmail(s.email)===email);
 if(!store)return null;
 // Legacy partners must prove email ownership before choosing their first password.
 const member={...profileOf(store),email,id:randomUUID(),version:randomUUID(),createdAt:new Date().toISOString(),hash:null,storeId:store.id};
 const result=await updateRecord('club-members.json',old=>{
  const members=old?.members||[];
  if(members.some(m=>partnerEmail(m.email)===email))return old;
  return {...old,members:[...members,member]};
 });
 return result.members.find(m=>partnerEmail(m.email)===email);
}

export async function joinPartnerNetwork(member){
 const {data}=await getCatalog();
 if(!listingOf(member,data)){
  if(!data.settings.storesOpen)throw Object.assign(new Error('Os cadastros estão temporariamente fechados.'),{status:409});
  partnerListing(member);
 }
 const updated=await updateRecord('club-members.json',old=>{
  const current=old?.members?.find(m=>m.id===member.id&&m.version===member.version);
  if(!current)throw Object.assign(new Error('Entre novamente na sua conta.'),{status:401});
  current.directoryConsent=true;return old;
 });
 return ensurePartnerListing(updated.members.find(m=>m.id===member.id));
}
