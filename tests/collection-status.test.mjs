import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {writeRecord,readRecord,updateRecord} from '../server/store.mjs';
import {setCollectionPreparation} from '../server/collection-status.mjs';
import handler from '../server/handler.mjs';
test('collection status patch preserves newer files, collection edits and other collections',async()=>{
 const keys=['DATABASE_URL','POSTGRES_URL','VERCEL','BLOB_READ_WRITE_TOKEN','LOCAL_DATA_DIR'];const before=Object.fromEntries(keys.map(k=>[k,process.env[k]]));keys.forEach(k=>delete process.env[k]);const dir=await mkdtemp(join(tmpdir(),'tl-status-'));process.env.LOCAL_DATA_DIR=dir;
 try{
  await writeRecord('catalog.json',{collections:[{id:'target',name:'Original',comingSoon:true},{id:'other',comingSoon:true}],products:[{id:'piece',filePath:'old.3mf'}]},null);
  await updateRecord('catalog.json',old=>({...old,collections:old.collections.map(c=>c.id==='target'?{...c,name:'Nome atualizado',description:'Texto novo'}:c),products:[{id:'piece',filePath:'corrected.3mf'}]}));
  await setCollectionPreparation({id:'target',comingSoon:false,expectedComingSoon:true});const state=(await readRecord('catalog.json')).data;assert.equal(state.collections[0].comingSoon,false);assert.equal(state.collections[0].name,'Nome atualizado');assert.equal(state.collections[0].description,'Texto novo');assert.equal(state.products[0].filePath,'corrected.3mf');assert.equal(state.collections[1].comingSoon,true);
  await setCollectionPreparation({id:'target',comingSoon:false,expectedComingSoon:true});
  await assert.rejects(()=>setCollectionPreparation({id:'missing',comingSoon:false,expectedComingSoon:true}),/não encontrada/);
  await assert.rejects(()=>setCollectionPreparation({id:'target',comingSoon:true,expectedComingSoon:true}),/dados mudaram/);
  let status;await handler({url:'/api/admin/collection-preparation',method:'PUT',body:{id:'target',comingSoon:true,expectedComingSoon:false},headers:{host:'localhost',origin:'http://localhost'}},{setHeader(){},set statusCode(v){status=v},end(){}});assert.equal(status,401);assert.equal((await readRecord('catalog.json')).data.collections[0].comingSoon,false);
 }finally{keys.forEach(k=>{if(before[k]===undefined)delete process.env[k];else process.env[k]=before[k]});await rm(dir,{recursive:true,force:true});}
});
