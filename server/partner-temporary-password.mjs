import {randomBytes,randomUUID} from 'node:crypto';
import {getCatalog,updateRecord} from './store.mjs';
import {passwordHash,verifyPassword} from './auth.mjs';
import {partnerForRecovery,partnerEmail} from './partners.mjs';
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
export async function generateTemporaryPassword(admin,input){
 const {data}=await getCatalog(),store=data.stores.find(s=>s.id===input.storeId);
 if(!store)fail('Salve o cadastro do parceiro antes de gerar a senha.',404);
 if(!store.email||partnerEmail(input.email)!==partnerEmail(store.email))fail('O e-mail mudou. Salve e reabra o cadastro antes de gerar a senha.',409);
 const member=await partnerForRecovery(partnerEmail(store.email));
 if(!member)fail('Conta do parceiro não encontrada.',404);
 const password='TL-'+randomBytes(15).toString('base64url'),hash=await passwordHash(password),expiresAt=Date.now()+24*3600_000;
 await updateRecord('club-members.json',old=>{
  const current=old?.members?.find(m=>m.id===member.id&&m.version===member.version&&partnerEmail(m.email)===partnerEmail(store.email));
  if(!current)fail('O cadastro mudou. Reabra o parceiro e tente novamente.',409);
  current.hash=hash;current.version=randomUUID();current.temporaryPassword={expiresAt,createdAt:Date.now(),createdBy:admin.email,usedAt:null};delete current.passwordReset;
  old.passwordSupportAudit=[...(old.passwordSupportAudit||[]),{action:'temporary-password-issued',memberId:current.id,adminEmail:admin.email,at:new Date().toISOString(),expiresAt}].slice(-2000);
  return old;
 });
 return {email:member.email,name:member.name,password,expiresAt:new Date(expiresAt).toISOString()};
}
export async function consumeTemporaryPassword(member){
 const next=await updateRecord('club-members.json',old=>{
  const current=old?.members?.find(m=>m.id===member.id&&m.version===member.version);
  if(!current||!current.temporaryPassword||current.temporaryPassword.usedAt||current.temporaryPassword.expiresAt<=Date.now())fail('Senha temporária inválida ou expirada. Solicite uma nova.',401);
  current.temporaryPassword.usedAt=Date.now();current.version=randomUUID();return old;
 });
 return next.members.find(m=>m.id===member.id);
}
export async function replaceTemporaryPassword(member,input){
 const password=input.password;
 if(typeof password!=='string'||password.length<12||password.length>200)fail('Use uma nova senha de 12 a 200 caracteres.');
 if(password!==input.confirmPassword)fail('As senhas não coincidem.');
 if(await verifyPassword(password,member.hash))fail('Escolha uma senha diferente da temporária.');
 const hash=await passwordHash(password);
 const next=await updateRecord('club-members.json',old=>{
  const current=old?.members?.find(m=>m.id===member.id&&m.version===member.version);
  if(!current?.temporaryPassword?.usedAt||current.temporaryPassword.expiresAt<=Date.now())fail('Este acesso expirou. Solicite uma nova senha temporária.',401);
  current.hash=hash;current.version=randomUUID();delete current.temporaryPassword;delete current.passwordReset;
  old.passwordSupportAudit=[...(old.passwordSupportAudit||[]),{action:'temporary-password-replaced',memberId:current.id,at:new Date().toISOString()}].slice(-2000);return old;
 });
 return next.members.find(m=>m.id===member.id);
}
