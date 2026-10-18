import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {countProductSales} from '../server/product-sales.mjs';
import {filterAdminProducts,sortAdminProductsBySales} from '../lib/admin-catalog.mjs';
import {writeRecord,updateRecord} from '../server/store.mjs';
import {makeSession} from '../server/auth.mjs';
import handler from '../server/handler.mjs';
const item=(id,quantity)=>({kind:'product',id,quantity,products:[{id}]});
const order=(items,changes={})=>({status:'paid',environment:'production',items,...changes});
test('sales count paid units, historical bundles, both providers and exclude tests/refunds; protected endpoint refreshes',async()=>{
 const keys=['DATABASE_URL','POSTGRES_URL','VERCEL','BLOB_READ_WRITE_TOKEN','LOCAL_DATA_DIR','ASAAS_ENVIRONMENT','PAYPAL_ENVIRONMENT','ADMIN_SESSION_SECRET'];
 const saved=Object.fromEntries(keys.map(k=>[k,process.env[k]])),dir=await mkdtemp(join(tmpdir(),'product-sales-'));
 for(const key of keys)delete process.env[key];
 Object.assign(process.env,{LOCAL_DATA_DIR:dir,ASAAS_ENVIRONMENT:'production',PAYPAL_ENVIRONMENT:'production',ADMIN_SESSION_SECRET:'product-sales-test-only-long-secret'});
 try{
  const orders=[order([item('a',3)]),order([{kind:'collection',id:'old-collection',products:[{id:'a'},{id:'b'},{id:'b'}]}]),order([item('b')],{provider:'paypal'}),...['pending','overdue','cancelled','refunded','revoked'].map(status=>order([item('a',20)],{status})),order([item('a',20)],{environment:'sandbox'}),order([item('b',20)],{provider:'paypal',environment:'sandbox'})];
  const expected=[{id:'a',individualSales:3,collectionSales:1,totalSales:4},{id:'b',individualSales:1,collectionSales:1,totalSales:2}];
  assert.deepEqual(countProductSales(orders),expected);assert.deepEqual(countProductSales(),[]);
  await writeRecord('commerce.json',{orders},null);await writeRecord('admin.json',{version:'test-admin'},null);
  const cookie=`tiolira_admin=${await makeSession('test-admin')}`;
  const request=async(session='')=>{let result;const headers={};await handler({method:'GET',url:'/api/admin/product-sales',headers:{host:'localhost',cookie:session}},{setHeader(k,v){headers[k]=v},end(value){result={status:this.statusCode,body:JSON.parse(value),headers}}});return result;};
  assert.equal((await request()).status,401);
  assert.equal((await request(`tiolira_club=${await makeSession('test-admin')}`)).status,401);
  const response=await request(cookie);assert.equal(response.status,200);assert.deepEqual(response.body,{products:expected});assert.equal(response.headers['Cache-Control'],'private, no-store');
  await updateRecord('commerce.json',state=>({...state,orders:state.orders.map((o,i)=>i===0?{...o,status:'revoked'}:o)}));
  assert.equal((await request(cookie)).body.products.find(p=>p.id==='a').totalSales,1);
 }finally{for(const key of keys)saved[key]===undefined?delete process.env[key]:process.env[key]=saved[key];await rm(dir,{recursive:true,force:true});}
});
test('admin ranking sorts descending with stable name tie-break, includes zero sales and preserves filtering/source',()=>{
 const products=[{id:'zero',name:'Zero',collection:'x'},{id:'b',name:'B',collection:'x'},{id:'a',name:'A',collection:'x'},{id:'top',name:'Mais vendida',collection:'y'}],before=structuredClone(products);
 const counts={a:{totalSales:2},b:{totalSales:2},top:{totalSales:8}};
 assert.deepEqual(sortAdminProductsBySales(products,counts).map(p=>p.id),['top','a','b','zero']);
 assert.deepEqual(sortAdminProductsBySales(filterAdminProducts(products,{collection:'x'}),counts).map(p=>p.id),['a','b','zero']);assert.deepEqual(products,before);
});
