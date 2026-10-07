import {partnerInstagram} from '../lib/instagram.mjs';
import {encodeLogo,saveLogo} from './store-logo.mjs';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {applicationSchema} from './schema.mjs';
import {normalizeStoreLocation} from './geography.mjs';
import {getCatalog,updateRecord,readRecord} from './store.mjs';
import {partnerEmail} from './partners.mjs';

const fields=['name','countryCode','stateId','stateCode','cityId','region','city','state','country','whatsapp','website','instagram','description','delivery','serviceArea','partnershipConsent'];
const pick=source=>Object.fromEntries(fields.filter(key=>source[key]!==undefined).map(key=>[key,source[key]]));
const listing=(member,data)=>data.stores.find(s=>(member.storeId&&s.id===member.storeId)||partnerEmail(s.email)===partnerEmail(member.email));
export function partnerProfile(member,data){
 const store=listing(member,data);
 const profile={...pick(member),...pick(store||{}),...(member.profilePending||{}),id:member.id,email:member.email,createdAt:member.createdAt,logo:member.profilePending?.logo??store?.logo??member.directoryProfile?.logo??''};
 return {...profile,instagram:partnerInstagram(profile)};
}
const profileSchema=applicationSchema.omit({email:true,consent:true,productIds:true,honeypot:true,password:true,directoryConsent:true}).extend({
 removeLogo:z.boolean().default(false),
 countryCode:z.string().regex(/^[A-Z]{2}$/),stateId:z.string().min(1).max(30),cityId:z.string().min(1).max(30)
});
// A pending profile survives a partial write, so a later save or login can finish syncing it.
export async function syncPartnerProfile(member){
 if(!member.profilePending)return member;
 let pending=member.profilePending;const {data}=await getCatalog();
 if(listing(member,data))await updateRecord('catalog.json',async old=>{
  pending=(await readRecord('club-members.json'))?.data?.members.find(m=>m.id===member.id)?.profilePending;
  const store=listing(member,old||data);if(store&&pending)Object.assign(store,pending);
  return old||data;
 });
 const updated=await updateRecord('club-members.json',old=>{
  const current=old?.members.find(m=>m.id===member.id);
  if(current&&JSON.stringify(current.profilePending)===JSON.stringify(pending))delete current.profilePending;
  return old;
 });
 return updated.members.find(m=>m.id===member.id);
}
export async function updatePartnerProfile(member,input){
 const parsed=profileSchema.parse(input);
 const profile=pick(await normalizeStoreLocation(parsed));
 if(parsed.removeLogo)profile.logo='';
 else if(parsed.logoData)profile.logo=await saveLogo(randomUUID(),await encodeLogo(parsed.logoData));
 const updated=await updateRecord('club-members.json',old=>{
  const current=old?.members.find(m=>m.id===member.id&&m.version===member.version);
  if(!current)throw Object.assign(new Error('Entre novamente na sua conta.'),{status:401});
  Object.assign(current,profile,{profilePending:profile});
  if(Object.hasOwn(profile,'logo'))current.directoryProfile={...current.directoryProfile,logo:profile.logo};
  return old;
 });
 return syncPartnerProfile(updated.members.find(m=>m.id===member.id));
}
