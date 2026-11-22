// ZIP directory parsing shared by the server and the admin's local file reader.
// Never extract paths to disk, execute XML, or inflate unrelated mesh/G-code parts.
export const TRACE_NAME='tiolira:Trace';
export const TRACE_NS='https://www.tiolira.com.br/ns/3mf/trace/v1';
export const MAX_ARCHIVE=2*1024**3;
export const MAX_MODEL=128*1024**2;
const decoder=new TextDecoder('utf-8',{fatal:true});
const view=b=>new DataView(b.buffer,b.byteOffset,b.byteLength);
const bad=()=>{throw new Error('3MF inválido ou formato ZIP não suportado.');};
export async function zipDirectory(source){
 if(source.size<22||source.size>MAX_ARCHIVE)throw new Error('Selecione um 3MF de até 2 GB.');
 const tail=await source.read(Math.max(0,source.size-65557),source.size),v=view(tail);
 let at=-1;
 for(let i=tail.length-22;i>=0;i--)if(v.getUint32(i,true)===0x06054b50&&i+22+v.getUint16(i+20,true)===tail.length){at=i;break;}
 if(at<0)bad();
 const count=v.getUint16(at+10,true),size=v.getUint32(at+12,true),start=v.getUint32(at+16,true),end=source.size-tail.length+at;
 if(v.getUint16(at+4,true)||v.getUint16(at+6,true)||v.getUint16(at+8,true)!==count||!count||count>=65535||count>20000||size>16*1024**2||start+size!==end)bad();
 const bytes=await source.read(start,start+size),cv=view(bytes),entries=[],names=new Set();let p=0;
 for(let i=0;i<count;i++){
  if(p+46>bytes.length||cv.getUint32(p,true)!==0x02014b50)bad();
  const n=cv.getUint16(p+28,true),extra=cv.getUint16(p+30,true),comment=cv.getUint16(p+32,true),length=46+n+extra+comment;
  if(p+length>bytes.length)bad();
  const name=decoder.decode(bytes.subarray(p+46,p+46+n)),flags=cv.getUint16(p+8,true),method=cv.getUint16(p+10,true),compressed=cv.getUint32(p+20,true),uncompressed=cv.getUint32(p+24,true),offset=cv.getUint32(p+42,true);
  if(names.has(name)||!name||name.includes('\\')||name.startsWith('/')||name.split('/').includes('..')||flags&1||cv.getUint16(p+34,true)||offset>=start||compressed===0xffffffff||uncompressed===0xffffffff)bad();
  names.add(name);entries.push({name,flags,method,compressed,uncompressed,offset,crc:cv.getUint32(p+16,true),central:bytes.slice(p,p+length)});p+=length;
 }
 if(p!==bytes.length)bad();
 const sorted=[...entries].sort((a,b)=>a.offset-b.offset);
 if(sorted[0].offset!==0)bad();
 sorted.forEach((entry,i)=>{entry.end=sorted[i+1]?.offset??start;if(entry.end<=entry.offset||entry.offset+30+entry.compressed>entry.end)bad();});
 return {entries,sorted,start,comment:tail.slice(at+22)};
}
export async function entryBytes(source,entry,inflate,limit=MAX_MODEL){
 if(entry.uncompressed>limit||entry.compressed>limit)throw new Error('A parte XML do 3MF excede o limite seguro de análise.');
 const header=await source.read(entry.offset,entry.offset+30),v=view(header);
 if(header.length!==30||v.getUint32(0,true)!==0x04034b50||v.getUint16(6,true)!==entry.flags||v.getUint16(8,true)!==entry.method)bad();
 const n=v.getUint16(26,true),e=v.getUint16(28,true),start=entry.offset+30+n+e;
 if(start+entry.compressed>entry.end)bad();
 const name=decoder.decode(await source.read(entry.offset+30,entry.offset+30+n));if(name!==entry.name)bad();
 const compressed=await source.read(start,start+entry.compressed);
 const bytes=entry.method===0?compressed:entry.method===8?await inflate(compressed,limit):bad();
 if(bytes.length!==entry.uncompressed||crc32(bytes)!==entry.crc)bad();
 return bytes;
}
export async function mainModel(source,directory,inflate){
 const relationships=directory.entries.find(e=>e.name==='_rels/.rels');
 if(!relationships)bad();
 const text=decoder.decode(await entryBytes(source,relationships,inflate,1024**2));
 if(/<!DOCTYPE|<!ENTITY/i.test(text))bad();
 const targets=[];
 for(const tag of text.match(/<(?:\w+:)?Relationship\b[^>]*>/g)||[]){
  const attrs=Object.fromEntries([...tag.matchAll(/([\w:]+)\s*=\s*(["'])(.*?)\2/g)].map(m=>[m[1],m[3]]));
  if(attrs.Type==='http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel'){
   if(attrs.TargetMode==='External')bad();targets.push((attrs.Target||'').replace(/^\//,''));
  }
 }
 if(targets.length!==1)bad();
 const entry=directory.entries.find(e=>e.name===targets[0]);if(!entry)bad();return entry;
}
export function traceFromXml(bytes){
 const text=decoder.decode(bytes);if(/<!DOCTYPE|<!ENTITY/i.test(text))bad();
 const found=[];
 for(const match of text.matchAll(/<(?:\w+:)?metadata\b([^>]*)>([^<]{0,8192})<\/(?:\w+:)?metadata\s*>/g)){
  if(/\bname\s*=\s*(["'])tiolira:Trace\1/.test(match[1])){
   const value=match[2].replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
   try{found.push(JSON.parse(value));}catch{throw new Error('O código do arquivo está danificado.');}
  }
 }
 if(found.length>1)throw new Error('Há mais de um código no arquivo; a origem é ambígua.');
 return found[0]||null;
}
const table=Uint32Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
export function crc32(bytes){let crc=0xffffffff;for(const byte of bytes)crc=table[(crc^byte)&255]^(crc>>>8);return (crc^0xffffffff)>>>0;}
export async function inspectLocal3mf(file){
 const source={size:file.size,read:async(start,end)=>new Uint8Array(await file.slice(start,end).arrayBuffer())};
 const inflate=async(bytes,limit)=>{
  if(typeof DecompressionStream==='undefined')throw new Error('Atualize seu navegador para analisar este arquivo.');
  const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw')),reader=stream.getReader(),chunks=[];let size=0;
  try{while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>limit)throw new Error('XML muito grande para análise segura.');chunks.push(value);}}finally{await reader.cancel();}
  const result=new Uint8Array(size);let offset=0;for(const chunk of chunks){result.set(chunk,offset);offset+=chunk.length;}return result;
 };
 const directory=await zipDirectory(source),entry=await mainModel(source,directory,inflate);
 return traceFromXml(await entryBytes(source,entry,inflate));
}
