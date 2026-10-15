import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import sharp from 'sharp';
import {readRecord,writeRecord,updateRecord} from '../server/store.mjs';
import {makeSession} from '../server/auth.mjs';
import {purchaseAccess,purchaseLicenses,shop} from '../server/commerce.mjs';
import {feedbackCopies} from '../lib/feedback-copy.mjs';
import handler from '../server/handler.mjs';
import seed from '../data/catalog.json' with {type:'json'};

test('buyer reviews, moderation, photos and private creator contact',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'tiolira-feedback-test-'));
 const keys=['DATABASE_URL','POSTGRES_URL','VERCEL','BLOB_READ_WRITE_TOKEN','LOCAL_DATA_DIR','ASAAS_ENVIRONMENT','PAYPAL_ENVIRONMENT','ADMIN_SESSION_SECRET'];
 const env=Object.fromEntries(keys.map(k=>[k,process.env[k]]));for(const k of keys)delete process.env[k];
 Object.assign(process.env,{LOCAL_DATA_DIR:dir,ASAAS_ENVIRONMENT:'sandbox',PAYPAL_ENVIRONMENT:'sandbox',ADMIN_SESSION_SECRET:'feedback-test-secret-not-for-production-123456'});
 const a={id:randomUUID(),version:randomUUID(),name:'Ana Privada',email:'ana@example.invalid'},b={id:randomUUID(),version:randomUUID(),name:'Bruno',email:'bruno@example.invalid'},admin={version:randomUUID()};
 const cookieA=`tiolira_club=${await makeSession(a.version,{memberId:a.id})}`,cookieB=`tiolira_club=${await makeSession(b.version,{memberId:b.id})}`,cookieAdmin=`tiolira_admin=${await makeSession(admin.version)}`;
 const call=async(route,{method='GET',body={},cookie='',origin='http://localhost'}={})=>{let result;await handler({method,url:'/api/'+route,body,headers:{host:'localhost',origin,cookie},socket:{remoteAddress:'feedback-test'}},{setHeader(){},set statusCode(s){this.status=s},end(v){result={status:this.status||200,body:Buffer.isBuffer(v)?v:JSON.parse(v)}}});return result;};
 const post=(route,body,cookie=cookieA)=>call(route,{method:'POST',body,cookie});
 const data=structuredClone(seed),products=['saci-feedback','cuca-feedback','boitata-feedback','curupira-feedback','mula-feedback'].map(id=>({id,name:id,slug:id,collection:'feedback-collection',published:true,access:'paid',priceCents:1690,filePath:`models/${id}.3mf`}));
 data.collections.push({id:'feedback-collection',name:'Folclore Teste',published:true,free:false,priceCents:6990});data.products.push(...products);
 const order={id:randomUUID(),memberId:a.id,status:'paid',environment:'sandbox',productIds:products.map(p=>p.id),items:[{id:'feedback-collection',kind:'collection',name:'Folclore Teste',priceCents:6990,products:products.map(p=>({id:p.id,name:p.name}))}],totalCents:6990,createdAt:new Date().toISOString(),licenses:products.map(p=>({productId:p.id,code:randomUUID()}))};
 const image='data:image/png;base64,'+(await sharp({create:{width:12,height:12,channels:3,background:'#999'}}).png().toBuffer()).toString('base64');
 let review,thread,publicPhoto,privatePhoto;
 try{
 await writeRecord('catalog.json',data,null);await writeRecord('club-members.json',{members:[a,b]},null);await writeRecord('admin.json',admin,null);await writeRecord('commerce.json',{orders:[order],downloads:{},recentDownloads:[]},null);
 const originalCommerce=structuredClone((await readRecord('commerce.json')).data);
 await t.test('authentication, same-origin protection and buyer-only eligibility',async()=>{
  assert.equal((await call('club/feedback')).status,401);assert.equal((await call('admin/feedback',{cookie:cookieA})).status,401);
  assert.equal((await post('club/reviews',{productId:products[0].id,rating:5,text:'Adorei a peça'},cookieB)).status,403);
  assert.equal((await post('club/messages',{productId:products[0].id,orderId:order.id,text:'Preciso de ajuda'},cookieB)).status,403);
  assert.equal((await call('club/reviews',{method:'POST',cookie:cookieA,origin:'https://evil.invalid',body:{}})).status,403);
  assert.equal((await call('club/feedback',{cookie:cookieA})).body.products.length,5);
  assert.equal((await call('club/feedback',{cookie:cookieB})).body.products.length,0);
 });
 await t.test('review starts pending; forged approval ignored; photo remains private',async()=>{
  assert.equal((await post('club/reviews',{productId:products[0].id,rating:5,text:'Peça excelente para imprimir!',photo:image,status:'approved',memberId:b.id})).status,200);
  review=(await call('club/feedback',{cookie:cookieA})).body.reviews[0];assert.equal(review.status,'pending');publicPhoto=review.photoUrl;
  assert.equal((await call('reviews?productId='+products[0].id)).body.count,0);
  assert.equal((await call(publicPhoto.slice(5))).status,404);
  assert.equal((await call(publicPhoto.slice(5),{cookie:cookieB})).status,404);
  assert.equal((await call(publicPhoto.slice(5),{cookie:cookieA})).status,200);
  assert.equal((await call(publicPhoto.slice(5),{cookie:cookieAdmin})).status,200);
  assert.equal((await post('admin/reviews',{id:review.id,version:review.version,status:'approved'},cookieA)).status,401);
 });
 await t.test('admin approval publishes safe fields and average, not order or identity',async()=>{
  assert.equal((await post('admin/reviews',{id:review.id,version:review.version,status:'approved',reply:'Obrigado por compartilhar!'},cookieAdmin)).status,200);
  const result=(await call('reviews?productId='+products[0].id)).body;assert.equal(result.count,1);assert.equal(result.average,5);assert.equal(result.reviews[0].author,'Ana');assert.equal(result.reviews[0].reply,'Obrigado por compartilhar!');
  for(const value of [order.id,a.id,a.email,'Ana Privada'])assert.ok(!JSON.stringify(result).includes(value));
  assert.equal((await call(publicPhoto.slice(5))).status,200);
  assert.equal((await post('admin/reviews',{id:review.id,version:review.version,status:'rejected'},cookieAdmin)).status,409);
 });
 await t.test('editing hides the previous review, resets reply and requires fresh moderation',async()=>{
  assert.equal((await post('club/reviews',{productId:products[0].id,rating:4,text:'Atualizei minha avaliação.'})).status,200);
  assert.equal((await call('reviews?productId='+products[0].id)).body.count,0);assert.equal((await call(publicPhoto.slice(5))).status,404);
  review=(await call('club/feedback',{cookie:cookieA})).body.reviews[0];assert.equal(review.reply,'');
  assert.equal((await post('admin/reviews',{id:review.id,version:review.version,status:'rejected'},cookieAdmin)).status,200);
  assert.equal((await call('reviews?productId='+products[0].id)).body.count,0);
  assert.equal((await post('club/reviews',{productId:products[0].id,rating:4,text:'Impressão excelente e fácil.',removePhoto:true})).status,200);
  const own=(await call('club/feedback',{cookie:cookieA})).body;assert.equal(own.reviews.length,1);review=own.reviews[0];assert.equal(review.photoUrl,null);
  await post('admin/reviews',{id:review.id,version:review.version,status:'approved'},cookieAdmin);
  assert.equal((await call('reviews?productId='+products[0].id)).body.average,4);
 });
 await t.test('every piece in a bundle is eligible; invalid content and non-orders are rejected',async()=>{
  for(const p of products.slice(1))assert.equal((await post('club/reviews',{productId:p.id,rating:5,text:'Excelente peça desta coleção.'})).status,200);
  assert.equal((await post('club/reviews',{productId:products[0].id,rating:6,text:'Texto inválido'})).status,400);
  assert.equal((await post('club/reviews',{productId:products[0].id,rating:3,text:'Texto inválido',photo:'data:image/svg+xml;base64,PHN2Zz4='})).status,400);
  assert.equal((await post('club/reviews',{productId:products[0].id,rating:3,text:'Texto inválido',photo:'data:image/png;base64,bm90IGFuIGltYWdl'})).status,400);
  assert.equal((await post('club/reviews',{productId:products[0].id,rating:3,text:'x'.repeat(2001)})).status,400);
  assert.equal((await post('club/reviews',{productId:products[0].id,orderId:randomUUID(),rating:3,text:'Não pode usar pedido falso'})).status,403);
 });
 await t.test('private threads and attachments cannot be read or modified by other buyers',async()=>{
  const result=await post('club/messages',{productId:products[0].id,orderId:order.id,text:'O encaixe pode ser ajustado?',photo:image});assert.equal(result.status,200);
  thread=(await call('club/feedback',{cookie:cookieA})).body.threads[0];privatePhoto=thread.messages[0].photoUrl;
  assert.equal(thread.orderId,order.id);assert.equal(thread.status,'received');assert.equal((await call('club/feedback',{cookie:cookieB})).body.threads.length,0);
  assert.equal((await post('club/messages',{threadId:thread.id,text:'Tentando acessar conversa alheia'},cookieB)).status,404);
  assert.equal((await post('club/messages/read',{id:thread.id,version:thread.version},cookieB)).status,404);
  assert.equal((await call(privatePhoto.slice(5))).status,404);assert.equal((await call(privatePhoto.slice(5),{cookie:cookieB})).status,404);
  assert.equal((await call(privatePhoto.slice(5),{cookie:cookieA})).status,200);assert.equal((await call(privatePhoto.slice(5),{cookie:cookieAdmin})).status,200);
  assert.ok(!JSON.stringify((await call('reviews?productId='+products[0].id)).body).includes('encaixe'));
 });
 await t.test('creator replies, statuses and unread markers work without public exposure',async()=>{
  assert.equal((await post('admin/messages',{id:thread.id,version:thread.version,status:'reviewing',text:'Vou analisar esse encaixe.',photo:image},cookieAdmin)).status,200);
  const old=thread;thread=(await call('club/feedback',{cookie:cookieA})).body.threads[0];assert.equal(thread.status,'reviewing');assert.equal(thread.unread,true);assert.equal(thread.messages.at(-1).sender,'creator');
  await post('club/messages/read',{id:thread.id,version:old.version});assert.equal((await call('club/feedback',{cookie:cookieA})).body.threads[0].unread,true);
  await post('club/messages/read',{id:thread.id,version:thread.version});assert.equal((await call('club/feedback',{cookie:cookieA})).body.threads[0].unread,false);
  assert.equal((await post('admin/messages',{id:thread.id,version:old.version,status:'resolved',text:'Resposta desatualizada'},cookieAdmin)).status,409);
  assert.equal((await post('admin/messages',{id:thread.id,version:thread.version,status:'resolved',text:'Ajuste disponível. Obrigado!'},cookieAdmin)).status,200);
  assert.equal((await post('club/messages',{threadId:thread.id,text:'Obrigada, vou verificar agora.'})).status,200);
  thread=(await call('club/feedback',{cookie:cookieA})).body.threads[0];assert.equal(thread.status,'received');assert.equal(thread.unread,false);
 });
 await t.test('feedback never mutates purchases, downloads or licenses',async()=>{
  assert.deepEqual((await readRecord('commerce.json')).data,originalCommerce);
  assert.equal((await purchaseLicenses(a)).filter(l=>l.status==='active').length,5);
  for(const p of products)assert.equal(await purchaseAccess(a,p.id),true);
  const storefront=await shop(a);assert.equal(storefront.products.filter(p=>p.downloadUrl&&products.some(x=>x.id===p.id)).length,5);
 });
 await t.test('refund removes public review and eligibility but preserves private support',async()=>{
  await updateRecord('commerce.json',s=>{s.orders[0].status='refunded';return s;});
  assert.equal((await call('reviews?productId='+products[0].id)).body.count,0);
  const own=(await call('club/feedback',{cookie:cookieA})).body;assert.equal(own.products.length,0);assert.equal(own.threads.length,1);
  assert.equal((await post('club/reviews',{productId:products[0].id,rating:1,text:'Já não tenho compra ativa.'})).status,403);
  const r=own.reviews[0];assert.equal((await post('admin/reviews',{id:r.id,version:r.version,status:'approved'},cookieAdmin)).status,409);
  assert.equal((await post('club/messages',{threadId:thread.id,text:'Preciso tirar uma dúvida sobre o pedido.'})).status,200);
 });
 await t.test('test-environment payments cannot authorize production reviews',async()=>{
  await updateRecord('commerce.json',s=>{s.orders[0].status='paid';s.orders[0].environment='production';return s;});
  assert.equal((await call('club/feedback',{cookie:cookieA})).body.products.length,0);
  assert.equal((await call('reviews?productId='+products[0].id)).body.count,0);
 });
 }finally{for(const [k,v] of Object.entries(env)){if(v===undefined)delete process.env[k];else process.env[k]=v;}await rm(dir,{recursive:true,force:true});}
});
test('feedback copy is available in all four site languages',()=>{for(const lang of ['en','es','fr'])assert.deepEqual(Object.keys(feedbackCopies[lang]).sort(),Object.keys(feedbackCopies.pt).sort());});
