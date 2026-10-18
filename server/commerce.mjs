import {countProductSales,soldQuantity} from './product-sales.mjs';
import {validBillingDocument,BILLING_DOCUMENT_ERROR} from '../lib/billing-document.mjs';
import {hasProductFiles,publicPrintProfiles} from '../lib/print-profiles.mjs';
import {cartSchema} from '../lib/cart-schema.mjs';
import {FAMILY_COLLECTION_ID} from '../lib/family-discount.mjs';
import {checkoutFingerprint} from './checkout-fingerprint.mjs';
import {collectionCover} from '../lib/collection-covers.mjs';
import {internationalBuyer,marketCatalog,paypalApprovalUrl} from '../lib/international-pricing.mjs';
import {currentOrderEnvironment} from './payment-environment.mjs';
import {paypalReady} from './paypal.mjs';
import {checkoutPaypal,refreshPaypal,marketCoupons} from './paypal-commerce.mjs';
import {downloadPartners,addPartnerDownload} from './download-history.mjs';
import {sendPurchaseEmail,purchaseEmailConfig} from './purchase-email.mjs';
import {cartCoupons,couponCodeSchema,discountQuote} from './cart-coupons.mjs';
import {randomUUID,timingSafeEqual} from 'node:crypto';
import {z} from 'zod';
import {getCatalog,readRecord,updateRecord} from './store.mjs';
import {asaas,asaasConfig,invoiceUrl,paymentReturnUrl,paymentsReady} from './asaas.mjs';

const KEY='commerce.json';
export const purchaseLicenseTerms='Autorizada a impressão e venda das peças físicas desta obra pelo parceiro identificado, enquanto esta compra estiver válida. Licença pessoal e intransferível. Não autoriza revender, compartilhar ou redistribuir os arquivos digitais.';
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
const id=z.string().regex(/^[a-z0-9][a-z0-9-]{0,99}$/);
const state=old=>old||{orders:[],downloads:{},recentDownloads:[]};
const paid=o=>o.status==='paid'&&currentOrderEnvironment(o);
export const isPaidProduct=p=>p.access==='paid'||Number(p.priceCents)>0;
export const canPurchaseProduct=(p,data)=>Boolean(p.published&&!p.exclusive&&p.access==='paid'&&hasProductFiles(p)&&p.priceCents>0&&data.collections.some(c=>c.id===p.collection&&c.published&&!c.free));
export function ownedIds(orders,memberId){return new Set(orders.filter(o=>o.memberId===memberId&&paid(o)).flatMap(o=>o.productIds));}
export function quoteCart(data,input,owned=new Set()){
 const selections=cartSchema.parse(input),seen=new Set(),included=new Set(),items=[];
 // A collection supersedes its individual pieces in the same basket.
 for(const selection of [...selections].sort((a,b)=>Number(b.kind==='collection')-Number(a.kind==='collection'))){
  const key=selection.kind+':'+selection.id;if(seen.has(key))continue;seen.add(key);
  if(selection.kind==='collection'){
   if(selection.quantity!==1)fail('A coleção completa permite apenas uma unidade por compra.');
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
   if(selection.quantity!==1&&p.collection!==FAMILY_COLLECTION_ID)fail('Esta peça permite apenas uma unidade por compra.');
   included.add(p.id);items.push({kind:'product',id:p.id,name:p.name,collection:p.collection,quantity:selection.quantity,unitPriceCents:p.priceCents,priceCents:p.priceCents*selection.quantity,products:[{id:p.id,name:p.name}]});
  }
 }
 items.sort((a,b)=>(a.kind+a.id).localeCompare(b.kind+b.id));
 const totalCents=items.reduce((n,i)=>n+i.priceCents,0);
 if(!Number.isSafeInteger(totalCents)||totalCents<=0||totalCents>10_000_000)fail('Valor de compra inválido.');
 return {items,totalCents,productIds:[...included].sort(),overlap:[...included].filter(x=>owned.has(x))};
}
export function safeOrder(o){return {provider:o.provider||'asaas',currency:o.currency||'BRL',id:o.id,createdAt:o.createdAt,status:o.status,totalCents:o.totalCents,subtotalCents:o.subtotalCents??o.totalCents,discountCents:o.discountCents||0,coupon:o.coupon||null,couponDiscountCents:o.couponDiscountCents??(o.coupon?o.discountCents:0),promotion:o.promotion||null,items:o.items,productIds:o.productIds,billingType:o.billingType,paymentUrl:o.provider==='paypal'?paypalApprovalUrl(o.paymentUrl,o.environment):invoiceUrl(o.paymentUrl),paidAt:o.paidAt||null,dueDate:o.dueDate||null,licenses:paid(o)?(o.licenses||[]).map(l=>({code:l.code,productId:l.productId,downloadUrl:`/api/club/licenses/download?code=${encodeURIComponent(l.code)}`})):[]};}
export async function shop(member){
 const [{data:baseData},record]=await Promise.all([getCatalog(),readRecord(KEY)]),currency=internationalBuyer(member)?'USD':'BRL',data=marketCatalog(baseData,currency),orders=state(record?.data).orders,owned=ownedIds(orders,member.id);
 const products=data.products.filter(p=>canPurchaseProduct(p,data)||owned.has(p.id)&&p.published&&!p.exclusive&&['site','paid'].includes(p.access)&&hasProductFiles(p)&&data.collections.some(c=>c.id===p.collection&&c.published)).map(p=>({id:p.id,name:p.name,translations:p.translations,image:p.image,collection:p.collection,priceCents:p.priceCents,owned:owned.has(p.id),printProfiles:publicPrintProfiles(p,owned.has(p.id)),downloadUrl:owned.has(p.id)?`/api/download?id=${encodeURIComponent(p.id)}`:null}));
 const collections=data.collections.filter(c=>c.published&&!c.free&&!c.comingSoon&&c.priceCents>0).flatMap(c=>{const members=data.products.filter(p=>p.collection===c.id&&p.published);return members.length&&members.every(p=>canPurchaseProduct(p,data))?[{id:c.id,name:c.name,translations:c.translations,image:collectionCover(c),priceCents:c.priceCents,productIds:members.map(p=>p.id),owned:members.every(p=>owned.has(p.id))}]:[]});
 return {products,collections,orders:orders.filter(o=>o.memberId===member.id&&currentOrderEnvironment(o)).map(safeOrder).reverse(),currency,paymentProvider:currency==='USD'?'paypal':'asaas',paymentsReady:currency==='USD'?paypalReady():paymentsReady()};
}
export async function memberOwnedIds(member){return ownedIds(state((await readRecord(KEY))?.data).orders,member.id);}
export async function purchaseAccess(member,productId){return (await memberOwnedIds(member)).has(productId);}
export async function quoteCheckout(member,input){
 const [{data},coupons,owned]=await Promise.all([getCatalog(),cartCoupons(),memberOwnedIds(member)]);
 const currency=internationalBuyer(member)?'USD':'BRL';return {...discountQuote({...quoteCart(marketCatalog(data,currency),input.items,owned),currency},input.couponCode,marketCoupons(coupons.coupons,currency)),currency};
}
export async function checkout(member,input){
 if(internationalBuyer(member))return checkoutPaypal(member,input);
 if(!paymentsReady())fail('Os pagamentos ainda não estão configurados.',503);
 const cpfCnpj=String(member.cpfCnpj||'').replace(/\D/g,'');
 if(!validBillingDocument(cpfCnpj))throw Object.assign(Error(BILLING_DOCUMENT_ERROR),{status:400,code:'BILLING_DOCUMENT_INVALID',uncertain:false});
 const parsed=z.object({items:cartSchema,requestId:z.string().uuid(),billingType:z.enum(['PIX','BOLETO','CREDIT_CARD']),couponCode:couponCodeSchema.default(''),expectedTotalCents:z.number().int().positive().optional(),acceptOverlap:z.boolean().default(false),lang:z.enum(['pt','en','es','fr']).default('pt')}).parse(input);
 const {data}=await getCatalog(),environment=asaasConfig().environment,coupons=await cartCoupons();
 const orderId=randomUUID();let chosenId;
 await updateRecord(KEY,old=>{
  const s=state(old),existing=s.orders.find(o=>o.memberId===member.id&&o.provider!=='paypal'&&o.environment===environment&&o.requestId===parsed.requestId);
  if(existing){chosenId=existing.id;return s;}
  const quote=discountQuote(quoteCart(data,parsed.items,ownedIds(s.orders,member.id)),parsed.couponCode,coupons.coupons);
  if((parsed.couponCode||quote.promotion||parsed.expectedTotalCents!==undefined)&&parsed.expectedTotalCents!==quote.totalCents)fail('O desconto mudou. Confira o total atualizado antes de pagar.',409);
  if(quote.overlap.length&&!parsed.acceptOverlap)fail('Você já possui parte da coleção. Confirme a compra pelo valor integral, sem abatimento.',409);
  const fingerprint=checkoutFingerprint(quote);
  const pending=s.orders.find(o=>o.memberId===member.id&&o.provider!=='paypal'&&o.environment===environment&&o.fingerprint===fingerprint&&['creating','pending','overdue','review'].includes(o.status));
  if(pending){chosenId=pending.id;return s;}
  chosenId=orderId;s.orders.push({id:orderId,requestId:parsed.requestId,memberId:member.id,memberName:member.name,memberEmail:member.email,createdAt:new Date().toISOString(),status:'creating',provider:'asaas',currency:'BRL',environment,billingType:parsed.billingType,lang:parsed.lang,paymentReturnUrl:parsed.billingType==='CREDIT_CARD'?paymentReturnUrl(orderId,parsed.lang):'',fingerprint,...quote});return s;
 });
 if(chosenId!==orderId){const existing=state((await readRecord(KEY))?.data).orders.find(o=>o.id===chosenId);return existing.billingType==='CREDIT_CARD'&&['pending','overdue'].includes(existing.status)?(await paymentDetails(member,chosenId)).order:safeOrder(existing);}
 let paymentAttempted=false;
 try{
  const ref=`tiolira:${member.id}`,customers=await asaas(`/customers?externalReference=${encodeURIComponent(ref)}&limit=100`);
  let customer=customers.data?.find(c=>c.externalReference===ref&&String(c.cpfCnpj).replace(/\D/g,'')===cpfCnpj);
  if(!customer)customer=await asaas('/customers',{method:'POST',body:{name:member.name,email:member.email,cpfCnpj,externalReference:ref,notificationDisabled:true}});
  if(!customer.id)fail('Cadastro de pagamento indisponível.',502);
  const s=await updateRecord(KEY,old=>{old.orders.find(o=>o.id===orderId).customerId=customer.id;return old;});
  const order=s.orders.find(o=>o.id===orderId),dueDate=new Date(Date.now()+3*86400000).toISOString().slice(0,10);
  // Persist the intent before the single POST. Ambiguous results are reconciled by reference, never blindly retried.
  paymentAttempted=true;
  const returnUrl=order.paymentReturnUrl;
  const payment=await asaas('/payments',{method:'POST',body:{customer:customer.id,billingType:parsed.billingType,value:order.totalCents/100,dueDate,externalReference:orderId,description:`Tio Lira — ${order.items.map(i=>i.name).join(', ')}`.slice(0,500),...(returnUrl?{callback:{successUrl:returnUrl,autoRedirect:true}}:{})}});
  await applyPayment(orderId,payment);
 }catch(e){
  if(!paymentAttempted||e.uncertain===false)await updateRecord(KEY,old=>{const o=old.orders.find(o=>o.id===orderId);if(o.status==='creating')o.status='failed';return old;});
  throw e;
 }
 // A mail outage must never turn a successful payment into a checkout error.
 await sendPurchaseEmail(orderId).catch(()=>{});
 return safeOrder(state((await readRecord(KEY))?.data).orders.find(o=>o.id===orderId));
}
export async function applyPayment(orderId,payment,eventId){
 if(typeof payment?.id!=='string'||!/^pay_[\w-]+$/.test(payment.id))fail('Cobrança inválida.',502);
 return updateRecord(KEY,old=>{
  const s=state(old),o=s.orders.find(o=>o.id===orderId);if(!o)fail('Pedido não encontrado.',404);
  if(o.provider==='paypal'||o.environment!==asaasConfig().environment||payment.externalReference!==o.id||payment.customer!==o.customerId||(o.paymentId&&payment.id!==o.paymentId))fail('Cobrança não corresponde ao pedido.',409);
  const revoked=['REFUNDED','REFUND_REQUESTED','REFUND_IN_PROGRESS','CHARGEBACK_REQUESTED','CHARGEBACK_DISPUTE','AWAITING_CHARGEBACK_REVERSAL'].includes(payment.status)||(payment.refunds||[]).some(r=>r.status!=='CANCELLED');
  // A refund may change the remaining value. Revoke an already bound payment even then;
  // every new payment or grant still requires the original full amount.
  const cents=Math.round(Number(payment.value)*100);if(cents!==o.totalCents&&!(revoked&&o.paymentId===payment.id))fail('Valor da cobrança não corresponde ao pedido.',409);
  if(eventId&&o.events?.includes(eventId))return s;
  let next=revoked?'revoked':payment.deleted?'cancelled':['CONFIRMED','RECEIVED'].includes(payment.status)?'paid':['REPROVED_BY_RISK_ANALYSIS','CREDIT_CARD_CAPTURE_REFUSED'].includes(payment.status)?'failed':payment.status==='AWAITING_RISK_ANALYSIS'?'review':payment.status==='OVERDUE'?'overdue':'pending';
  // Revocation is sticky; delayed pre-payment events cannot remove a paid entitlement.
  if(o.status==='revoked')next='revoked';else if(o.status==='paid'&&['pending','overdue'].includes(next))next='paid';
  const firstApproval=next==='paid'&&o.status!=='paid'&&!o.paidAt;
  o.status=next;o.paymentId=payment.id;o.paymentUrl=invoiceUrl(payment.invoiceUrl);o.updatedAt=new Date().toISOString();o.dueDate=payment.dueDate||o.dueDate;
  if(next==='paid'){
   if(!o.paidAt)o.paidAt=o.updatedAt;
   if(firstApproval)o.purchaseEmail={status:'pending',createdAt:o.paidAt};
   // Licenses and entitlements commit atomically with the verified payment.
   if(!o.licenses)o.licenses=o.items.flatMap(i=>i.products).map(p=>({code:`TL-COMPRA-${randomUUID().toUpperCase()}`,orderId:o.id,memberId:o.memberId,partnerName:o.memberName,productId:p.id,productName:p.name,issuedAt:o.paidAt,terms:purchaseLicenseTerms,source:'purchase'}));
  }
  if(eventId)o.events=[...(o.events||[]),eventId];return s;
 });
}
export async function refreshOrder(member,orderId){
 const o=state((await readRecord(KEY))?.data).orders.find(o=>o.id===orderId&&o.memberId===member.id);if(!o)fail('Pedido não encontrado.',404);
 if(o.provider==='paypal')return refreshPaypal(member,orderId);
 if(o.environment!==asaasConfig().environment)fail('Pedido de outro ambiente.',409);
 let payment;
 if(o.paymentId)payment=await asaas(`/payments/${encodeURIComponent(o.paymentId)}`);
 else{const result=await asaas(`/payments?externalReference=${encodeURIComponent(o.id)}&limit=100`);if(result.data?.length>1)fail('Mais de uma cobrança encontrada. Contate o suporte.',409);payment=result.data?.[0];}
 if(payment)await applyPayment(o.id,payment);
 await sendPurchaseEmail(o.id).catch(()=>{});
 return safeOrder(state((await readRecord(KEY))?.data).orders.find(x=>x.id===o.id));
}
export function assertWebhook(req){
 const expected=process.env.ASAAS_WEBHOOK_TOKEN,received=req.headers['asaas-access-token'];
 if(typeof expected!=='string'||expected.length<32||typeof received!=='string')fail('Webhook não autorizado.',401);
 const a=Buffer.from(expected),b=Buffer.from(received);if(a.length!==b.length||!timingSafeEqual(a,b))fail('Webhook não autorizado.',401);
}
export async function receiveWebhook(input,{emailRequired=false}={}){
 const notify=id=>sendPurchaseEmail(id).catch(e=>{if(emailRequired)throw e;});
 const event=z.object({id:z.string().min(1).max(300),event:z.string().max(100),payment:z.object({id:z.string().regex(/^pay_[\w-]+$/),externalReference:z.string().optional()}).passthrough()}).parse(input);
 const orders=state((await readRecord(KEY))?.data).orders,o=orders.find(o=>o.paymentId===event.payment.id||o.id===event.payment.externalReference);
 if(!o||o.provider==='paypal'||o.environment!==asaasConfig().environment)return;
 if(o.events?.includes(event.id)){await notify(o.id);return;}
 const payment=await asaas(`/payments/${encodeURIComponent(event.payment.id)}`);
 await applyPayment(o.id,payment,event.id);
 // Only the separate email webhook retries mail failures; the payment queue stays healthy.
 await notify(o.id);
}
export async function recordDownload(member,product){
 const event={productId:product.id,productName:product.name,memberId:member.id,memberName:member.name,at:new Date().toISOString()};
 await updateRecord(KEY,old=>{
  const s=state(old);s.downloadPartners=downloadPartners(s);
  addPartnerDownload(s.downloadPartners,event);
  s.downloads[product.id]=(s.downloads[product.id]||0)+1;
  s.recentDownloads=[event,...s.recentDownloads].slice(0,500);return s;
 });
}
export async function downloadPartnersReport(productId){
 id.parse(productId);
 const [record,catalog,membersRecord]=await Promise.all([readRecord(KEY),getCatalog(),readRecord('club-members.json')]);
 const s=state(record?.data),product=catalog.data.products.find(p=>p.id===productId);
 if(!product&&!Object.hasOwn(s.downloads,productId))fail('Obra não encontrada.',404);
 const members=new Map((membersRecord?.data?.members||[]).map(member=>[member.id,member]));
 const partners=downloadPartners(s).filter(p=>p.productId===productId).map(p=>{
  const member=members.get(p.memberId);
  return {memberId:p.memberId,memberName:member?.name||p.memberName||'Parceiro sem nome',memberEmail:member?.email||'',downloads:p.downloads,firstAt:p.firstAt,lastAt:p.lastAt};
 }).sort((a,b)=>b.lastAt.localeCompare(a.lastAt)||a.memberName.localeCompare(b.memberName,'pt-BR'));
 const totalDownloads=s.downloads[productId]||0,identifiedDownloads=partners.reduce((total,p)=>total+p.downloads,0);
 return {productId,totalDownloads,identifiedDownloads,unattributedDownloads:Math.max(0,totalDownloads-identifiedDownloads),partners};
}
export async function productSalesSummary(){
 return {products:countProductSales((await readRecord(KEY))?.data?.orders||[])};
}
export async function salesReport(){
 const s=state((await readRecord(KEY))?.data),{data}=await getCatalog(),rows=new Map(data.products.map(p=>[p.id,{id:p.id,name:p.name,individualSales:0,collectionSales:0,revenueCents:0,revenueUsdCents:0,downloads:s.downloads[p.id]||0}]));
 for(const o of s.orders.filter(paid))for(const item of o.items)item.products.forEach((p,i)=>{if(!rows.has(p.id))rows.set(p.id,{...p,individualSales:0,collectionSales:0,revenueCents:0,revenueUsdCents:0,downloads:s.downloads[p.id]||0});const row=rows.get(p.id);row[item.kind==='collection'?'collectionSales':'individualSales']+=soldQuantity(item);row[o.currency==='USD'?'revenueUsdCents':'revenueCents']+=Math.floor((item.totalCents??item.priceCents)/item.products.length)+(i<(item.totalCents??item.priceCents)%item.products.length?1:0);});
 return {purchaseEmailReady:Boolean(purchaseEmailConfig()),paymentsReady:paymentsReady(),environment:asaasConfig().environment,paypalReady:paypalReady(),totalUsdCents:s.orders.filter(o=>paid(o)&&o.currency==='USD').reduce((n,o)=>n+o.totalCents,0),totalCents:s.orders.filter(o=>paid(o)&&o.currency!=='USD').reduce((n,o)=>n+o.totalCents,0),paidOrders:s.orders.filter(paid).length,products:[...rows.values()],orders:s.orders.filter(currentOrderEnvironment).map(o=>({...safeOrder(o),memberName:o.memberName,memberEmail:o.memberEmail,purchaseEmailStatus:o.purchaseEmail?.status||null,purchaseEmailSentAt:o.purchaseEmail?.sentAt||null})).reverse(),recentDownloads:s.recentDownloads};
}

export async function purchaseLicenses(member){
 const orders=state((await readRecord(KEY))?.data).orders;
 return orders.filter(o=>o.memberId===member.id&&currentOrderEnvironment(o)).flatMap(o=>(o.licenses||[]).map(l=>({...l,status:paid(o)?'active':'suspended'})));
}
export async function paymentDetails(member,orderId){
 const order=await refreshOrder(member,orderId);
 if(order.provider==='paypal'||!['pending','overdue'].includes(order.status))return {order};
 const o=state((await readRecord(KEY))?.data).orders.find(o=>o.id===order.id);
 if(!o.paymentId)return {order};
 if(o.billingType==='CREDIT_CARD'){
  const returnUrl=paymentReturnUrl(o.id,o.lang||'pt');
  if(returnUrl&&o.paymentReturnUrl!==returnUrl){
   // Upgrade only this existing invoice's navigation; never create or re-charge it.
   const payment=await asaas(`/payments/${encodeURIComponent(o.paymentId)}`,{method:'PUT',body:{callback:{successUrl:returnUrl,autoRedirect:true}}});
   await applyPayment(o.id,payment);
   const updated=await updateRecord(KEY,old=>{old.orders.find(item=>item.id===o.id).paymentReturnUrl=returnUrl;return old;});
   return {order:safeOrder(updated.orders.find(item=>item.id===o.id))};
  }
 }
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

export async function downloadablePurchaseLicense(member,code){
 const license=(await purchaseLicenses(member)).find(l=>l.code===code&&l.status==='active');
 if(!license)fail('Licença não disponível. Confira a confirmação do pagamento em Meus pedidos.',404);
 return license;
}
