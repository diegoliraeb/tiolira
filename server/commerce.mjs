import {createHash,randomUUID,timingSafeEqual} from 'node:crypto';
import {z} from 'zod';
import {isIP} from 'node:net';
import {getCatalog,readRecord,updateRecord} from './store.mjs';
import {asaas,asaasConfig,invoiceUrl,paymentsReady} from './asaas.mjs';

const KEY='commerce.json';
export const purchaseLicenseTerms='Autorizada a impressão e venda das peças físicas desta obra pelo parceiro identificado, enquanto esta compra estiver válida. Licença pessoal e intransferível. Não autoriza revender, compartilhar ou redistribuir os arquivos digitais.';
const digits=z.string().max(30).transform(s=>s.replace(/\D/g,''));
const cardSchema=z.object({holderName:z.string().trim().min(3).max(100),number:digits.pipe(z.string().regex(/^\d{13,19}$/)),expiryMonth:z.string().regex(/^(0[1-9]|1[0-2])$/),expiryYear:z.string().regex(/^20\d{2}$/),ccv:z.string().regex(/^\d{3,4}$/)}).refine(c=>{const now=new Date();return Number(c.expiryYear)>now.getUTCFullYear()||Number(c.expiryYear)===now.getUTCFullYear()&&Number(c.expiryMonth)>=now.getUTCMonth()+1},'Cartão vencido.');
const holderSchema=z.object({name:z.string().trim().min(3).max(100),email:z.email().max(254),cpfCnpj:digits.pipe(z.string().regex(/^(\d{11}|\d{14})$/)),postalCode:digits.pipe(z.string().regex(/^\d{8}$/)),addressNumber:z.string().trim().min(1).max(20),phone:digits.pipe(z.string().regex(/^\d{10,11}$/))});
export function paymentContext(req){
 const remoteIp=process.env.VERCEL?String(req.headers['x-forwarded-for']||'').split(',')[0].trim():req.socket?.remoteAddress;
 const secure=process.env.VERCEL?req.headers['x-forwarded-proto']==='https':Boolean(req.socket?.encrypted);
 return {remoteIp,secure};
}

const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
const id=z.string().regex(/^[a-z0-9][a-z0-9-]{0,99}$/);
const cartSchema=z.array(z.object({kind:z.enum(['product','collection']),id})).min(1).max(40);
const state=old=>old||{orders:[],downloads:{},recentDownloads:[]};
const paid=o=>o.status==='paid'&&o.environment===asaasConfig().environment;
export const isPaidProduct=p=>p.access==='paid'||Number(p.priceCents)>0;
export const canPurchaseProduct=(p,data)=>Boolean(p.published&&!p.exclusive&&p.access==='paid'&&p.filePath&&p.priceCents>0&&data.collections.some(c=>c.id===p.collection&&c.published&&!c.free));
export function ownedIds(orders,memberId){return new Set(orders.filter(o=>o.memberId===memberId&&paid(o)).flatMap(o=>o.productIds));}
export function quoteCart(data,input,owned=new Set()){
 const selections=cartSchema.parse(input),seen=new Set(),included=new Set(),items=[];
 // A collection supersedes its individual pieces in the same basket.
 for(const selection of [...selections].sort((a,b)=>Number(b.kind==='collection')-Number(a.kind==='collection'))){
  const key=selection.kind+':'+selection.id;if(seen.has(key))continue;seen.add(key);
  if(selection.kind==='collection'){
   const c=data.collections.find(c=>c.id===selection.id&&c.published&&!c.free&&!c.comingSoon&&c.priceCents>0);
   const products=data.products.filter(p=>p.collection===selection.id&&p.published);
   if(!c||!products.length||products.some(p=>!canPurchaseProduct(p,data)))fail('A coleção ainda não está disponível para compra.');
   if(products.every(p=>owned.has(p.id)))fail('Você já possui esta coleção.');
   products.forEach(p=>included.add(p.id));items.push({kind:'collection',id:c.id,name:c.name,priceCents:c.priceCents,products:products.map(p=>({id:p.id,name:p.name}))});
  }else{
   if(included.has(selection.id))continue;
   const p=data.products.find(p=>p.id===selection.id);
   if(!p||!canPurchaseProduct(p,data))fail('Uma peça do carrinho ainda não está disponível.');
   if(owned.has(p.id))fail('Você já possui uma das peças. Remova-a do carrinho.');
   included.add(p.id);items.push({kind:'product',id:p.id,name:p.name,priceCents:p.priceCents,products:[{id:p.id,name:p.name}]});
  }
 }
 items.sort((a,b)=>(a.kind+a.id).localeCompare(b.kind+b.id));
 const totalCents=items.reduce((n,i)=>n+i.priceCents,0);
 if(!Number.isSafeInteger(totalCents)||totalCents<=0||totalCents>10_000_000)fail('Valor de compra inválido.');
 return {items,totalCents,productIds:[...included].sort(),overlap:[...included].filter(x=>owned.has(x))};
}
function safeOrder(o){return {id:o.id,createdAt:o.createdAt,status:o.status,totalCents:o.totalCents,items:o.items,productIds:o.productIds,billingType:o.billingType,paymentUrl:invoiceUrl(o.paymentUrl),paidAt:o.paidAt||null,dueDate:o.dueDate||null};}
export async function shop(member){
 const [{data},record]=await Promise.all([getCatalog(),readRecord(KEY)]),orders=state(record?.data).orders,owned=ownedIds(orders,member.id);
 const products=data.products.filter(p=>canPurchaseProduct(p,data)||owned.has(p.id)&&p.published&&p.filePath).map(p=>({id:p.id,name:p.name,image:p.image,collection:p.collection,priceCents:p.priceCents,owned:owned.has(p.id),downloadUrl:owned.has(p.id)?`/api/download?id=${encodeURIComponent(p.id)}`:null}));
 const collections=data.collections.filter(c=>c.published&&!c.free&&!c.comingSoon&&c.priceCents>0).flatMap(c=>{const members=data.products.filter(p=>p.collection===c.id&&p.published);return members.length&&members.every(p=>canPurchaseProduct(p,data))?[{id:c.id,name:c.name,image:c.image,priceCents:c.priceCents,productIds:members.map(p=>p.id),owned:members.every(p=>owned.has(p.id))}]:[]});
 return {products,collections,orders:orders.filter(o=>o.memberId===member.id&&o.environment===asaasConfig().environment).map(safeOrder).reverse(),paymentsReady:paymentsReady()};
}
export async function memberOwnedIds(member){return ownedIds(state((await readRecord(KEY))?.data).orders,member.id);}
export async function purchaseAccess(member,productId){return (await memberOwnedIds(member)).has(productId);}
export async function checkout(member,input,context={}){
 if(!paymentsReady())fail('Os pagamentos ainda não estão configurados.',503);
 const parsed=z.object({items:cartSchema,requestId:z.string().uuid(),billingType:z.enum(['PIX','BOLETO','CREDIT_CARD']),cpfCnpj:z.string().transform(s=>s.replace(/\D/g,'')).pipe(z.string().regex(/^(\d{11}|\d{14})$/,'Informe CPF ou CNPJ.')),acceptOverlap:z.boolean().default(false),creditCard:cardSchema.optional(),creditCardHolderInfo:holderSchema.optional()}).parse(input);
 if(parsed.billingType==='CREDIT_CARD'){
  if(!parsed.creditCard||!parsed.creditCardHolderInfo)fail('Preencha os dados do cartão e do titular.');
  if(!isIP(context.remoteIp||''))fail('Não foi possível identificar a conexão do comprador.');
  if(asaasConfig().environment==='production'&&!context.secure)fail('O pagamento com cartão exige uma conexão HTTPS.',400);
 }
 const {data}=await getCatalog(),environment=asaasConfig().environment;
 const orderId=randomUUID();let chosenId;
 await updateRecord(KEY,old=>{
  const s=state(old),existing=s.orders.find(o=>o.memberId===member.id&&o.environment===environment&&o.requestId===parsed.requestId);
  if(existing){chosenId=existing.id;return s;}
  const quote=quoteCart(data,parsed.items,ownedIds(s.orders,member.id));
  if(quote.overlap.length&&!parsed.acceptOverlap)fail('Você já possui parte da coleção. Confirme a compra pelo valor integral, sem abatimento.',409);
  const fingerprint=createHash('sha256').update(JSON.stringify(quote.items)).digest('hex');
  const pending=s.orders.find(o=>o.memberId===member.id&&o.environment===environment&&o.fingerprint===fingerprint&&['creating','pending','overdue','review'].includes(o.status));
  if(pending){chosenId=pending.id;return s;}
  chosenId=orderId;s.orders.push({id:orderId,requestId:parsed.requestId,memberId:member.id,memberName:member.name,memberEmail:member.email,createdAt:new Date().toISOString(),status:'creating',environment,billingType:parsed.billingType,fingerprint,...quote});return s;
 });
 if(chosenId!==orderId)return safeOrder(state((await readRecord(KEY))?.data).orders.find(o=>o.id===chosenId));
 let paymentAttempted=false;
 try{
  const ref=`tiolira:${member.id}`,customers=await asaas(`/customers?externalReference=${encodeURIComponent(ref)}&limit=100`);
  let customer=customers.data?.find(c=>c.externalReference===ref&&String(c.cpfCnpj).replace(/\D/g,'')===parsed.cpfCnpj);
  if(!customer)customer=await asaas('/customers',{method:'POST',body:{name:member.name,email:member.email,cpfCnpj:parsed.cpfCnpj,externalReference:ref,notificationDisabled:true}});
  if(!customer.id)fail('Cadastro de pagamento indisponível.',502);
  const s=await updateRecord(KEY,old=>{old.orders.find(o=>o.id===orderId).customerId=customer.id;return old;});
  const order=s.orders.find(o=>o.id===orderId),dueDate=new Date(Date.now()+3*86400000).toISOString().slice(0,10);
  // Persist the intent before the single POST. Ambiguous results are reconciled by reference, never blindly retried.
  paymentAttempted=true;
  const payment=await asaas('/payments',{method:'POST',timeoutMs:parsed.billingType==='CREDIT_CARD'?65000:15000,body:{...(parsed.billingType==='CREDIT_CARD'?{creditCard:parsed.creditCard,creditCardHolderInfo:parsed.creditCardHolderInfo,remoteIp:context.remoteIp}:{}),customer:customer.id,billingType:parsed.billingType,value:order.totalCents/100,dueDate,externalReference:orderId,description:`Tio Lira — ${order.items.map(i=>i.name).join(', ')}`.slice(0,500)}});
  await applyPayment(orderId,payment);
 }catch(e){
  if(!paymentAttempted||e.uncertain===false)await updateRecord(KEY,old=>{const o=old.orders.find(o=>o.id===orderId);if(o.status==='creating')o.status='failed';return old;});
  throw e;
 }
 return safeOrder(state((await readRecord(KEY))?.data).orders.find(o=>o.id===orderId));
}
export async function applyPayment(orderId,payment,eventId){
 if(typeof payment?.id!=='string'||!/^pay_[\w-]+$/.test(payment.id))fail('Cobrança inválida.',502);
 return updateRecord(KEY,old=>{
  const s=state(old),o=s.orders.find(o=>o.id===orderId);if(!o)fail('Pedido não encontrado.',404);
  if(o.environment!==asaasConfig().environment||payment.externalReference!==o.id||payment.customer!==o.customerId||(o.paymentId&&payment.id!==o.paymentId))fail('Cobrança não corresponde ao pedido.',409);
  const revoked=['REFUNDED','REFUND_REQUESTED','REFUND_IN_PROGRESS','CHARGEBACK_REQUESTED','CHARGEBACK_DISPUTE','AWAITING_CHARGEBACK_REVERSAL'].includes(payment.status)||(payment.refunds||[]).some(r=>r.status!=='CANCELLED');
  // A refund may change the remaining value. Revoke an already bound payment even then;
  // every new payment or grant still requires the original full amount.
  const cents=Math.round(Number(payment.value)*100);if(cents!==o.totalCents&&!(revoked&&o.paymentId===payment.id))fail('Valor da cobrança não corresponde ao pedido.',409);
  if(eventId&&o.events?.includes(eventId))return s;
  let next=revoked?'revoked':payment.deleted?'cancelled':['CONFIRMED','RECEIVED'].includes(payment.status)?'paid':['REPROVED_BY_RISK_ANALYSIS','CREDIT_CARD_CAPTURE_REFUSED'].includes(payment.status)?'failed':payment.status==='AWAITING_RISK_ANALYSIS'?'review':payment.status==='OVERDUE'?'overdue':'pending';
  // Revocation is sticky; delayed pre-payment events cannot remove a paid entitlement.
  if(o.status==='revoked')next='revoked';else if(o.status==='paid'&&['pending','overdue'].includes(next))next='paid';
  o.status=next;o.paymentId=payment.id;o.paymentUrl=invoiceUrl(payment.invoiceUrl);o.updatedAt=new Date().toISOString();o.dueDate=payment.dueDate||o.dueDate;
  if(next==='paid'){
   if(!o.paidAt)o.paidAt=o.updatedAt;
   // Licenses and entitlements commit atomically with the verified payment.
   if(!o.licenses)o.licenses=o.items.flatMap(i=>i.products).map(p=>({code:`TL-COMPRA-${randomUUID().toUpperCase()}`,orderId:o.id,memberId:o.memberId,partnerName:o.memberName,productId:p.id,productName:p.name,issuedAt:o.paidAt,terms:purchaseLicenseTerms,source:'purchase'}));
  }
  if(eventId)o.events=[...(o.events||[]),eventId];return s;
 });
}
export async function refreshOrder(member,orderId){
 const o=state((await readRecord(KEY))?.data).orders.find(o=>o.id===orderId&&o.memberId===member.id);if(!o)fail('Pedido não encontrado.',404);
 if(o.environment!==asaasConfig().environment)fail('Pedido de outro ambiente.',409);
 let payment;
 if(o.paymentId)payment=await asaas(`/payments/${encodeURIComponent(o.paymentId)}`);
 else{const result=await asaas(`/payments?externalReference=${encodeURIComponent(o.id)}&limit=100`);if(result.data?.length>1)fail('Mais de uma cobrança encontrada. Contate o suporte.',409);payment=result.data?.[0];}
 if(payment)await applyPayment(o.id,payment);
 return safeOrder(state((await readRecord(KEY))?.data).orders.find(x=>x.id===o.id));
}
export function assertWebhook(req){
 const expected=process.env.ASAAS_WEBHOOK_TOKEN,received=req.headers['asaas-access-token'];
 if(typeof expected!=='string'||expected.length<32||typeof received!=='string')fail('Webhook não autorizado.',401);
 const a=Buffer.from(expected),b=Buffer.from(received);if(a.length!==b.length||!timingSafeEqual(a,b))fail('Webhook não autorizado.',401);
}
export async function receiveWebhook(input){
 const event=z.object({id:z.string().min(1).max(300),event:z.string().max(100),payment:z.object({id:z.string().regex(/^pay_[\w-]+$/),externalReference:z.string().optional()}).passthrough()}).parse(input);
 const orders=state((await readRecord(KEY))?.data).orders,o=orders.find(o=>o.paymentId===event.payment.id||o.id===event.payment.externalReference);
 if(!o||o.environment!==asaasConfig().environment)return;
 if(o.events?.includes(event.id))return;
 const payment=await asaas(`/payments/${encodeURIComponent(event.payment.id)}`);
 await applyPayment(o.id,payment,event.id);
}
export async function recordDownload(member,product){
 await updateRecord(KEY,old=>{const s=state(old);s.downloads[product.id]=(s.downloads[product.id]||0)+1;s.recentDownloads=[{productId:product.id,productName:product.name,memberId:member.id,memberName:member.name,at:new Date().toISOString()},...s.recentDownloads].slice(0,500);return s;});
}
export async function salesReport(){
 const s=state((await readRecord(KEY))?.data),{data}=await getCatalog(),rows=new Map(data.products.map(p=>[p.id,{id:p.id,name:p.name,individualSales:0,collectionSales:0,revenueCents:0,downloads:s.downloads[p.id]||0}]));
 for(const o of s.orders.filter(paid))for(const item of o.items)item.products.forEach((p,i)=>{if(!rows.has(p.id))rows.set(p.id,{...p,individualSales:0,collectionSales:0,revenueCents:0,downloads:s.downloads[p.id]||0});const row=rows.get(p.id);row[item.kind==='collection'?'collectionSales':'individualSales']++;row.revenueCents+=Math.floor(item.priceCents/item.products.length)+(i<item.priceCents%item.products.length?1:0);});
 return {paymentsReady:paymentsReady(),environment:asaasConfig().environment,totalCents:s.orders.filter(paid).reduce((n,o)=>n+o.totalCents,0),paidOrders:s.orders.filter(paid).length,products:[...rows.values()],orders:s.orders.filter(o=>o.environment===asaasConfig().environment).map(o=>({...safeOrder(o),memberName:o.memberName,memberEmail:o.memberEmail})).reverse(),recentDownloads:s.recentDownloads};
}

export async function purchaseLicenses(member){
 const orders=state((await readRecord(KEY))?.data).orders;
 return orders.filter(o=>o.memberId===member.id&&o.environment===asaasConfig().environment).flatMap(o=>(o.licenses||[]).map(l=>({...l,status:paid(o)?'active':'suspended'})));
}
export async function paymentDetails(member,orderId){
 const order=await refreshOrder(member,orderId);
 if(!['pending','overdue'].includes(order.status))return {order};
 const o=state((await readRecord(KEY))?.data).orders.find(o=>o.id===order.id);
 if(!o.paymentId)return {order};
 if(o.billingType==='PIX'){
  const pix=await asaas(`/payments/${encodeURIComponent(o.paymentId)}/pixQrCode`);
  return {order,pix:{encodedImage:typeof pix.encodedImage==='string'&&/^[A-Za-z0-9+/=]+$/.test(pix.encodedImage)&&pix.encodedImage.length<1000000?pix.encodedImage:'',payload:String(pix.payload||'').slice(0,10000),expirationDate:pix.expirationDate}};
 }
 if(o.billingType==='BOLETO'){
  const boleto=await asaas(`/payments/${encodeURIComponent(o.paymentId)}/identificationField`);
  return {order,boleto:{identificationField:String(boleto.identificationField||'').slice(0,200)}};
 }
 return {order};
}
