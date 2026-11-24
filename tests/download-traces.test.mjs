import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {deflateRawSync,inflateRawSync} from 'node:zlib';
import {Readable,Writable} from 'node:stream';
import {createHash} from 'node:crypto';
import {zipDirectory,entryBytes,mainModel,crc32,traceFromXml,inspectLocal3mf,TRACE_NS,TRACE_NAME,MAX_MODEL} from '../lib/three-mf-trace.mjs';
import {prepareTracedCopy} from '../server/three-mf-copy.mjs';
import {lookupTrace} from '../server/download-traces.mjs';
import {readRecord,writeRecord} from '../server/store.mjs';
import {serveProductDownload} from '../server/product-download.mjs';
import {makeSession} from '../server/auth.mjs';
import handler from '../server/handler.mjs';

const inflate=(b,limit)=>inflateRawSync(b,{maxOutputLength:limit});
const model=Buffer.from('<?xml version="1.0"?><model xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02"><metadata name="Title">Peça de teste</metadata><resources><object id="1"><mesh><vertices><vertex x="0.00012" y="1" z="2"/></vertices></mesh></object></resources><build/></model>');
// Independent fixture writer covers deflate, stored data and data descriptors.
function zip(parts){
 const locals=[],centrals=[];let offset=0;
 for(const [name,raw,method=8,descriptor=false] of parts){
  const b=Buffer.from(raw),n=Buffer.from(name),c=method===8?deflateRawSync(b):b,l=Buffer.alloc(30),d=Buffer.alloc(descriptor?16:0),central=Buffer.alloc(46),flags=0x800|(descriptor?8:0),crc=crc32(b);
  l.writeUInt32LE(0x04034b50);l.writeUInt16LE(20,4);l.writeUInt16LE(flags,6);l.writeUInt16LE(method,8);l.writeUInt16LE(n.length,26);
  if(descriptor){d.writeUInt32LE(0x08074b50);d.writeUInt32LE(crc,4);d.writeUInt32LE(c.length,8);d.writeUInt32LE(b.length,12);}else{l.writeUInt32LE(crc,14);l.writeUInt32LE(c.length,18);l.writeUInt32LE(b.length,22);}
  central.writeUInt32LE(0x02014b50);central.writeUInt16LE(20,4);central.writeUInt16LE(20,6);central.writeUInt16LE(flags,8);central.writeUInt16LE(method,10);central.writeUInt32LE(crc,16);central.writeUInt32LE(c.length,20);central.writeUInt32LE(b.length,24);central.writeUInt16LE(n.length,28);central.writeUInt32LE(offset,42);
  locals.push(l,n,c,d);centrals.push(central,n);offset+=l.length+n.length+c.length+d.length;
 }
 const cd=Buffer.concat(centrals),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(parts.length,8);end.writeUInt16LE(parts.length,10);end.writeUInt32LE(cd.length,12);end.writeUInt32LE(offset,16);return Buffer.concat([...locals,cd,end]);
}
const parts=[['_rels/.rels','<Relationships><Relationship Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel" Target="/3D/main.model"/></Relationships>'],['3D/main.model',model,8,true],['3D/Objects/mesh.model','UNCHANGED VERTICES',8,true],['Metadata/project_settings.config','{"support":true}',0],['Metadata/plate_1.gcode','G1 X20 Y30',8]];
const source=bytes=>({size:bytes.length,read:async(a,b)=>bytes.subarray(a,b)});
const stream=bytes=>Readable.toWeb(Readable.from([bytes]));
const member={id:'member-test',name:'Test Person',email:'trace@example.invalid',whatsapp:'000000'},product={id:'p',name:'Teste',slug:'teste',collection:'c',published:true,access:'site'},file={id:'original',name:'Original',filePath:'models/test.3mf'};
const args=bytes=>({stream:stream(bytes),member,product,file});
async function buffer(copy){const chunks=[];for await(const c of copy.stream)chunks.push(c);return Buffer.concat(chunks);}

test('unique private issuance, unchanged original/other parts, local browser extraction, signed lookup and protected API',async()=>{
 const saved={...process.env},dir=await mkdtemp(join(tmpdir(),'trace-test-'));
 for(const name of ['DATABASE_URL','POSTGRES_URL','VERCEL','BLOB_READ_WRITE_TOKEN'])delete process.env[name];
 process.env.LOCAL_DATA_DIR=dir;process.env.ADMIN_SESSION_SECRET='trace-test-long-secret-not-for-production';
 try{
  const input=zip(parts),before=createHash('sha256').update(input).digest('hex'),copy=await prepareTracedCopy(args(input));let output;
  try{output=await buffer(copy);assert.equal(output.length,copy.size);await copy.finish('streamed');}finally{await copy.cleanup();}
  assert.equal(createHash('sha256').update(input).digest('hex'),before);
  const a=await zipDirectory(source(input)),b=await zipDirectory(source(output));assert.deepEqual(a.entries.map(e=>e.name),b.entries.map(e=>e.name));
  let marked;
  for(const e of a.entries){const f=b.entries.find(x=>x.name===e.name),bytes=await entryBytes(source(output),f,inflate);
   if(e.name==='3D/main.model'){marked=bytes;const stripped=Buffer.from(bytes).toString().replace(` xmlns:tiolira="${TRACE_NS}"`,'').replace(/<metadata name="tiolira:Trace" preserve="1">.*?<\/metadata>/,'');assert.equal(stripped,model.toString());}
   else{assert.deepEqual(bytes,await entryBytes(source(input),e,inflate));assert.deepEqual(output.subarray(f.offset,f.end),input.subarray(e.offset,e.end));}
  }
  const trace=traceFromXml(marked);assert.equal(trace.id,copy.id);assert.equal(trace.source_sha256,before);assert.ok(!Buffer.from(marked).includes(member.email));
  assert.deepEqual(await inspectLocal3mf(new Blob([output])),trace);
  assert.equal(await inspectLocal3mf(new Blob([input])),null);
  // Bambu preserves the metadata but can drop the vendor namespace on Save As.
  assert.deepEqual(traceFromXml(Buffer.from(Buffer.from(marked).toString().replace(` xmlns:tiolira="${TRACE_NS}"`,''))),trace);
  const second=await prepareTracedCopy(args(input));assert.notEqual(second.id,copy.id);second.stream.destroy();await second.cleanup();
  const found=await lookupTrace({trace});assert.equal(found.status,'found');assert.deepEqual(found.member,member);assert.equal(found.deliveryStatus,'streamed');assert.ok(!JSON.stringify(found).includes('secret'));
  assert.equal((await lookupTrace({trace:{...trace,source_sha256:'0'.repeat(64)}})).status,'invalid');
  assert.equal((await lookupTrace({trace:{...trace,hmac_sha256:'0'.repeat(64)}})).status,'invalid');
  assert.equal((await lookupTrace({trace:{...trace,id:'TL3MF-'+'0'.repeat(32)}})).status,'unknown');
  assert.equal((await lookupTrace({trace:{...trace,id:'../../secret'}})).status,'invalid');
  const current={...member,email:'corrected@example.invalid'};await writeRecord('club-members.json',{members:[current]},null);assert.equal((await lookupTrace({trace})).member.email,current.email);
  await writeRecord('admin.json',{version:'v1'},null);const cookie='tiolira_admin='+await makeSession('v1');
  async function api({auth='',origin='http://localhost',input={trace}}={}){let status,body;await handler({method:'POST',url:'/api/admin/download-traces/inspect',headers:{host:'localhost',origin,cookie:auth},body:input,socket:{remoteAddress:'test'}},{setHeader(){},set statusCode(v){status=v;},end(v){body=JSON.parse(v);}});return {status,body};}
  assert.equal((await api()).status,401);assert.equal((await api({auth:cookie,origin:'https://evil.invalid'})).status,403);assert.equal((await api({auth:cookie})).body.status,'found');
  assert.equal((await api({auth:'tiolira_club='+await makeSession('v1',{memberId:member.id})})).status,401);
 }finally{for(const name of Object.keys(process.env))if(!(name in saved))delete process.env[name];Object.assign(process.env,saved);await rm(dir,{recursive:true,force:true});}
});

test('corrupt, duplicate, oversized, encrypted and ambiguous files fail without creating an issuance',async()=>{
 let registrations=0;const deps={register:async()=>registrations++,finish:async()=>{}};
 const valid=zip(parts),directory=await zipDirectory(source(valid)),modelEntry=await mainModel(source(valid),directory,inflate);
 const damaged=Buffer.from(valid);damaged[modelEntry.offset+30+Buffer.byteLength(modelEntry.name)]^=0xff;
 const encrypted=Buffer.from(valid);encrypted.writeUInt16LE(0x801,directory.start+8);
 for(const input of [Buffer.from('not a ZIP'),valid.subarray(0,-10),zip([...parts,parts[0]]),damaged,encrypted,zip(parts.map(p=>p[0]==='3D/main.model'?[p[0],'<model><metadata name="tiolira:Trace">old</metadata></model>']:p))])await assert.rejects(prepareTracedCopy(args(input),deps));
 assert.equal(registrations,0);
 const duplicate=Buffer.from(`<model><metadata name="${TRACE_NAME}">{}</metadata><metadata name="${TRACE_NAME}">{}</metadata></model>`);assert.throws(()=>traceFromXml(duplicate),/mais de um/);
 await assert.rejects(entryBytes(source(valid),{...modelEntry,uncompressed:MAX_MODEL+1},inflate),/limite/);
 const before=(await readdir(tmpdir())).filter(n=>n.startsWith('tl-3mf-')).sort();await assert.rejects(prepareTracedCopy(args(valid),{register:async()=>{throw new Error('Database offline');}}),/Database offline/);assert.deepEqual((await readdir(tmpdir())).filter(n=>n.startsWith('tl-3mf-')).sort(),before);
});

test('every eligible 3MF profile is marked, non-3MF stays byte-identical, denied access never reads or issues',async()=>{
 const original=zip(parts),data={products:[{...product,filePath:file.filePath,printProfiles:[{...file,id:'fine',filePath:'models/fine.3mf'}]}],collections:[{id:'c',published:true}]};let prepares=0,reads=0,records=0;
 const deps={readBlob:async()=>{reads++;return {stream:stream(original)};},record:async()=>records++,prepare:async a=>{prepares++;return prepareTracedCopy(a,{register:async()=>{},finish:async()=>{}});}};
 async function download(data0=data,profileId){const chunks=[],headers={};const res=new Writable({write(c,e,cb){chunks.push(c);cb();}});res.setHeader=(k,v)=>headers[k]=v;await serveProductDownload({member,data:data0,productId:'p',profileId,res},deps);return {bytes:Buffer.concat(chunks),headers};}
 for(const profile of [undefined,'fine']){const result=await download(data,profile);assert.match(result.headers['X-TioLira-Download-Code'],/^TL3MF-/);assert.ok(await inspectLocal3mf(new Blob([result.bytes])));}
 const stl=await download({...data,products:[{...data.products[0],filePath:'models/test.stl'}]});assert.deepEqual(stl.bytes,original);assert.equal(prepares,2);assert.equal(records,3);
 const paid={...data,products:[{...data.products[0],access:'paid',priceCents:1990}]};await assert.rejects(serveProductDownload({member,data:paid,productId:'p'},{...deps,hasAccess:async()=>false}),{status:403});assert.equal(reads,3);
 const res=new Writable({write(c,e,cb){assert.fail('Unmarked bytes must not be sent');cb();}});res.setHeader=()=>{};
 await assert.rejects(serveProductDownload({member,data,productId:'p',res},{...deps,prepare:async()=>{throw new Error('Registry offline');}}),/Registry offline/);assert.equal(records,3);
});

// A single-mesh Bambu project may be small on disk but >128 MiB as XML.
test('monolithic Bambu model above the former 128 MiB limit can be issued and inspected',async()=>{
 const large=Buffer.concat([model.subarray(0,-8),Buffer.alloc(129*1024**2,32),Buffer.from('</model>')]);
 const input=zip(parts.map(p=>p[0]==='3D/main.model'?[p[0],large]:p));
 const copy=await prepareTracedCopy(args(input),{register:async()=>{},finish:async()=>{}});
 try{const output=await buffer(copy);assert.equal((await inspectLocal3mf(new Blob([output]))).id,copy.id);}
 finally{await copy.cleanup();}
});
