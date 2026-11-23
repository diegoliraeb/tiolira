import {memberMakerworldLink,makerworldLicense,makerworldLinksReport,assertNoMakerworldCheckout,withMembershipLock} from './makerworld-links.mjs';
import {annualEvent,cancelAnnual,syncAnnual} from './maker-asaas-annual.mjs';
import {annualAsaasTerms} from '../lib/maker-annual-copy.mjs';
import {purchaseDashboard,startMakerPurchase,makerPurchases,refreshMakerPurchase,makerAsaasPurchaseEvent} from './maker-purchases.mjs';
import {paypalConfig} from './paypal.mjs';
import {makerPaypalReady,createMakerPaypal,syncMakerPaypal,cancelMakerPaypal} from './maker-paypal.mjs';
import {randomUUID,createHash} from 'node:crypto';
import {readRecord,updateRecord,getCatalog} from './store.mjs';
import {asaas,asaasConfig,paymentsReady} from './asaas.mjs';
import {subscriberCopy} from '../lib/subscriber-access.mjs';
import {MAKER_PRICE,MAKER_VERSION,MAKER_TERMS,subscriptionView,yearAfter,commercialPolicy,annualCommercialEligible,commercialScopeCopy} from '../lib/maker-license.mjs';
const KEY='maker-subscriptions.json',enc=encodeURIComponent;
const fail=(message,status=409)=>{throw Object.assign(Error(message),{status})};
const env=(provider='asaas')=>provider==='paypal'?paypalConfig().environment:asaasConfig().environment;
const latest=(d,id)=>d?.subscriptions?.filter(s=>s.memberId===id&&s.environment===env(s.provider)).at(-1);
export async function memberSubscription(member){return latest((await readRecord(KEY))?.data,member.id)||null}
async function legacyDashboard(member){const data=(await readRecord(KEY))?.data;return {...subscriptionView(latest(data,member.id)),providers:{asaas:paymentsReady()&&data?.webhookEnvironment===env(),paypal:makerPaypalReady(data)},ready:Boolean(paymentsReady()&&data?.webhookEnvironment===env()||makerPaypalReady(data)),terms:MAKER_TERMS,termsVersion:MAKER_VERSION}}
const origin=()=>{const u=new URL(process.env.SITE_URL);if(u.protocol!=='https:'||u.username||u.password)fail('Configure o endereço oficial do site.',503);return u.origin};
export async function startLegacySubscription(member,input){
 if(input.consent!==true||input.termsVersion!==MAKER_VERSION)fail('Aceite os termos e a renovação anual.',400);
 const provider=input.provider||'asaas';if(!['asaas','paypal'].includes(provider))fail('Meio de pagamento inválido.',400);
 if(!(await subscriptionDashboard(member)).providers[provider])fail('Pagamento indisponível no momento.',503);
 const root=origin(),id=randomUUID(),createdAt=new Date().toISOString();
 const data=await updateRecord(KEY,old=>{old||={subscriptions:[]};const s=latest(old,member.id);if(s&&(!['failed','expired','cancelled'].includes(s.status)||subscriptionView(s).active))return old;old.subscriptions.push({id,memberId:member.id,name:member.name,email:member.email,createdAt,provider,environment:env(provider),status:'creating',termsVersion:MAKER_VERSION,consentedAt:createdAt,periods:[]});return old});
 const s=latest(data,member.id);
 if(s.id!==id){if(subscriptionView(s).checkoutUrl)return subscriptionView(s);fail('Já existe uma assinatura ou checkout em andamento. Confira a situação antes de tentar novamente.')}
 try{
  const lang=['pt','en','es','fr'].includes(input.lang)?input.lang:'pt',callback=`${root}/${lang}/clube#assinatura`;
  if(provider==='paypal'){const fields=await createMakerPaypal(s,root,lang);const saved=await updateRecord(KEY,old=>{Object.assign(old.subscriptions.find(s=>s.id===id),fields);return old});return subscriptionView(latest(saved,member.id));}
  const c=await asaas('/checkouts',{method:'POST',body:{externalReference:`tl-maker:${id}`,billingTypes:['CREDIT_CARD'],chargeTypes:['RECURRENT'],minutesToExpire:60,callback:{successUrl:callback,cancelUrl:callback,expiredUrl:callback},items:[{name:'Licença anual MakerWorld — Tio Lira',description:'Uma licença para todas as obras cobertas. Venda física. R$49,90/ano, renovação automática.',quantity:1,value:MAKER_PRICE/100}],subscription:{cycle:'YEARLY',nextDueDate:new Date().toLocaleDateString('en-CA',{timeZone:'America/Maceio'})}}});
  if(!/^[a-zA-Z0-9_-]{10,100}$/.test(c.id||''))throw Object.assign(Error('Checkout não confirmado.'),{uncertain:true});
  const saved=await updateRecord(KEY,old=>{Object.assign(old.subscriptions.find(s=>s.id===id),{status:'pending',checkoutId:c.id,checkoutUrl:`https://${env()==='sandbox'?'sandbox.':''}asaas.com/checkoutSession/show?id=${enc(c.id)}`,expiresAt:new Date(Date.now()+3600000).toISOString()});return old});return subscriptionView(latest(saved,member.id));
 }catch(e){await updateRecord(KEY,old=>{old.subscriptions.find(s=>s.id===id).status=e.uncertain===false?'failed':'review';return old});throw e}
}
function validate(remote,s){if(!remote.id||remote.cycle!=='YEARLY'||remote.billingType!=='CREDIT_CARD'||Math.round(Number(remote.value)*100)!==MAKER_PRICE||s.subscriptionId&&remote.id!==s.subscriptionId||s.customerId&&remote.customer!==s.customerId)fail('Assinatura não corresponde à licença.')}
export function paymentPeriod(p,s){
 if(p.subscription!==s.subscriptionId||p.customer!==s.customerId||p.billingType!=='CREDIT_CARD'||Math.round(Number(p.value)*100)!==MAKER_PRICE)fail('Cobrança não corresponde à assinatura.');
 const old=s.periods.find(x=>x.paymentId===p.id),revoked=p.deleted||p.refunds?.length||['REFUNDED','REFUND_REQUESTED','REFUND_IN_PROGRESS','CHARGEBACK_REQUESTED','CHARGEBACK_DISPUTE','AWAITING_CHARGEBACK_REVERSAL'].includes(p.status);
 if(revoked)return {...old,paymentId:p.id,revoked:true};
 if(!['CONFIRMED','RECEIVED'].includes(p.status))return null;
 const paymentDate=p.clientPaymentDate||p.paymentDate||p.confirmedDate;
 if(!paymentDate||!Number.isFinite(Date.parse(paymentDate))||!Number.isFinite(Date.parse(p.dueDate)))fail('Data de pagamento inválida.');
 const startsAt=old?.startsAt||new Date(Math.max(Date.parse(paymentDate),Date.parse(`${p.dueDate.slice(0,10)}T03:00:00Z`))).toISOString();
 return {paymentId:p.id,startsAt,endsAt:old?.endsAt||yearAfter(startsAt),revoked:old?.revoked===true};
}
async function sync(s){
 if(s?.provider==='paypal')return syncMakerPaypal(s);
 if(!s?.checkoutId||s.environment!==env())return;
 const list=await asaas(s.subscriptionId?`/payments?subscription=${enc(s.subscriptionId)}&limit=100`:`/payments?checkoutSession=${enc(s.checkoutId)}&limit=100`);
 const ids=[...new Set((list.data||[]).map(p=>p.subscription).filter(Boolean))];
 if(!s.subscriptionId&&!ids.length)return;
 if(!s.subscriptionId&&ids.length!==1)fail('Checkout com múltiplas assinaturas. Conferência necessária.');
 const remote=s.cancelledAt?{id:s.subscriptionId,customer:s.customerId,value:MAKER_PRICE/100,cycle:'YEARLY',billingType:'CREDIT_CARD',deleted:true}:await asaas(`/subscriptions/${enc(s.subscriptionId||ids[0])}`);
 validate(remote,s);
 await updateRecord(KEY,old=>{const row=old.subscriptions.find(r=>r.id===s.id&&r.environment===env());if(!row)fail('Assinatura não encontrada.',404);validate(remote,row);row.subscriptionId||=remote.id;row.customerId||=remote.customer;if(remote.deleted||remote.status==='INACTIVE'){row.cancelledAt||=new Date().toISOString();row.status='cancelled'}else if(!row.cancelledAt)row.status='subscribed';for(const p of list.data||[]){const period=paymentPeriod(p,row);if(period){const i=row.periods.findIndex(x=>x.paymentId===p.id);if(i<0)row.periods.push(period);else row.periods[i]=period}}row.checkedAt=new Date().toISOString();return old});
}
export async function subscriptionDashboard(member){
 const [legacy,p,external]=await Promise.all([legacyDashboard(member),purchaseDashboard(member),memberMakerworldLink(member)]);
 const siteActive=legacy.active||p.active,active=siteActive||external.active,validUntil=[legacy.validUntil,p.validUntil,external.validUntil].filter(Boolean).sort().at(-1)||null;
 return {...legacy,...p,active,siteActive,external,validUntil,autoRenew:legacy.autoRenew||!!p.recurring?.autoRenew,legacyActive:legacy.active,legacyPending:!legacy.active&&['creating','pending','review','subscribed'].includes(legacy.status),legacyCheckoutUrl:legacy.checkoutUrl,status:p.purchase?.status||(active?'paid':'none'),terms:p.market.provider==='asaas'?annualAsaasTerms.pt:MAKER_TERMS,termsVersion:MAKER_VERSION};
}
export async function startSubscription(member,input){return withMembershipLock(member.id,async()=>{await assertNoMakerworldCheckout(member);const legacy=await legacyDashboard(member);if(legacy.active||['creating','pending','review','subscribed'].includes(legacy.status))fail('Você possui uma licença anterior ativa. Consulte a validade antes de renovar.');await startMakerPurchase(member,input,{legacyAutoRenew:legacy.autoRenew});return subscriptionDashboard(member)});}
export async function refreshSubscription(member){const roots=new Set();const legacy=await memberSubscription(member);if(legacy)await sync(legacy);for(const p of (await makerPurchases(member.id)).filter(r=>['creating','pending','overdue','review','paid'].includes(r.status)).slice(-4)){const root=p.subscriptionRootId||p.id;if(roots.has(root))continue;roots.add(root);await refreshMakerPurchase(member,p.id);}const dashboard=await purchaseDashboard(member);if(dashboard.recurring&&!roots.has(dashboard.recurring.id))await syncAnnual(dashboard.recurring.id);return subscriptionDashboard(member)}
export async function cancelSubscription(member){const current=await purchaseDashboard(member);if(current.recurring){await cancelAnnual(current.recurring.id,member.id);return subscriptionDashboard(member)}await refreshSubscription(member);const s=await memberSubscription(member);if(!s?.subscriptionId)fail('Nenhuma renovação encontrada.');if(s.provider==='paypal'){await cancelMakerPaypal(s);return subscriptionDashboard(member)}if(!s.cancelledAt){const r=await asaas(`/subscriptions/${enc(s.subscriptionId)}`,{method:'DELETE'});if(r.deleted!==true)fail('Cancelamento não confirmado.',502);await updateRecord(KEY,old=>{const row=old.subscriptions.find(r=>r.id===s.id);row.cancelledAt=new Date().toISOString();row.status='cancelled';return old})}return subscriptionDashboard(member)}
export async function subscriptionWebhook(e){
 if(!e||typeof e.event!=='string')fail('Evento inválido.',400);
 if(await annualEvent(e))return;
 if(await makerAsaasPurchaseEvent(e))return;
 const all=(await readRecord(KEY))?.data?.subscriptions||[];let s=all.find(s=>s.provider!=='paypal'&&s.environment===env()&&(s.checkoutId&&s.checkoutId===e.checkout?.id||s.subscriptionId&&[e.subscription?.id,e.payment?.subscription].includes(s.subscriptionId)));if(!s)return;
 if(e.event==='SUBSCRIPTION_DELETED'){await updateRecord(KEY,old=>{const row=old.subscriptions.find(r=>r.id===s.id);row.cancelledAt||=new Date().toISOString();row.status='cancelled';return old});s={...s,cancelledAt:new Date().toISOString()}}
 await sync(s);
 if(['CHECKOUT_CANCELED','CHECKOUT_EXPIRED'].includes(e.event))await updateRecord(KEY,old=>{const row=old.subscriptions.find(r=>r.id===s.id);if(!row.subscriptionId)row.status=e.event==='CHECKOUT_EXPIRED'?'expired':'cancelled';return old});
}
async function annualLicenseBase(member){const external=await makerworldLicense(member);if(external){external.productTerms=(await getCatalog()).data.products.filter(p=>p.published&&annualCommercialEligible(p)).map(p=>p.name).join('; ');return external;}const v2=await purchaseDashboard(member);if(v2.active){const rows=await makerPurchases(member.id),r=rows.filter(r=>r.status==='paid'&&r.endsAt===v2.validUntil).at(-1);return {code:`TL-MW-${r.id}`,source:'annual',status:'active',productId:'makerworld-anual',productName:'Licença comercial — Site / MakerWorld: obras elegíveis e obras do site incluídas na assinatura',partnerName:member.name,memberId:member.id,orderId:r.id,issuedAt:r.paidAt,validUntil:v2.validUntil,terms:(r.terms||MAKER_TERMS)+' '+subscriberCopy.pt.description,productTerms:(await getCatalog()).data.products.filter(p=>p.published&&annualCommercialEligible(p)).map(p=>p.name).join('; ')}}const s=await memberSubscription(member),v=subscriptionView(s);if(!v.active)fail('Licença anual não está ativa.',403);return {code:`TL-MW-${s.id}`,source:'annual',status:'active',productId:'makerworld-anual',productName:'Licença comercial — Site / MakerWorld: obras elegíveis e obras do site incluídas na assinatura',partnerName:member.name,memberId:member.id,orderId:s.id,issuedAt:s.periods.filter(p=>!p.revoked).map(p=>p.startsAt).sort()[0],validUntil:v.validUntil,terms:MAKER_TERMS,productTerms:(await getCatalog()).data.products.filter(p=>p.published&&annualCommercialEligible(p)).map(p=>p.name).join('; ')}}
export async function legacySubscriptionReport(){const data=(await readRecord(KEY))?.data;return {providers:{asaas:{ready:Boolean(paymentsReady()&&data?.webhookEnvironment===env()),environment:env()},paypal:{ready:makerPaypalReady(data),environment:env('paypal')}},subscriptions:(data?.subscriptions||[]).filter(s=>s.environment===env(s.provider)).map(s=>({...subscriptionView(s),memberId:s.memberId,name:s.name,email:s.email,createdAt:s.createdAt,checkedAt:s.checkedAt,validFrom:(s.periods||[]).filter(p=>!p.revoked).map(p=>p.startsAt).filter(Boolean).sort()[0]||null,lastExpiry:(s.periods||[]).filter(p=>!p.revoked).map(p=>p.endsAt).filter(Boolean).sort().at(-1)||null,confirmedPayments:[...new Map((s.periods||[]).filter(p=>!p.revoked&&p.startsAt&&p.endsAt).map(p=>[p.paymentId,{id:p.paymentId,currency:'BRL',totalCents:MAKER_PRICE}])).values()]}))}}
export async function configureSubscriptionWebhook(){const root=origin(),url=`${root}/api/webhooks/maker-subscriptions`,result=await asaas('/webhooks?limit=100'),primary=result.data?.find(w=>w.url===`${root}/api/webhooks/asaas`),existing=result.data?.find(w=>w.url===url);if(!primary?.email)fail('Configure primeiro os pagamentos do site.');const events=['PAYMENT_CREATED','PAYMENT_UPDATED','PAYMENT_OVERDUE','CHECKOUT_PAID','CHECKOUT_EXPIRED','CHECKOUT_CANCELED','SUBSCRIPTION_CREATED','SUBSCRIPTION_UPDATED','SUBSCRIPTION_INACTIVATED','SUBSCRIPTION_DELETED','PAYMENT_CONFIRMED','PAYMENT_RECEIVED','PAYMENT_REFUNDED','PAYMENT_PARTIALLY_REFUNDED','PAYMENT_CHARGEBACK_REQUESTED','PAYMENT_CHARGEBACK_DISPUTE','PAYMENT_AWAITING_CHARGEBACK_REVERSAL','PAYMENT_DELETED'];const hook=await asaas(existing?`/webhooks/${enc(existing.id)}`:'/webhooks',{method:existing?'PUT':'POST',body:{name:'Tio Lira - licença anual Site / MakerWorld',url,email:primary.email,enabled:true,interrupted:false,apiVersion:3,authToken:process.env.ASAAS_WEBHOOK_TOKEN,sendType:'SEQUENTIALLY',events}});if(!hook.enabled||hook.interrupted!==false||hook.url!==url)fail('Notificações não confirmadas.',502);await updateRecord(KEY,old=>({...old,subscriptions:old?.subscriptions||[],webhookEnvironment:env(),webhookConfiguredAt:new Date().toISOString()}));return {ready:true}}

export async function subscriptionReport(){const {renewalReport}=await import('./maker-renewals.mjs');const report=await renewalReport(await legacySubscriptionReport()),links=await makerworldLinksReport();for(const id of new Set(links.requests.map(r=>r.memberId))){const own=links.requests.filter(r=>r.memberId===id),active=own.filter(r=>r.active).sort((a,b)=>b.endsAt.localeCompare(a.endsAt))[0],last=own[0];let row=report.subscriptions.find(r=>r.memberId===id);if(!row){row={memberId:id,id,name:last.name,email:last.email,whatsapp:last.whatsapp,lang:'pt',active:false,createdAt:last.createdAt,lastActivityAt:last.reviewedAt||last.createdAt,validUntil:null,validFrom:null,daysRemaining:null,autoRenew:false,recurring:null,eligible:false,recoveryEligible:false,notices:[],history:[]};report.subscriptions.push(row);}if(active||!row.active){row.provider='makerworld';row.status=active?'active':last.status==='approved'?'expired':last.status==='pending'?'review':last.status;row.active=!!active;row.validUntil=active?.endsAt||last.endsAt||null;row.validFrom=active?.startsAt||last.startsAt||null;row.daysRemaining=row.validUntil?Math.ceil((Date.parse(row.validUntil)-Date.now())/86400000):null;row.eligible=false;row.recoveryEligible=false;}row.external=true;}report.summary.activeSubscribers=new Set(report.subscriptions.filter(r=>r.active).map(r=>r.memberId)).size;report.summary.makerworldPending=links.pending;report.makerworld=links;return report;}

// Keep issued certificates as immutable snapshots; entitlement is rechecked before every new PDF.
export async function annualLicense(member){
 const license=await annualLicenseBase(member);
 const catalog=(await getCatalog()).data;
 const productIds=catalog.products.filter(p=>p.published&&annualCommercialEligible(p,catalog.collections)).map(p=>p.id).sort();
 if(!license.terms.includes(commercialScopeCopy.pt))license.terms+=' '+commercialScopeCopy.pt;
 license.code+='-R'+createHash('sha256').update(JSON.stringify([MAKER_VERSION,license.validUntil,productIds,license.terms])).digest('hex').slice(0,12).toUpperCase();
 license.termsVersion=MAKER_VERSION;
 license.productIds=productIds;
 license.productTerms=catalog.products.filter(p=>productIds.includes(p.id)).map(p=>p.name).join('; ');
 const record=await updateRecord(`club-licenses/${member.id}.json`,old=>{
  old||={};old.annualCertificates||=[];
  const prior=old.annualCertificates.find(l=>l.code===license.code&&l.validUntil===license.validUntil&&l.termsVersion===MAKER_VERSION&&JSON.stringify(l.productIds)===JSON.stringify(productIds));
  if(!prior)old.annualCertificates.push({...license,issuedAt:new Date().toISOString()});
  return old;
 });
 return record.annualCertificates.findLast(l=>l.code===license.code&&l.validUntil===license.validUntil&&l.termsVersion===MAKER_VERSION&&JSON.stringify(l.productIds)===JSON.stringify(productIds));
}
