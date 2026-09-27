import seed from '../data/catalog.json' with { type: 'json' };
import { get, put, BlobPreconditionFailedError } from '@vercel/blob';
import { readFile, writeFile, mkdir, rename, rm } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { randomUUID } from 'node:crypto';

export class Conflict extends Error { constructor(){super('Os dados mudaram. Recarregue antes de salvar.');this.status=409;} }
export function configured(){return Boolean(process.env.BLOB_READ_WRITE_TOKEN || (!process.env.VERCEL && process.env.LOCAL_DATA_DIR));}
const local=()=>!process.env.VERCEL && process.env.LOCAL_DATA_DIR;
const diskPath=key=>resolve(process.env.LOCAL_DATA_DIR,key);
export async function readRecord(key){
 if(local()){try{return JSON.parse(await readFile(diskPath(key),'utf8'));}catch(e){if(e.code==='ENOENT')return null;throw e;}}
 if(!configured())return null;
 const item=await get(`studio/${key}`,{access:'private',useCache:false});
 if(!item)return null;
 return {data:await new Response(item.stream).json(),etag:item.blob.etag};
}
export async function writeRecord(key,data,etag){
 if(!configured())throw Object.assign(new Error('Conecte o armazenamento privado para salvar.'),{status:503});
 if(local()){
  const path=diskPath(key),lock=path+'.lock';await mkdir(dirname(path),{recursive:true});
  try{await mkdir(lock);}catch(e){if(e.code==='EEXIST')throw new Conflict();throw e;}
  try{const prev=await readRecord(key);if((prev?.etag??null)!==(etag??null))throw new Conflict();const record={data,etag:randomUUID()};const temp=path+'.'+randomUUID();await writeFile(temp,JSON.stringify(record),{mode:0o600});await rename(temp,path);return record.etag;}finally{await rm(lock,{recursive:true,force:true});}
 }
 try {const item=await put(`studio/${key}`,JSON.stringify(data),{access:'private',contentType:'application/json',addRandomSuffix:false,allowOverwrite:Boolean(etag),...(etag?{ifMatch:etag}:{}),cacheControlMaxAge:0});return item.etag;}catch(e){if(e instanceof BlobPreconditionFailedError||/already exists/i.test(e.message))throw new Conflict();throw e;}
}
export async function updateRecord(key,fn){for(let attempt=0;attempt<5;attempt++){const record=await readRecord(key);try{const next=await fn(record?.data??null);await writeRecord(key,next,record?.etag);return next;}catch(e){if(!(e instanceof Conflict)||attempt===4)throw e;}}}
export async function getCatalog(){const record=await readRecord('catalog.json');if(record)return record;return {data:structuredClone(seed),etag:null};}
