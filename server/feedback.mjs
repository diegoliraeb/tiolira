import {randomUUID} from 'node:crypto';
import sharp from 'sharp';
import {z} from 'zod';
import {getCatalog,readRecord,updateRecord,writeRecord,Conflict} from './store.mjs';
import {currentOrderEnvironment} from './payment-environment.mjs';

const KEY='feedback.json';
const empty=()=>({reviews:[],threads:[]});
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
const id=z.string().min(1).max(100);
const photo=z.string().max(2_800_000).optional();
const reviewSchema=z.object({productId:id,orderId:id.optional(),rating:z.number().int().min(1).max(5),text:z.string().trim().min(5).max(2000),photo,removePhoto:z.boolean().optional()});
const messageSchema=z.object({threadId:z.string().uuid().optional(),productId:id.optional(),orderId:id.optional(),text:z.string().trim().min(5).max(4000),photo});
const paid=o=>o.status==='paid'&&currentOrderEnvironment(o);
const includes=(o,productId)=>o.productIds?.includes(productId)&&o.items?.some(i=>i.products?.some(p=>p.id===productId));
async function context(){const [record,commerce,{data}]=await Promise.all([readRecord(KEY),readRecord('commerce.json'),getCatalog()]);return {state:record?.data||empty(),orders:commerce?.data?.orders||[],catalog:data};}
function validOrder(orders,memberId,productId,orderId){return orders.find(o=>o.memberId===memberId&&(!orderId||o.id===orderId)&&paid(o)&&includes(o,productId));}
function verified(review,orders){return Boolean(validOrder(orders,review.memberId,review.productId,review.orderId));}
const photoUrl=id=>id?`/api/feedback/photo?id=${encodeURIComponent(id)}`:null;
function reviewView(r,privateView=false){return {id:r.id,productId:r.productId,rating:r.rating,text:r.text,author:r.author,createdAt:r.createdAt,updatedAt:r.updatedAt,photoUrl:photoUrl(r.photoId),reply:r.reply||'',...(privateView?{status:r.status,version:r.version,orderId:r.orderId}: {})};}
function threadView(t){return {id:t.id,productId:t.productId,productName:t.productName,orderId:t.orderId,status:t.status,createdAt:t.createdAt,updatedAt:t.updatedAt,version:t.version,unread:t.messages.at(-1)?.sender==='creator'&&t.memberReadVersion!==t.version,messages:t.messages.map(m=>({id:m.id,sender:m.sender,text:m.text,createdAt:m.createdAt,photoUrl:photoUrl(m.photoId)}))};}
async function savePhoto(data){
 if(!data)return null;
 const match=/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(data);
 if(!match||data.length>2_800_000)fail('Envie uma foto JPG, PNG ou WebP de até 2 MB.');
 const bytes=Buffer.from(match[2],'base64');if(bytes.length>2*1024*1024)fail('A foto deve ter até 2 MB.');
 let encoded;
 try{const image=sharp(bytes,{limitInputPixels:16_000_000,failOn:'warning'}),meta=await image.metadata();if(!['jpeg','png','webp'].includes(meta.format)||(meta.pages||1)>1)throw Error();encoded=await image.rotate().resize({width:1280,height:1280,fit:'inside',withoutEnlargement:true}).webp({quality:80}).toBuffer();if(encoded.length>600*1024)throw Error();}catch{fail('Foto inválida. Use JPG, PNG ou WebP de até 2 MB.');}
 const photoId=randomUUID();await writeRecord(`feedback-photos/${photoId}.json`,{base64:encoded.toString('base64')},null);return photoId;
}
export async function publicReviews(productId){
 id.parse(productId);const {state,orders,catalog}=await context();
 if(!catalog.products.some(p=>p.id===productId&&p.published&&catalog.collections.some(c=>c.id===p.collection&&c.published)))fail('Peça não encontrada.',404);
 const rows=state.reviews.filter(r=>r.productId===productId&&r.status==='approved'&&verified(r,orders));
 return {count:rows.length,average:rows.length?rows.reduce((s,r)=>s+r.rating,0)/rows.length:0,reviews:rows.slice().sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,50).map(r=>reviewView(r))};
}
export async function memberFeedback(member){
 const {state,orders,catalog}=await context(),pieces=new Map();
 for(const order of orders.filter(o=>o.memberId===member.id&&paid(o)))for(const item of order.items||[])for(const p of item.products||[]){if(!includes(order,p.id))continue;const product=catalog.products.find(x=>x.id===p.id);pieces.set(p.id,{id:p.id,name:product?.name||p.name,translations:product?.translations,orderId:order.id});}
 return {products:[...pieces.values()],reviews:state.reviews.filter(r=>r.memberId===member.id).map(r=>reviewView(r,true)),threads:state.threads.filter(t=>t.memberId===member.id).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)).map(threadView)};
}
export async function submitReview(member,input){
 const parsed=reviewSchema.parse(input),{orders,catalog}=await context(),order=validOrder(orders,member.id,parsed.productId,parsed.orderId);
 if(!order)fail('A avaliação está disponível somente para uma compra confirmada desta peça.',403);
 const photoId=await savePhoto(parsed.photo),now=new Date().toISOString();
 await updateRecord(KEY,old=>{const s=old||empty(),existing=s.reviews.find(r=>r.memberId===member.id&&r.productId===parsed.productId);const r={id:existing?.id||randomUUID(),memberId:member.id,orderId:order.id,productId:parsed.productId,productName:catalog.products.find(p=>p.id===parsed.productId)?.name||parsed.productId,author:String(member.name||'Comprador').trim().split(/\s+/)[0].slice(0,40),rating:parsed.rating,text:parsed.text,status:'pending',photoId:photoId||(parsed.removePhoto?null:existing?.photoId)||null,reply:'',createdAt:existing?.createdAt||now,updatedAt:now,version:randomUUID()};if(existing)s.reviews[s.reviews.indexOf(existing)]=r;else s.reviews.push(r);return s;});
 return {ok:true};
}
export async function sendMemberMessage(member,input){
 const parsed=messageSchema.parse(input),{state,orders}=await context();let existing;
 if(parsed.threadId){existing=state.threads.find(t=>t.id===parsed.threadId&&t.memberId===member.id);if(!existing)fail('Conversa não encontrada.',404);}
 const order=existing?null:validOrder(orders,member.id,parsed.productId,parsed.orderId);
 if(!existing&&!order)fail('Escolha uma peça de uma compra confirmada.',403);
 if(existing?.messages.length>=200)fail('Esta conversa atingiu o limite de mensagens. Entre em contato pelo canal de atendimento do site.',409);
 const photoId=await savePhoto(parsed.photo),now=new Date().toISOString(),newId=randomUUID();let threadId;
 await updateRecord(KEY,old=>{const s=old||empty();let t=parsed.threadId?s.threads.find(t=>t.id===parsed.threadId&&t.memberId===member.id):s.threads.find(t=>t.memberId===member.id&&t.productId===parsed.productId&&t.orderId===order.id);
 if(parsed.threadId&&!t)fail('Conversa não encontrada.',404);
 if(!t){t={id:newId,memberId:member.id,memberName:member.name,productId:parsed.productId,productName:order.items.flatMap(i=>i.products).find(p=>p.id===parsed.productId).name,orderId:order.id,status:'received',createdAt:now,messages:[]};s.threads.push(t);}
 if(t.messages.length>=200)fail('Limite de mensagens atingido.',409);
 t.messages.push({id:randomUUID(),sender:'member',text:parsed.text,photoId,createdAt:now});t.status='received';t.updatedAt=now;t.version=randomUUID();t.memberReadVersion=t.version;threadId=t.id;return s;});return {ok:true,threadId};
}
export async function readThread(member,input){
 const threadId=z.string().uuid().parse(input.id),version=z.string().uuid().parse(input.version);
 await updateRecord(KEY,old=>{const t=old?.threads.find(t=>t.id===threadId&&t.memberId===member.id);if(!t)fail('Conversa não encontrada.',404);if(t.version===version)t.memberReadVersion=version;return old;});return {ok:true};
}
export async function adminFeedback(){const {state,orders}=await context();return {reviews:state.reviews.slice().reverse().map(r=>({...reviewView(r,true),productName:r.productName,eligible:verified(r,orders)})),threads:state.threads.slice().sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)).map(t=>({...threadView(t),memberName:t.memberName}))};}
export async function moderateReview(input){
 const parsed=z.object({id:z.string().uuid(),version:z.string().uuid(),status:z.enum(['approved','rejected','pending']),reply:z.string().trim().max(2000).default('')}).parse(input);
 const {orders}=await context();await updateRecord(KEY,old=>{const r=old?.reviews.find(r=>r.id===parsed.id);if(!r)fail('Avaliação não encontrada.',404);if(r.version!==parsed.version)throw new Conflict();if(parsed.status==='approved'&&!verified(r,orders))fail('Esta compra não está mais ativa.',409);r.status=parsed.status;r.reply=parsed.reply;r.updatedAt=new Date().toISOString();r.version=randomUUID();return old;});return {ok:true};
}
export async function creatorReply(input){
 const parsed=z.object({id:z.string().uuid(),version:z.string().uuid(),status:z.enum(['received','reviewing','resolved']),text:z.string().trim().max(4000).default(''),photo}).parse(input);
 if(parsed.photo&&!parsed.text)fail('Escreva uma mensagem para acompanhar a foto.');
 const photoId=await savePhoto(parsed.photo),now=new Date().toISOString();await updateRecord(KEY,old=>{const t=old?.threads.find(t=>t.id===parsed.id);if(!t)fail('Conversa não encontrada.',404);if(t.version!==parsed.version)throw new Conflict();if(parsed.text){if(t.messages.length>=200)fail('Limite de mensagens atingido.',409);t.messages.push({id:randomUUID(),sender:'creator',text:parsed.text,photoId,createdAt:now});}t.status=parsed.status;t.updatedAt=now;t.version=randomUUID();return old;});return {ok:true};
}
export async function feedbackPhoto(photoId,{memberId,admin=false}={}){
 z.string().uuid().parse(photoId);const {state,orders,catalog}=await context();
 const r=state.reviews.find(r=>r.photoId===photoId),t=state.threads.find(t=>t.messages.some(m=>m.photoId===photoId));
 const isPublic=r&&r.status==='approved'&&verified(r,orders)&&catalog.products.some(p=>p.id===r.productId&&p.published&&catalog.collections.some(c=>c.id===p.collection&&c.published));
 if(!isPublic&&!admin&&!(memberId&&(r?.memberId===memberId||t?.memberId===memberId)))fail('Foto não encontrada.',404);
 const record=await readRecord(`feedback-photos/${photoId}.json`);if(!record)fail('Foto não encontrada.',404);return Buffer.from(record.data.base64,'base64');
}
