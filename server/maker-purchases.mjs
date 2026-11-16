import {randomUUID} from 'node:crypto';
import {readRecord,updateRecord} from './store.mjs';
import {asaas,asaasConfig,paymentsReady,invoiceUrl} from './asaas.mjs';
import {paypal,paypalConfig,paypalReady} from './paypal.mjs';
import {paypalApprovalUrl} from '../lib/international-pricing.mjs';
import {validBillingDocument,BILLING_DOCUMENT_ERROR} from '../lib/billing-document.mjs';
import {MAKER_VERSION,MAKER_TERMS} from '../lib/maker-license.mjs';
import {makerMarket,purchaseValidity,grantPurchase} from '../lib/maker-purchases.mjs';
export const PURCHASE_KEY='maker-license-purchases.json';
const enc=encodeURIComponent,fail=(m,s=409)=>{throw Object.assign(Error(m),{status:s})};
export const purchaseEnvironment=p=>p==='paypal'?paypalConfig().environment:asaasConfig().environment;
export const currentPurchase=r=>r.environment===purchaseEnvironment(r.provider);
export async function makerPurchases(memberId){return ((await readRecord(PURCHASE_KEY))?.data?.purchases||[]).filter(r=>currentPurchase(r)&&(!memberId||r.memberId===memberId));}
const root=()=>{const u=new URL(process.env.SITE_URL);if(u.protocol!=='https:'||u.username||u.password)fail('Endereço do site indisponível.',503);return u.origin};
export function purchasePublic(r){if(!r)return null;return {id:r.id,status:r.status,provider:r.provider,billingType:r.billingType,currency:r.currency,totalCents:r.totalCents,createdAt:r.createdAt,paidAt:r.paidAt||null,startsAt:r.startsAt||null,endsAt:r.endsAt||null,paymentUrl:r.provider==='paypal'?paypalApprovalUrl(r.paymentUrl,r.environment):invoiceUrl(r.paymentUrl)};}
export async function purchaseDashboard(member){const rows=await makerPurchases(member.id),market=makerMarket(member),pending=rows.find(r=>['creating','pending','overdue','review'].includes(r.status)),validity=purchaseValidity(rows);return {...validity,market,ready:market.provider==='asaas'?paymentsReady():paypalReady(),purchase:purchasePublic(pending),purchases:rows.map(purchasePublic).reverse()};}
export async function startMakerPurchase(member,input,{legacyAutoRenew=false}={}){
 if(input.consent!==true||input.termsVersion!==MAKER_VERSION)fail('Aceite os termos da licença anual.',400);
 if(legacyAutoRenew)fail('Você já possui renovação automática ativa. Cancele-a antes de fazer uma compra avulsa.');
 const market=makerMarket(member),billingType=market.provider==='paypal'?'PAYPAL':input.billingType;
 if(market.provider==='asaas'&&!['PIX','CREDIT_CARD'].includes(billingType))fail('Escolha PIX ou cartão.',400);
 if(!(market.provider==='asaas'?paymentsReady():paypalReady()))fail('Pagamento indisponível no momento.',503);
 const cpfCnpj=String(member.cpfCnpj||'').replace(/\D/g,'');if(market.provider==='asaas'&&!validBillingDocument(cpfCnpj))fail(BILLING_DOCUMENT_ERROR,400);
 const id=randomUUID(),createdAt=new Date().toISOString(),lang=['pt','en','es','fr'].includes(input.lang)?input.lang:'pt',callback=`${root()}/${lang}/clube#assinatura`;
 let chosen;
 await updateRecord(PURCHASE_KEY,data=>{data||={purchases:[]};const rows=data.purchases.filter(r=>r.memberId===member.id&&currentPurchase(r)),pending=rows.find(r=>['creating','pending','overdue','review'].includes(r.status));if(pending){chosen=pending.id;return data}const v=purchaseValidity(rows);if(v.active&&Date.parse(v.validUntil)>Date.now()+30*86400000)fail('Sua licença já está ativa. A renovação fica disponível nos últimos 30 dias.');chosen=id;data.purchases.push({id,memberId:member.id,name:member.name,email:member.email,whatsapp:member.whatsapp||'',countryCode:member.countryCode||'',...market,billingType,environment:purchaseEnvironment(market.provider),createdAt,lang,status:'creating',terms:MAKER_TERMS,termsVersion:MAKER_VERSION,consentedAt:createdAt,callback,merchantId:market.provider==='paypal'?paypalConfig().merchantId:undefined});return data;});
 if(chosen!==id){await refreshMakerPurchase(member,chosen);return purchaseDashboard(member)}
 let attempted=false;
 try{
 if(market.provider==='asaas'){
  const ref=`tiolira:${member.id}`,customers=await asaas(`/customers?externalReference=${enc(ref)}&limit=100`);let customer=customers.data?.find(c=>c.externalReference===ref&&String(c.cpfCnpj).replace(/\D/g,'')===cpfCnpj);
  if(!customer)customer=await asaas('/customers',{method:'POST',body:{name:member.name,email:member.email,cpfCnpj,externalReference:ref,notificationDisabled:true}});
  if(!customer.id)fail('Cadastro de pagamento indisponível.',502);
  await updateRecord(PURCHASE_KEY,d=>{d.purchases.find(r=>r.id===id).customerId=customer.id;return d});attempted=true;
  const payment=await asaas('/payments',{method:'POST',body:{customer:customer.id,billingType,value:market.totalCents/100,dueDate:new Date(Date.now()+3*86400000).toISOString().slice(0,10),externalReference:`tl-maker-purchase:${id}`,description:'Tio Lira — licença comercial MakerWorld por 1 ano (sem cobrança automática)',callback:{successUrl:callback,autoRedirect:true}}});
  await applyMakerAsaas(id,payment);
 }else{attempted=true;await refreshMakerPurchase(member,id)}
 }catch(e){await updateRecord(PURCHASE_KEY,d=>{const r=d.purchases.find(r=>r.id===id);if(r.status==='creating')r.status=!attempted||e.uncertain===false?'failed':'review';return d});throw e}
 return purchaseDashboard(member);
}
export async function applyMakerAsaas(id,p){return updateRecord(PURCHASE_KEY,d=>{
 const r=d?.purchases.find(r=>r.id===id);if(!r||!currentPurchase(r)||r.provider!=='asaas'||!/^pay_[\w-]+$/.test(p.id||'')||p.externalReference!==`tl-maker-purchase:${id}`||p.customer!==r.customerId||r.paymentId&&p.id!==r.paymentId||p.billingType!==r.billingType)fail('Cobrança não corresponde à licença.');
 const revoked=['REFUNDED','REFUND_REQUESTED','REFUND_IN_PROGRESS','CHARGEBACK_REQUESTED','CHARGEBACK_DISPUTE','AWAITING_CHARGEBACK_REVERSAL'].includes(p.status)||(p.refunds||[]).some(x=>x.status!=='CANCELLED');
 if(Math.round(Number(p.value)*100)!==r.totalCents&&!(revoked&&r.paymentId===p.id))fail('Valor não corresponde à licença.');
 let status=revoked?'revoked':p.deleted?'cancelled':['CONFIRMED','RECEIVED'].includes(p.status)?'paid':['REPROVED_BY_RISK_ANALYSIS','CREDIT_CARD_CAPTURE_REFUSED'].includes(p.status)?'failed':p.status==='OVERDUE'?'overdue':'pending';
 if(r.status==='revoked')status='revoked';else if(r.status==='paid'&&['pending','overdue'].includes(status))status='paid';
 r.paymentId=p.id;r.paymentUrl=invoiceUrl(p.invoiceUrl);r.status=status;r.checkedAt=new Date().toISOString();if(status==='paid')grantPurchase(r,d.purchases.filter(x=>x.memberId===r.memberId&&currentPurchase(x)));return d;
 });}
function paypalUnit(r,remote){const u=remote.purchase_units?.[0];if(remote.intent!=='CAPTURE'||!/^[A-Z0-9]{10,40}$/.test(remote.id||'')||r.paymentId&&remote.id!==r.paymentId||remote.purchase_units?.length!==1||u.custom_id!==r.id||u.reference_id!==r.id||u.invoice_id!==r.id||u.payee?.merchant_id!==r.merchantId||u.amount?.currency_code!==r.currency||u.amount?.value!==(r.totalCents/100).toFixed(2))fail('Pedido PayPal não corresponde à licença.');return u;}
export async function applyMakerPaypal(id,remote){return updateRecord(PURCHASE_KEY,d=>{const r=d?.purchases.find(r=>r.id===id);if(!r||r.provider!=='paypal'||!currentPurchase(r)||r.merchantId!==paypalConfig().merchantId)fail('Licença PayPal não encontrada.');const unit=paypalUnit(r,remote),captures=unit.payments?.captures||[];if(captures.length>1)fail('Capturas múltiplas exigem conferência.');const c=captures[0];if(c&&(!c.id||r.captureId&&c.id!==r.captureId||c.amount?.currency_code!==r.currency||c.amount?.value!==(r.totalCents/100).toFixed(2)))fail('Captura PayPal inválida.');let status=['REFUNDED','PARTIALLY_REFUNDED'].includes(c?.status)?'revoked':remote.status==='COMPLETED'&&c?.status==='COMPLETED'?'paid':['DECLINED','FAILED','DENIED'].includes(c?.status)?'failed':remote.status==='VOIDED'?'cancelled':'pending';if(r.status==='revoked')status='revoked';else if(r.status==='paid'&&status==='pending')status='paid';r.paymentId=remote.id;if(c)r.captureId=c.id;r.status=status;r.checkedAt=new Date().toISOString();const link=remote.links?.find(l=>['approve','payer-action'].includes(l.rel));if(link)r.paymentUrl=paypalApprovalUrl(link.href,r.environment);if(status==='paid')grantPurchase(r,d.purchases.filter(x=>x.memberId===r.memberId&&currentPurchase(x)));return d;});}
export async function refreshMakerPurchase(member,id){
 let r=(await makerPurchases(member.id)).find(r=>r.id===id);if(!r)fail('Compra não encontrada.',404);if(['failed','cancelled','revoked'].includes(r.status))return;
 if(r.provider==='asaas'){
  const list=r.paymentId?{data:[await asaas(`/payments/${enc(r.paymentId)}`)]}:await asaas(`/payments?externalReference=${enc('tl-maker-purchase:'+r.id)}&limit=100`);
  if(list.hasMore||list.data?.length>1)fail('Cobranças múltiplas exigem conferência.');if(list.data?.[0])await applyMakerAsaas(r.id,list.data[0]);return;
 }
 if(r.merchantId!==paypalConfig().merchantId)fail('Conta PayPal diferente da compra.');
 let remote;
 if(!r.paymentId){
  if(Date.now()-Date.parse(r.createdAt)>3600000)fail('Pedido PayPal pendente de conferência. Contate o suporte.');
  remote=await paypal('/v2/checkout/orders',{method:'POST',requestId:r.id,body:{intent:'CAPTURE',purchase_units:[{reference_id:r.id,custom_id:r.id,invoice_id:r.id,payee:{merchant_id:r.merchantId},description:'Tio Lira — MakerWorld commercial license for one year',amount:{currency_code:r.currency,value:(r.totalCents/100).toFixed(2)}}],payment_source:{paypal:{experience_context:{brand_name:'Tio Lira',user_action:'PAY_NOW',shipping_preference:'NO_SHIPPING',return_url:r.callback,cancel_url:r.callback}}}}});await applyMakerPaypal(r.id,remote);
 }else remote=await paypal(`/v2/checkout/orders/${enc(r.paymentId)}`);
 paypalUnit(r,remote);
 if(remote.status==='APPROVED'){
  await updateRecord(PURCHASE_KEY,d=>{const x=d.purchases.find(x=>x.id===r.id);x.captureAttemptAt||=new Date().toISOString();return d});r=(await makerPurchases(member.id)).find(x=>x.id===id);
  if(Date.now()-Date.parse(r.captureAttemptAt)>3600000)fail('Captura pendente de conferência.');
  try{remote=await paypal(`/v2/checkout/orders/${enc(remote.id)}/capture`,{method:'POST',body:{},requestId:'capture-'+r.id});}catch(e){remote=await paypal(`/v2/checkout/orders/${enc(remote.id)}`);if(remote.status!=='COMPLETED')throw e;}
 }
 const captures=remote.purchase_units?.[0]?.payments?.captures;if(captures?.length===1){const c=await paypal(`/v2/payments/captures/${enc(captures[0].id)}`);if(c.id!==captures[0].id)fail('Captura inválida.');captures[0]=c;}
 await applyMakerPaypal(r.id,remote);
}
export async function makerAsaasPurchaseEvent(e){const rows=await makerPurchases(),r=rows.find(r=>r.provider==='asaas'&&(e.payment?.id&&r.paymentId===e.payment.id||e.payment?.externalReference===`tl-maker-purchase:${r.id}`));if(!r)return false;await refreshMakerPurchase({id:r.memberId},r.id);return true;}
export async function makerPaypalPurchaseEvent(e){const r=e.resource||{},rows=(await makerPurchases()).filter(r=>r.provider==='paypal');let captureId=r.supplementary_data?.related_ids?.capture_id;if(e.event_type?.startsWith('PAYMENT.CAPTURE.')&&e.event_type!=='PAYMENT.CAPTURE.REFUNDED')captureId=r.id;for(const l of r.links||[]){try{const u=new URL(l.href);if(l.rel==='up'&&u.origin===paypalConfig().base&&/^\/v2\/payments\/captures\/[A-Z0-9]+$/.test(u.pathname))captureId=u.pathname.split('/').at(-1)}catch{}}
 const orderId=e.event_type==='CHECKOUT.ORDER.APPROVED'?r.id:r.supplementary_data?.related_ids?.order_id,disputed=(r.disputed_transactions||[]).map(t=>t.seller_transaction_id);
 const row=rows.find(s=>orderId&&s.paymentId===orderId||captureId&&s.captureId===captureId||s.captureId&&disputed.includes(s.captureId)||e.event_type==='CHECKOUT.ORDER.APPROVED'&&!s.paymentId&&r.purchase_units?.[0]?.custom_id===s.id);if(!row)return false;
 if(['PAYMENT.CAPTURE.REFUNDED','PAYMENT.CAPTURE.REVERSED','CUSTOMER.DISPUTE.CREATED'].includes(e.event_type)){await updateRecord(PURCHASE_KEY,d=>{d.purchases.find(r=>r.id===row.id).status='revoked';return d});return true}
 await refreshMakerPurchase({id:row.memberId},row.id);return true;
}
