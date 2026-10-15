import test from 'node:test';
import assert from 'node:assert/strict';
import {crc32,deflateRawSync} from 'node:zlib';
import {auditProductFile,verify3mf} from '../server/file-audit.mjs';
import handler from '../server/handler.mjs';

function model(){
 const parts=[],directory=[];let offset=0;
 for(const name of ['[Content_Types].xml','3D/3dmodel.model']){
  const filename=Buffer.from(name),plain=Buffer.from('<model>test content</model>'),compressed=deflateRawSync(plain),local=Buffer.alloc(30),central=Buffer.alloc(46);
  local.writeUInt32LE(0x04034b50);local.writeUInt16LE(8,8);local.writeUInt32LE(crc32(plain),14);local.writeUInt32LE(compressed.length,18);local.writeUInt32LE(plain.length,22);local.writeUInt16LE(filename.length,26);
  central.writeUInt32LE(0x02014b50);central.writeUInt16LE(8,10);central.writeUInt32LE(crc32(plain),16);central.writeUInt32LE(compressed.length,20);central.writeUInt32LE(plain.length,24);central.writeUInt16LE(filename.length,28);central.writeUInt32LE(offset,42);
  parts.push(local,filename,compressed);directory.push(central,filename);offset+=local.length+filename.length+compressed.length;
 }
 const index=Buffer.concat(directory),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(2,8);end.writeUInt16LE(2,10);end.writeUInt32LE(index.length,12);end.writeUInt32LE(offset,16);
 return Buffer.concat([...parts,index,end]);
}
test('file audit reads the complete 3MF and checks every member CRC',async()=>{
 const bytes=model();assert.equal(verify3mf(bytes).modelEntries,1);
 const result=await auditProductFile({id:'sample',name:'Sample',filePath:'models/sample.3mf'},async(path,options)=>{assert.equal(path,'models/sample.3mf');assert.equal(options.access,'private');return {stream:new Response(bytes).body,blob:{size:bytes.length}}});
 assert.equal(result.ok,true);assert.equal(result.bytes,bytes.length);assert.equal(result.sha256.length,64);
 assert.throws(()=>verify3mf(bytes.subarray(0,-5)),/incompleto/);
 const corrupt=Buffer.from(bytes),central=corrupt.indexOf(Buffer.from([0x50,0x4b,0x01,0x02]));corrupt.writeUInt32LE(0,central+16);assert.throws(()=>verify3mf(corrupt),/CRC/);
 await assert.rejects(()=>auditProductFile({filePath:'models/a.3mf'},async()=>({stream:new Response(bytes).body,blob:{size:bytes.length+1}})),{status:422});
});
test('file audit endpoint requires administrator authentication before storage access',async()=>{
 const res={headers:{},setHeader(k,v){this.headers[k]=v},end(data){this.body=JSON.parse(data)}};
 await handler({method:'GET',url:'/api/admin/files/verify?id=sample',headers:{}},res);
 assert.equal(res.statusCode,401);assert.equal(res.headers['Cache-Control'],'private, no-store');
});
