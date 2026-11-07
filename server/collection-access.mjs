import {createHash,randomUUID} from 'node:crypto';
import {z} from 'zod';
import {getCatalog,readRecord,writeRecord,Conflict} from './store.mjs';
import {hasProductFiles} from '../lib/print-profiles.mjs';

const KEY='partner-collection-access.json';
const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
const productEligible=(p,catalog)=>p.published&&!p.exclusive&&['site','paid'].includes(p.access)&&hasProductFiles(p)&&catalog.collections.some(c=>c.id===p.collection&&c.published&&!c.comingSoon);
const memberView=m=>({id:m.id,name:m.name,email:m.email});
export const courtesyTerms='Autorizada a impressão e venda das peças físicas desta obra pelo parceiro identificado, enquanto a liberação gratuita concedida pelo Tio Lira estiver ativa. Licença pessoal e intransferível. Não autoriza revender, compartilhar ou redistribuir os arquivos digitais. Respeite também as condições específicas da obra.';

export async function collectionAccess(member,catalog){
 const data=catalog||(await getCatalog()).data;
 const grants=((await readRecord(KEY))?.data?.grants||[]).filter(g=>g.memberId===member.id&&g.active);
 const collectionIds=new Set(grants.filter(g=>data.collections.some(c=>c.id===g.collectionId&&c.published&&!c.comingSoon)).map(g=>g.collectionId));
 const products=data.products.filter(p=>collectionIds.has(p.collection)&&productEligible(p,data));
 const licenses=products.map(p=>{
  const g=grants.find(g=>g.collectionId===p.collection);
  return {source:'courtesy',code:`TL-CORTESIA-${g.id.toUpperCase()}-${createHash('sha256').update(p.id).digest('hex').slice(0,12).toUpperCase()}`,grantId:g.id,collectionId:g.collectionId,memberId:member.id,partnerName:member.name,productId:p.id,productName:p.name,issuedAt:g.grantedAt,status:'active',terms:courtesyTerms,productTerms:p.license||''};
 });
 return {collectionIds,productIds:new Set(products.map(p=>p.id)),licenses};
}

export async function adminCollectionAccess({query='',memberId=''}={}){
 const [{data},record,membersRecord]=await Promise.all([getCatalog(),readRecord(KEY),readRecord('club-members.json')]);
 const all=membersRecord?.data?.members||[],needle=String(query).trim().slice(0,200).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const matches=all.filter(m=>(m.name+' '+m.email).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(needle)).sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
 const member=memberId?all.find(m=>m.id===memberId):null;
 if(memberId&&!member)fail('Parceiro não encontrado.',404);
 const collections=data.collections.filter(c=>c.published&&!c.comingSoon).map(c=>({id:c.id,name:c.name,free:c.free,productCount:data.products.filter(p=>p.collection===c.id&&productEligible(p,data)).length})).filter(c=>c.productCount>0);
 return {members:matches.slice(0,50).map(memberView),total:matches.length,member:member?memberView(member):null,collections,grants:member?(record?.data?.grants||[]).filter(g=>g.memberId===member.id).map(g=>({...g,collectionName:data.collections.find(c=>c.id===g.collectionId)?.name||g.collectionId})).sort((a,b)=>b.grantedAt.localeCompare(a.grantedAt)):[],revision:record?.etag||null};
}

export async function saveCollectionAccess(admin,input){
 const parsed=z.object({memberId:z.string().uuid(),collectionId:z.string().regex(/^[a-z0-9][a-z0-9-]{0,99}$/),active:z.boolean(),revision:z.string().max(500).nullable()}).parse(input);
 const [{data},record,members]=await Promise.all([getCatalog(),readRecord(KEY),readRecord('club-members.json')]);
 if((record?.etag||null)!==parsed.revision)throw new Conflict();
 if(!members?.data?.members?.some(m=>m.id===parsed.memberId))fail('Parceiro não encontrado.',404);
 const grants=structuredClone(record?.data?.grants||[]),existing=grants.find(g=>g.memberId===parsed.memberId&&g.collectionId===parsed.collectionId&&g.active);
 if(parsed.active){
  const collection=data.collections.find(c=>c.id===parsed.collectionId&&c.published&&!c.comingSoon);
  if(!collection||!data.products.some(p=>p.collection===collection.id&&productEligible(p,data)))fail('Escolha uma coleção publicada com arquivos disponíveis no site.');
  if(collection.free)fail('Esta coleção já é gratuita para todos os parceiros.');
  if(existing)return {ok:true};
  grants.push({id:randomUUID(),memberId:parsed.memberId,collectionId:parsed.collectionId,active:true,grantedAt:new Date().toISOString(),grantedBy:admin.email});
 }else{
  if(!existing)return {ok:true};
  existing.active=false;existing.revokedAt=new Date().toISOString();existing.revokedBy=admin.email;
 }
 await writeRecord(KEY,{grants},record?.etag);return {ok:true};
}
