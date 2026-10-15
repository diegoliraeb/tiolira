import {randomUUID,createHash} from 'node:crypto';
import {z} from 'zod';
import {readRecord,updateRecord,getCatalog} from './store.mjs';
import {quoteCart,ownedIds,safeOrder,purchaseLicenseTerms} from './commerce.mjs';
import {cartCoupons,couponCodeSchema,discountQuote} from './cart-coupons.mjs';
import {paypal,paypalConfig,paypalReady,paypalReturnUrl,verifyPaypalWebhook} from './paypal.mjs';
import {marketCatalog,paypalApprovalUrl} from '../lib/international-pricing.mjs';
import {sendPurchaseEmail} from './purchase-email.mjs';
const KEY='commerce.json',fail=(m,s=409)=>{throw Object.assign(Error(m),{status:s});};
const inputSchema=z.object({items:z.array(z.object({kind:z.enum(['product','collection']),id:z.string().regex(/^[a-z0-9][a-z0-9-]{0,99}$/)})).min(1).max(40),requestId:z.string().uuid(),couponCode:couponCodeSchema.default(''),expectedTotalCents:z.number().int().positive(),acceptOverlap:z.boolean().default(false),lang:z.enum(['pt','en','es','fr']).default('pt')});
export function marketCoupons(coupons,currency){return currency==='USD'?coupons.map(c=>({...c,minimumCents:Math.round(c.minimumCents/6),...(c.type==='fixed'?{value:Math.max(1,Math.round(c.value/6))}:{})})):coupons;}
export async function checkoutPaypal(member,input){
 if(!paypalReady())fail('Pagamentos internacionais estarão disponíveis em breve.',503);
 const parsed=inputSchema.parse(input),{data}=await getCatalog(),coupons=await cartCoupons(),config=paypalConfig();
 const id=randomUUID();let chosen;
 await updateRecord(KEY,old=>{
  const s=old||{orders:[],downloads:{},recentDownloads:[]};
  const existing=s.orders.find(o=>o.memberId===member.id&&o.provider==='paypal'&&o.environment===config.environment&&o.requestId===parsed.requestId);
  if(existing){chosen=existing.id;return s;}
  const quote=discountQuote({...quoteCart(marketCatalog(data,'USD'),parsed.items,ownedIds(s.orders,member.id)),currency:'USD'},parsed.couponCode,marketCoupons(coupons.coupons,'USD'));
  if(quote.totalCents!==parsed.expectedTotalCents)fail('O preço mudou. Atualize o carrinho e confira o total em dólar.');
  if(quote.overlap.length&&!parsed.acceptOverlap)fail('Você já possui parte da coleção. Confirme o preço integral, sem abatimento.');
  const fingerprint=createHash('sha256').update(JSON.stringify({items:quote.items,coupon:quote.coupon})).digest('hex');
  const pending=s.orders.find(o=>o.memberId===member.id&&o.provider==='paypal'&&o.environment===config.environment&&o.fingerprint===fingerprint&&['creating','pending','review'].includes(o.status));
  if(pending){chosen=pending.id;return s;}
  chosen=id;
  const o={id,provider:'paypal',currency:'USD',environment:config.environment,merchantId:config.merchantId,memberId:member.id,memberName:member.name,memberEmail:member.email,requestId:parsed.requestId,lang:parsed.lang,countryCode:member.countryCode,createdAt:new Date().toISOString(),status:'creating',billingType:'PAYPAL',fingerprint,...quote};
  // The payload is immutable, including the return URL, for idempotent recovery.
  o.paypalCreateBody={intent:'CAPTURE',purchase_units:[{reference_id:id,custom_id:id,invoice_id:id,payee:{merchant_id:config.merchantId},description:('Tio Lira — '+quote.items.map(i=>i.name).join(', ')).slice(0,127),amount:{currency_code:'USD',value:(quote.totalCents/100).toFixed(2)}}],payment_source:{paypal:{experience_context:{brand_name:'Tio Lira',user_action:'PAY_NOW',shipping_preference:'NO_SHIPPING',return_url:paypalReturnUrl(o),cancel_url:paypalReturnUrl(o,true)}}}};
  s.orders.push(o);return s;
 });
 if(chosen!==id)return refreshPaypal(member,chosen);
 return refreshPaypal(member,id);
}
function matchingOrder(o,remote){
 if(o.provider!=='paypal'||o.environment!==paypalConfig().environment||!remote||!/^[A-Z0-9]{10,40}$/.test(remote.id||'')||(o.paymentId&&o.paymentId!==remote.id)||remote.intent!=='CAPTURE'||remote.purchase_units?.length!==1)fail('Pedido PayPal não corresponde à compra.');
 const unit=remote.purchase_units[0];
 if(unit.custom_id!==o.id||unit.invoice_id!==o.id||unit.reference_id!==o.id||unit.payee?.merchant_id!==o.merchantId||unit.amount?.currency_code!=='USD'||unit.amount.value!==(o.totalCents/100).toFixed(2))fail('Valor, moeda ou destinatário PayPal não corresponde ao pedido.');
 return unit;
}
export async function applyPaypalOrder(id,remote,eventId){
 return updateRecord(KEY,old=>{
  const o=old?.orders.find(x=>x.id===id);if(!o)fail('Pedido não encontrado.',404);
  const unit=matchingOrder(o,remote),captures=unit.payments?.captures||[];
  if(captures.length>1)fail('Mais de uma captura PayPal encontrada. Contate o suporte.');
  const capture=captures[0];
  if(capture&&(capture.amount?.currency_code!=='USD'||capture.amount.value!==(o.totalCents/100).toFixed(2)||!capture.id||o.captureId&&o.captureId!==capture.id))fail('Captura PayPal não corresponde ao pedido.');
  if(eventId&&o.events?.includes(eventId))return old;
  const revoked=capture&&['REFUNDED','PARTIALLY_REFUNDED'].includes(capture.status);
  let next=revoked?'revoked':capture?.status==='COMPLETED'&&remote.status==='COMPLETED'?'paid':capture?.status==='PENDING'?'review':capture&&['DECLINED','FAILED','DENIED'].includes(capture.status)?'failed':remote.status==='VOIDED'?'cancelled':'pending';
  if(o.status==='revoked')next='revoked';else if(o.status==='paid'&&['pending','review'].includes(next))next='paid';
  o.status=next;o.paymentId=remote.id;o.updatedAt=new Date().toISOString();if(capture)o.captureId=capture.id;
  const link=remote.links?.find(l=>['approve','payer-action'].includes(l.rel));if(link)o.paymentUrl=paypalApprovalUrl(link.href,o.environment);
  if(next==='paid'){
   if(!o.paidAt){o.paidAt=o.updatedAt;o.purchaseEmail={status:'pending',createdAt:o.paidAt};}
   if(!o.licenses)o.licenses=o.items.flatMap(i=>i.products).map(p=>({code:`TL-COMPRA-${randomUUID().toUpperCase()}`,orderId:o.id,memberId:o.memberId,partnerName:o.memberName,productId:p.id,productName:p.name,issuedAt:o.paidAt,terms:purchaseLicenseTerms,source:'purchase'}));
  }
  if(eventId)o.events=[...(o.events||[]),eventId];return old;
 });
}
export async function refreshPaypal(member,id,{eventId}={}){
 const o=(await readRecord(KEY))?.data.orders.find(o=>o.id===id&&o.memberId===member.id&&o.provider==='paypal');if(!o)fail('Pedido não encontrado.',404);
 if(o.environment!==paypalConfig().environment)fail('Pedido de outro ambiente.');
 if(['failed','cancelled','revoked'].includes(o.status))return safeOrder(o);
 let remote;
 if(!o.paymentId){
  // Never replay create beyond the short recovery window, to avoid a duplicate order
  // after PayPal forgets the idempotency key. The buyer must contact support then.
  if(Date.now()-Date.parse(o.createdAt)>60*60*1000)fail('Confirmação PayPal pendente. Contate o suporte antes de criar outra cobrança.');
  remote=await paypal('/v2/checkout/orders',{method:'POST',requestId:o.id,body:o.paypalCreateBody});
  await applyPaypalOrder(o.id,remote);
 }else remote=await paypal(`/v2/checkout/orders/${encodeURIComponent(o.paymentId)}`);
 matchingOrder(o,remote);
 // Approval alone is not a paid entitlement. Capture is server-side and idempotent.
 if(remote.status==='APPROVED'){
  await updateRecord(KEY,old=>{const current=old.orders.find(x=>x.id===id);if(!current.captureAttemptAt)current.captureAttemptAt=new Date().toISOString();return old;});
  const current=(await readRecord(KEY)).data.orders.find(x=>x.id===id);
  if(Date.now()-Date.parse(current.captureAttemptAt)>60*60*1000)fail('Captura PayPal pendente de conferência. Contate o suporte.');
  try{remote=await paypal(`/v2/checkout/orders/${encodeURIComponent(remote.id)}/capture`,{method:'POST',body:{},requestId:'capture-'+o.id});}
  catch(error){const latest=await paypal(`/v2/checkout/orders/${encodeURIComponent(remote.id)}`);if(latest.status!=='COMPLETED')throw error;remote=latest;}
 }
 // Capture endpoint is authoritative for refunds after an order was completed.
 const captures=remote.purchase_units?.[0]?.payments?.captures;
 if(captures?.length===1){const capture=await paypal(`/v2/payments/captures/${encodeURIComponent(captures[0].id)}`);if(capture.id!==captures[0].id)fail('Captura inválida.');captures[0]=capture;}
 const updated=await applyPaypalOrder(o.id,remote,eventId);
 await sendPurchaseEmail(o.id).catch(()=>{});
 return safeOrder(updated.orders.find(x=>x.id===o.id));
}
export async function receivePaypalWebhook(headers,raw){
 const event=await verifyPaypalWebhook(headers,raw);
 if(typeof event.id!=='string'||event.id.length>300||typeof event.event_type!=='string')fail('Evento inválido.',400);
 const resource=event.resource||{},orders=(await readRecord(KEY))?.data.orders||[];
 let orderId=resource.supplementary_data?.related_ids?.order_id;
 if(event.event_type==='CHECKOUT.ORDER.APPROVED')orderId=resource.id;
 let captureId=resource.supplementary_data?.related_ids?.capture_id;
 if(event.event_type.startsWith('PAYMENT.CAPTURE.')&&event.event_type!=='PAYMENT.CAPTURE.REFUNDED')captureId=resource.id;
 if(event.event_type==='PAYMENT.CAPTURE.REFUNDED'){
  for(const l of resource.links||[]){try{const u=new URL(l.href);if(l.rel==='up'&&u.origin===paypalConfig().base&&/^\/v2\/payments\/captures\/[A-Z0-9]+$/.test(u.pathname))captureId=u.pathname.split('/').pop();}catch{}}
 }
 const disputedIds=(resource.disputed_transactions||[]).map(x=>x.seller_transaction_id);
 const o=orders.find(o=>o.provider==='paypal'&&o.environment===paypalConfig().environment&&(orderId&&o.paymentId===orderId||captureId&&o.captureId===captureId||o.captureId&&disputedIds.includes(o.captureId)||event.event_type==='CHECKOUT.ORDER.APPROVED'&&!o.paymentId&&resource.purchase_units?.[0]?.custom_id===o.id));
 if(!o)return;
 if(['PAYMENT.CAPTURE.REFUNDED','PAYMENT.CAPTURE.REVERSED','CUSTOMER.DISPUTE.CREATED'].includes(event.event_type)){
  // A signed refund/dispute tied to this capture suspends access, even if the
  // order API still returns its original COMPLETED status. Revocation is sticky.
  await updateRecord(KEY,old=>{const current=old.orders.find(x=>x.id===o.id);current.status='revoked';current.updatedAt=new Date().toISOString();current.events=[...new Set([...(current.events||[]),event.id])];return old;});return;
 }
 if(!['CHECKOUT.ORDER.APPROVED','PAYMENT.CAPTURE.COMPLETED','PAYMENT.CAPTURE.PENDING','PAYMENT.CAPTURE.DENIED'].includes(event.event_type))return;
 if(!o.paymentId&&orderId){const remote=await paypal(`/v2/checkout/orders/${encodeURIComponent(orderId)}`);await applyPaypalOrder(o.id,remote);}
 await refreshPaypal({id:o.memberId},o.id,{eventId:event.id});
 // Webhook retry also retries a failed email without duplicating licenses.
 await sendPurchaseEmail(o.id);
}
