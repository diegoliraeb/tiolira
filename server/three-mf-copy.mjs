import {mkdtemp,open,rm} from 'node:fs/promises';
import {createReadStream,createWriteStream} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Readable,Transform} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {createHash} from 'node:crypto';
import {createDeflateRaw,createInflateRaw,inflateRaw,crc32 as nativeCrc32} from 'node:zlib';
import {promisify} from 'node:util';
import {zipDirectory,mainModel,entryRange,MAX_MODEL,MAX_ARCHIVE,TRACE_NS,TRACE_NAME} from '../lib/three-mf-trace.mjs';
import {newTrace,registerTrace,finishTrace} from './download-traces.mjs';
const inflate0=promisify(inflateRaw);
const inflate=(bytes,limit)=>inflate0(bytes,{maxOutputLength:limit});

export function markModel(original,trace){
 const text=new TextDecoder('utf-8',{fatal:true}).decode(original);
 if(/<!DOCTYPE|<!ENTITY/i.test(text)||text.includes(TRACE_NAME)||text.includes('xmlns:tiolira'))throw new Error('O original já contém identificação ou XML não suportado.');
 const match=/<((?:\w+:)?model)\b[^>]*>/.exec(text);
 if(!match||match.index>4096||match[0].endsWith('/>')||!text.includes('http://schemas.microsoft.com/3dmanufacturing/core/2015/02'))throw new Error('Modelo 3MF inválido.');
 const prefix=match[1].includes(':')?match[1].split(':')[0]+':':'';
 const at=Buffer.byteLength(text.slice(0,match.index+match[0].length-1));
 const addition=Buffer.from(` xmlns:tiolira="${TRACE_NS}"><${prefix}metadata name="${TRACE_NAME}" preserve="1">${JSON.stringify(trace)}</${prefix}metadata>`);
 return Buffer.concat([original.subarray(0,at),addition,original.subarray(at+1)]);
}
function replacement(entry,{crc,size,compressedSize}){
 const filename=Buffer.from(entry.name),local=Buffer.alloc(30),central=Buffer.from(entry.central),flags=0x800;
 local.writeUInt32LE(0x04034b50);local.writeUInt16LE(20,4);local.writeUInt16LE(flags,6);local.writeUInt16LE(8,8);
 central.copy(local,10,12,16);local.writeUInt32LE(crc,14);local.writeUInt32LE(compressedSize,18);local.writeUInt32LE(size,22);local.writeUInt16LE(filename.length,26);
 // Remove root extras (e.g. stale ZIP64 sizes); preserve its filename and comment.
 const nameLength=central.readUInt16LE(28),extraLength=central.readUInt16LE(30),comment=central.subarray(46+nameLength+extraLength);
 const rebuilt=Buffer.concat([central.subarray(0,46),filename,comment]);
 rebuilt.writeUInt16LE(20,6);rebuilt.writeUInt16LE(flags,8);rebuilt.writeUInt16LE(8,10);rebuilt.writeUInt32LE(crc,16);rebuilt.writeUInt32LE(compressedSize,20);rebuilt.writeUInt32LE(size,24);rebuilt.writeUInt16LE(filename.length,28);rebuilt.writeUInt16LE(0,30);
 return {local:Buffer.concat([local,filename]),central:rebuilt};
}
export class TraceModelTransform extends Transform {
 constructor(entry,trace){super();this.entry=entry;this.trace=trace;this.originalSize=0;this.originalCrc=0;this.size=0;this.crc=0;this.prefix=Buffer.alloc(0);this.started=false;this.decoder=new TextDecoder('utf-8',{fatal:true});this.tail='';}
 validate(text){const scan=this.tail+text;if(/<!DOCTYPE|<!ENTITY/i.test(scan)||scan.includes(TRACE_NAME)||scan.includes('xmlns:tiolira'))throw new Error('O original já contém identificação ou XML não suportado.');this.tail=scan.slice(-64);}
 emitBytes(bytes){this.size+=bytes.length;this.crc=nativeCrc32(bytes,this.crc);this.push(bytes);}
 _transform(chunk,encoding,done){try{
  this.originalSize+=chunk.length;if(this.originalSize>MAX_MODEL||this.originalSize>this.entry.uncompressed)throw new Error('A parte XML do 3MF excede o limite seguro de análise.');
  this.originalCrc=nativeCrc32(chunk,this.originalCrc);this.validate(this.decoder.decode(chunk,{stream:true}));
  if(this.started)this.emitBytes(chunk);
  else{
   const take=Math.min(chunk.length,8192-this.prefix.length);this.prefix=Buffer.concat([this.prefix,chunk.subarray(0,take)]);
   // Decode only the bounded header. Ignore an incomplete UTF-8 character at its end.
   const header=new TextDecoder('utf-8',{fatal:true}).decode(this.prefix,{stream:true}),root=/<((?:\w+:)?model)\b[^>]*>/.exec(header);
   if(root){const end=Buffer.byteLength(header.slice(0,root.index+root[0].length));this.emitBytes(markModel(this.prefix.subarray(0,end),this.trace));this.emitBytes(this.prefix.subarray(end));this.emitBytes(chunk.subarray(take));this.prefix=null;this.started=true;}
   else if(this.prefix.length===8192)throw new Error('Modelo 3MF inválido.');
  }
  done();
 }catch(error){done(error);}}
 _flush(done){try{this.validate(this.decoder.decode());if(!this.started||this.originalSize!==this.entry.uncompressed||this.originalCrc!==this.entry.crc)throw new Error('Falha de integridade no modelo 3MF.');done();}catch(error){done(error);}}
}
async function prepareRoot(source,entry,trace,path){
 if(entry.uncompressed>MAX_MODEL||entry.compressed>MAX_MODEL)throw new Error('A parte XML do 3MF excede o limite seguro de análise.');
 if(![0,8].includes(entry.method))throw new Error('Compressão 3MF não suportada.');
 const range=await entryRange(source,entry),marker=new TraceModelTransform(entry,trace);let compressedSize=0;
 async function* input(){for(let pos=range.start;pos<range.end;pos+=64*1024)yield await source.read(pos,Math.min(range.end,pos+64*1024));}
 const meter=new Transform({transform(chunk,enc,done){compressedSize+=chunk.length;done(null,chunk);}});
 await pipeline(Readable.from(input()),...(entry.method===8?[createInflateRaw()]:[]),marker,createDeflateRaw({level:6}),meter,createWriteStream(path,{flags:'wx',mode:0o600}));
 return {...replacement(entry,{crc:marker.crc,size:marker.size,compressedSize}),compressedSize,path};
}
export async function prepareTracedCopy({stream,member,product,file,acceptance},{register=registerTrace,finish=finishTrace}={}){
 const dir=await mkdtemp(join(tmpdir(),'tl-3mf-'));let handle;
 const cleanup=async()=>{await handle?.close();handle=null;await rm(dir,{recursive:true,force:true});};
 try{
  const path=join(dir,'source.3mf'),hash=createHash('sha256');let size=0;
  const meter=new Transform({transform(chunk,encoding,callback){size+=chunk.length;if(size>MAX_ARCHIVE)return callback(new Error('3MF maior que 2 GB.'));hash.update(chunk);callback(null,chunk);}});
  await pipeline(Readable.fromWeb(stream),meter,createWriteStream(path,{flags:'wx',mode:0o600}));
  handle=await open(path,'r');
  const source={size,async read(start,end){const result=Buffer.alloc(end-start);let offset=0;while(offset<result.length){const {bytesRead}=await handle.read(result,offset,result.length-offset,start+offset);if(!bytesRead)throw new Error('Arquivo 3MF incompleto.');offset+=bytesRead;}return result;}};
  const directory=await zipDirectory(source),entry=await mainModel(source,directory,inflate);
  const {trace,secret}=newTrace(hash.digest('hex')),changed=await prepareRoot(source,entry,trace,join(dir,'root.deflate'));
  let position=0;const offsets=new Map();for(const item of directory.sorted){offsets.set(item.name,position);position+=item===entry?changed.local.length+changed.compressedSize:item.end-item.offset;}
  const centralStart=position,central=directory.entries.map(item=>{const bytes=Buffer.from(item===entry?changed.central:item.central);bytes.writeUInt32LE(offsets.get(item.name),42);position+=bytes.length;return bytes;});
  const end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(directory.entries.length,8);end.writeUInt16LE(directory.entries.length,10);end.writeUInt32LE(position-centralStart,12);end.writeUInt32LE(centralStart,16);end.writeUInt16LE(directory.comment.length,20);
  const outputSize=position+22+directory.comment.length;
  await register({trace,secret,member,product,file,bytes:outputSize,...(acceptance?{acceptance}:{})});
  async function* output(){
   for(const item of directory.sorted){if(item===entry){yield changed.local;yield* createReadStream(changed.path,{highWaterMark:64*1024});continue;}for(let pos=item.offset;pos<item.end;pos+=1024**2)yield await source.read(pos,Math.min(item.end,pos+1024**2));}
   yield* central;yield end;yield directory.comment;
  }
  return {id:trace.id,size:outputSize,stream:Readable.from(output()),cleanup,finish:status=>finish(trace.id,status)};
 }catch(error){await cleanup();throw error;}
}
