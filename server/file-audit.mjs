import {get} from '@vercel/blob';
import {createHash} from 'node:crypto';
import {crc32,inflateRawSync} from 'node:zlib';

// Read every ZIP member rather than accepting a successful HTTP status as proof
// that a downloaded 3MF is complete. No model data is returned to the caller.
export function verify3mf(bytes){
 let end=-1;
 for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--){
  if(bytes.readUInt32LE(i)===0x06054b50&&i+22+bytes.readUInt16LE(i+20)===bytes.length){end=i;break;}
 }
 if(end<0)throw new Error('Arquivo ZIP/3MF incompleto.');
 const count=bytes.readUInt16LE(end+10),centralSize=bytes.readUInt32LE(end+12),centralOffset=bytes.readUInt32LE(end+16);
 if(!count||count===65535||centralOffset+centralSize!==end)throw new Error('Estrutura ZIP/3MF inválida ou não suportada.');
 let pos=centralOffset,total=0;const names=[];
 for(let i=0;i<count;i++){
  if(pos+46>end||bytes.readUInt32LE(pos)!==0x02014b50)throw new Error('Índice ZIP incompleto.');
  const flags=bytes.readUInt16LE(pos+8),method=bytes.readUInt16LE(pos+10),crc=bytes.readUInt32LE(pos+16),compressed=bytes.readUInt32LE(pos+20),size=bytes.readUInt32LE(pos+24),nameLength=bytes.readUInt16LE(pos+28),extra=bytes.readUInt16LE(pos+30),comment=bytes.readUInt16LE(pos+32),local=bytes.readUInt32LE(pos+42);
  const name=bytes.subarray(pos+46,pos+46+nameLength).toString('utf8');
  if(flags&1||![0,8].includes(method)||size>512*1024*1024||(total+=size)>2*1024*1024*1024)throw new Error('Arquivo excede os limites desta verificação.');
  if(local+30>centralOffset||bytes.readUInt32LE(local)!==0x04034b50)throw new Error('Entrada ZIP incompleta.');
  const start=local+30+bytes.readUInt16LE(local+26)+bytes.readUInt16LE(local+28);
  if(start+compressed>centralOffset)throw new Error('Conteúdo ZIP truncado.');
  const data=bytes.subarray(start,start+compressed),plain=method===8?inflateRawSync(data,{maxOutputLength:Math.max(1,size)}):data;
  if(plain.length!==size||crc32(plain)!==crc)throw new Error('Falha de integridade CRC no arquivo.');
  names.push(name);pos+=46+nameLength+extra+comment;
 }
 if(pos!==end||!names.includes('[Content_Types].xml')||!names.some(n=>/^3D\/.*\.model$/i.test(n)))throw new Error('O arquivo não contém um modelo 3MF válido.');
 return {entries:count,modelEntries:names.filter(n=>/^3D\/.*\.model$/i.test(n)).length,uncompressedBytes:total};
}

export async function auditProductFile(product,readBlob=get){
 const blob=await readBlob(product.filePath,{access:'private',useCache:false});
 if(!blob?.stream)throw Object.assign(new Error('Arquivo não encontrado no armazenamento.'),{status:404});
 const chunks=[];let size=0;
 for await(const chunk of blob.stream){size+=chunk.length;if(size>256*1024*1024)throw Object.assign(new Error('Arquivo excede o limite de 256 MB desta verificação.'),{status:422});chunks.push(Buffer.from(chunk));}
 if(size!==blob.blob.size)throw Object.assign(new Error('Download incompleto: tamanho diferente do original.'),{status:422});
 const bytes=Buffer.concat(chunks);
 let archive;
 try{archive=verify3mf(bytes);}catch(error){throw Object.assign(error,{status:422});}
 return {id:product.id,name:product.name,ok:true,bytes:size,sha256:createHash('sha256').update(bytes).digest('hex'),...archive};
}
