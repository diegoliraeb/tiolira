import test from 'node:test';
import assert from 'node:assert/strict';
import {Writable} from 'node:stream';
import {serveCatalogImage} from '../server/media.mjs';

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
