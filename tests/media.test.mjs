import test from 'node:test';
import assert from 'node:assert/strict';
import {Writable} from 'node:stream';
import {serveCatalogImage} from '../server/media.mjs';
import handler from '../server/handler.mjs';

test('HEAD supports image crawlers without streaming the body or exposing model files',async()=>{
 let cancelled=false,ended=false;const headers={};
 const stream=new ReadableStream({cancel(){cancelled=true}});
 await serveCatalogImage('images/example.png',{setHeader(k,v){headers[k]=v},end(data){assert.equal(data,undefined);ended=true}},async()=>({stream,blob:{contentType:'image/png'}}),{head:true});
 assert.equal(cancelled,true);assert.equal(ended,true);assert.equal(headers['Content-Type'],'image/png');
 for(const [path,status] of [['images/139f92e3-605d-4d0f-8e60-1ce64d27e828.png',307],['models/private.3mf',404]]){
  const result={},responseHeaders={};await handler({method:'HEAD',url:'/api/media?path='+encodeURIComponent(path),headers:{host:'localhost'}},{set statusCode(v){result.status=v},setHeader(k,v){responseHeaders[k]=v},end(){}});
  assert.equal(result.status,status);if(status===307)assert.equal(responseHeaders.Location,'/assets/catalog/curupira.webp');
 }
});

test('catalog images use private storage, finish streaming and cache only successful images',async()=>{
 let calls=0;
 const readBlob=async(path,options)=>{calls++;assert.equal(path,'images/example.png');assert.deepEqual(options,{access:'private'});return {stream:new Response(Buffer.from([137,80,78,71])).body,blob:{contentType:'image/png'}};};
 const bytes=[],headers={};const response=new Writable({write(chunk,encoding,done){bytes.push(chunk);setTimeout(done,5);}});response.setHeader=(key,value)=>headers[key]=value;
 await serveCatalogImage('images/example.png',response,readBlob);
 assert.equal(response.writableFinished,true);assert.deepEqual([...Buffer.concat(bytes)],[137,80,78,71]);assert.equal(headers['Content-Type'],'image/png');assert.match(headers['Cache-Control'],/s-maxage=86400/);
 for(const path of ['models/private.3mf','../images/test.png','images/../test.png','https://evil.invalid/a.png'])await assert.rejects(()=>serveCatalogImage(path,response,readBlob),{status:404});
 assert.equal(calls,1);
 const missing={setHeader(){assert.fail('missing images must not be cached')}};
 await assert.rejects(()=>serveCatalogImage('images/missing.png',missing,async()=>null),{status:404});
});

test('recovered public photos work while the private store is unavailable',async()=>{
 const headers={};let ended=false;const res={setHeader:(key,value)=>headers[key]=value,end(){ended=true}};
 await serveCatalogImage('images/e656fe5f-c279-4c91-ad21-982a53346e89.png',res,async()=>{assert.fail('must not spend private storage quota')});
 assert.equal(res.statusCode,307);assert.equal(headers.Location,'/assets/catalog/nazare.webp');assert.equal(ended,true);
});
test('Prece em Familia gallery serves optimized public copies without private storage',async()=>{
 for(const [id,name] of [['63bd1653-ddae-497e-8907-589628aa885c','prece-em-familia'],['6227c0c7-7e2c-4a1b-b716-b0b68ebf36df','prece-em-familia-detalhe']]){
  const headers={},res={setHeader(k,v){headers[k]=v},end(){}};
  await serveCatalogImage(`images/${id}.png`,res,async()=>assert.fail('No private storage request'));
  assert.equal(res.statusCode,307);assert.equal(headers.Location,`/assets/catalog/${name}.webp`);
 }
});
