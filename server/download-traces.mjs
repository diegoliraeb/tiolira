import {createHmac,randomBytes,randomUUID,timingSafeEqual} from 'node:crypto';
import {readRecord,writeRecord,updateRecord} from './store.mjs';

const key=id=>`download-traces/${id}.json`;
const payload=t=>JSON.stringify({schema:t.schema,id:t.id,source_sha256:t.source_sha256});
const sign=(t,secret)=>createHmac('sha256',Buffer.from(secret,'hex')).update(payload(t)).digest('hex');
export function newTrace(sourceHash){
 const secret=randomBytes(32).toString('hex');
 const trace={schema:1,id:'TL3MF-'+randomUUID().replaceAll('-',''),source_sha256:sourceHash};
 trace.hmac_sha256=sign(trace,secret);return {trace,secret};
}
export async function registerTrace({trace,secret,member,product,file,bytes}){
 // One private record per delivery avoids growing a shared counter/document.
 await writeRecord(key(trace.id),{trace,secret,createdAt:new Date().toISOString(),status:'prepared',bytes,
  member:{id:member.id,name:member.name||'',email:member.email||'',whatsapp:member.whatsapp||member.phone||''},
  product:{id:product.id,name:product.name,collection:product.collection},profile:{id:file.id,name:file.name},sourcePath:file.filePath},null);
}
export async function finishTrace(id,status){await updateRecord(key(id),record=>{if(!record)throw new Error('Registro de entrega ausente.');return {...record,status,finishedAt:new Date().toISOString()};});}
export async function lookupTrace(input){
 const trace=input?.trace;
 if(!trace||trace.schema!==1||!/^TL3MF-[a-f0-9]{32}$/.test(trace.id)||!/^[a-f0-9]{64}$/.test(trace.source_sha256)||!/^[a-f0-9]{64}$/.test(trace.hmac_sha256))return {status:'invalid',message:'Código inválido ou de um teste antigo. Nenhum cadastro foi associado.'};
 const record=(await readRecord(key(trace.id)))?.data;
 if(!record)return {status:'unknown',message:'Código não encontrado nos registros deste site.'};
 const expected=sign(trace,record.secret);
 if(!timingSafeEqual(Buffer.from(expected,'hex'),Buffer.from(trace.hmac_sha256,'hex'))||record.trace.source_sha256!==trace.source_sha256)return {status:'invalid',message:'A assinatura do código não confere. Nenhum cadastro foi associado.'};
 const members=(await readRecord('club-members.json'))?.data?.members||[],current=members.find(m=>m.id===record.member.id);
 return {status:'found',code:trace.id,createdAt:record.createdAt,deliveryStatus:record.status,product:record.product,profile:record.profile,
  member:{...record.member,...(current?{name:current.name||record.member.name,email:current.email||record.member.email,whatsapp:current.whatsapp||current.phone||record.member.whatsapp}:{})}};
}
