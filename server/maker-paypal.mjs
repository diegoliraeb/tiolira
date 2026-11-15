import {randomUUID} from 'node:crypto';
import {readRecord,updateRecord} from './store.mjs';
import {paypal,paypalConfig,paypalReady} from './paypal.mjs';
import {MAKER_PRICE,yearAfter} from '../lib/maker-license.mjs';
const KEY='maker-subscriptions.json',enc=encodeURIComponent;
const fail=(message,status=409)=>{throw Object.assign(Error(message),{status})};
export const makerPaypalReady=data=>Boolean(paypalReady()&&data?.paypal?.environment===paypalConfig().environment&&data.paypal.ready&&data.paypal.planId);
export function annualPaypalUrl(value,environment){try{const u=new URL(value),host=environment==='production'?'www.paypal.com':'www.sandbox.paypal.com';if(u.protocol==='https:'&&u.hostname===host&&!u.username&&!u.password&&!u.port&&u.pathname==='/webapps/billing/subscriptions'&&u.searchParams.get('ba_token'))return u.href;}catch{}return '';}
function validatePlan(p){const c=p.billing_cycles?.[0];if(p.billing_cycles?.length!==1||c.tenure_type!=='REGULAR'||c.total_cycles!==0||c.frequency?.interval_unit!=='YEAR'||c.frequency.interval_count!==1||c.pricing_scheme?.fixed_price?.currency_code!=='BRL'||Number(c.pricing_scheme.fixed_price.value)!==MAKER_PRICE/100||Number(p.payment_preferences?.setup_fee?.value||0)!==0||Number(p.taxes?.percentage||0)!==0)fail('Plano PayPal não corresponde ao valor anual.');}
export async function createMakerPaypal(s,root,lang){
 const config=(await readRecord(KEY))?.data?.paypal;if(!config||config.environment!==s.environment||!config.ready)fail('Assinatura PayPal indisponível.',503);
 const plan=await paypal(`/v1/billing/plans/${enc(config.planId)}`);validatePlan(plan);if(plan.status!=='ACTIVE')fail('Plano PayPal indisponível.');
 const remote=await paypal('/v1/billing/subscriptions',{method:'POST',requestId:s.id,body:{plan_id:config.planId,custom_id:s.id,application_context:{brand_name:'Tio Lira',shipping_preference:'NO_SHIPPING',user_action:'SUBSCRIBE_NOW',return_url:`${root}/${lang}/clube#assinatura`,cancel_url:`${root}/${lang}/clube#assinatura`}}});
 const url=annualPaypalUrl(remote.links?.find(l=>l.rel==='approve')?.href,s.environment);
 if(!/^I-[A-Z0-9]+$/.test(remote.id||'')||remote.plan_id!==config.planId||remote.custom_id!==s.id||!url)throw Object.assign(Error('Assinatura PayPal não confirmada. Confira antes de tentar novamente.'),{uncertain:true});
 return {subscriptionId:remote.id,planId:config.planId,merchantId:paypalConfig().merchantId,checkoutUrl:url,status:'pending',expiresAt:new Date(Date.now()+3*3600_000).toISOString()};
}
export function paypalPeriod(t,row){
 if(!t.id||!Number.isFinite(Date.parse(t.time)))fail('Transação PayPal inválida.');
 const old=row.periods.find(p=>p.paymentId===t.id);
 if(['REFUNDED','PARTIALLY_REFUNDED','REVERSED'].includes(t.status))return {...old,paymentId:t.id,revoked:true};
 if(t.status!=='COMPLETED')return null;
 const amount=t.amount_with_breakdown?.gross_amount;
 if(amount?.currency_code!=='BRL'||Number(amount.value)!==MAKER_PRICE/100)fail('Valor PayPal não corresponde à assinatura.');
 return {paymentId:t.id,startsAt:old?.startsAt||t.time,endsAt:old?.endsAt||yearAfter(t.time),revoked:old?.revoked===true};
}
export async function syncMakerPaypal(s){
 if(!s?.subscriptionId||s.environment!==paypalConfig().environment)return;
 if(s.merchantId!==paypalConfig().merchantId)fail('Conta PayPal diferente da assinatura.');
 const remote=await paypal(`/v1/billing/subscriptions/${enc(s.subscriptionId)}?fields=plan`);
 if(remote.id!==s.subscriptionId||remote.custom_id!==s.id||remote.plan_id!==s.planId||remote.plan_overridden===true)fail('Assinatura PayPal não corresponde ao parceiro.');
 const plan=remote.plan||await paypal(`/v1/billing/plans/${enc(s.planId)}`);validatePlan(plan);
 const from=new Date(Math.max(Date.parse(s.createdAt)-60_000,Date.now()-370*86400_000)).toISOString(),to=new Date().toISOString();
 const list=await paypal(`/v1/billing/subscriptions/${enc(s.subscriptionId)}/transactions?start_time=${enc(from)}&end_time=${enc(to)}`);
 if(list.total_pages>1)fail('Transações PayPal exigem conferência.');
 await updateRecord(KEY,old=>{const row=old.subscriptions.find(r=>r.id===s.id&&r.provider==='paypal');if(!row)fail('Assinatura não encontrada.',404);
 if(['CANCELLED','EXPIRED'].includes(remote.status)){row.cancelledAt||=new Date().toISOString();row.status='cancelled';}
 else if(!row.cancelledAt){row.status=remote.status==='ACTIVE'?'subscribed':remote.status==='SUSPENDED'?'suspended':'pending';}
 row.renewalSuspended=remote.status==='SUSPENDED';
 for(const t of list.transactions||[]){const period=paypalPeriod(t,row);if(period){const i=row.periods.findIndex(p=>p.paymentId===t.id);if(i<0)row.periods.push(period);else row.periods[i]=period;}}
 row.checkedAt=new Date().toISOString();return old;});
}
export async function cancelMakerPaypal(s){
 if(!s.subscriptionId)fail('Nenhuma assinatura PayPal encontrada.');
 if(!s.cancelledAt){await paypal(`/v1/billing/subscriptions/${enc(s.subscriptionId)}/cancel`,{method:'POST',body:{reason:'Renovação cancelada pelo titular no Tio Lira.'},allowEmpty:true});await updateRecord(KEY,old=>{const row=old.subscriptions.find(r=>r.id===s.id);row.cancelledAt=new Date().toISOString();row.status='cancelled';return old});}
}
// Called only after the shared PayPal endpoint verifies the original signature.
export async function makerPaypalEvent(event){
 const type=event.event_type;if(!type?.startsWith('BILLING.SUBSCRIPTION.')&&!type?.startsWith('PAYMENT.SALE.')&&type!=='CUSTOMER.DISPUTE.CREATED')return false;
 const r=event.resource||{},all=((await readRecord(KEY))?.data?.subscriptions||[]).filter(s=>s.provider==='paypal'&&s.environment===paypalConfig().environment);
 const saleIds=[r.sale_id,r.id,...(r.disputed_transactions||[]).map(t=>t.seller_transaction_id)].filter(Boolean);
 for(const l of r.links||[]){try{const u=new URL(l.href);if(l.rel==='up'&&u.origin===paypalConfig().base&&/^\/v1\/payments\/sale\/[A-Z0-9]+$/.test(u.pathname))saleIds.push(u.pathname.split('/').at(-1));}catch{}}
 const s=all.find(s=>s.subscriptionId&&(s.subscriptionId===(type.startsWith('BILLING.SUBSCRIPTION.')?r.id:r.billing_agreement_id)||s.periods.some(p=>saleIds.includes(p.paymentId))));
 if(!s)return false;
 if(['PAYMENT.SALE.REFUNDED','PAYMENT.SALE.REVERSED','CUSTOMER.DISPUTE.CREATED'].includes(type)){
  await updateRecord(KEY,old=>{const row=old.subscriptions.find(x=>x.id===s.id);for(const id of saleIds){const p=row.periods.find(p=>p.paymentId===id);if(p)p.revoked=true;else if(type!=='CUSTOMER.DISPUTE.CREATED')row.periods.push({paymentId:id,revoked:true});}return old});
 }else await syncMakerPaypal(s);
 return true;
}
const events=['BILLING.SUBSCRIPTION.CREATED','BILLING.SUBSCRIPTION.ACTIVATED','BILLING.SUBSCRIPTION.UPDATED','BILLING.SUBSCRIPTION.EXPIRED','BILLING.SUBSCRIPTION.CANCELLED','BILLING.SUBSCRIPTION.SUSPENDED','BILLING.SUBSCRIPTION.PAYMENT.FAILED','PAYMENT.SALE.COMPLETED','PAYMENT.SALE.REFUNDED','PAYMENT.SALE.REVERSED','CUSTOMER.DISPUTE.CREATED'];
export async function configureMakerPaypal(){
 if(!paypalReady())fail('Configure primeiro a integração PayPal do site.',503);
 const c=paypalConfig(),origin=new URL(process.env.SITE_URL).origin;
 const data=await updateRecord(KEY,old=>{old||={subscriptions:[]};if(old.paypal?.environment!==c.environment)old.paypal={environment:c.environment,requestId:randomUUID(),createdAt:new Date().toISOString()};return old;});
 let config=data.paypal;
 if(!config.planId&&Date.now()-Date.parse(config.createdAt)>3600_000)fail('Configuração PayPal pendente de conferência. Evite criar planos duplicados.');
 if(!config.productId){const p=await paypal('/v1/catalogs/products',{method:'POST',requestId:config.requestId+'-product',body:{name:'Licença comercial anual MakerWorld — Tio Lira',description:'Uma licença anual para todas as obras elegíveis do Tio Lira.',type:'SERVICE',category:'SOFTWARE',home_url:origin}});if(!p.id)fail('Produto PayPal não confirmado.');await updateRecord(KEY,old=>{old.paypal.productId=p.id;return old});config={...config,productId:p.id};}
 if(!config.planId){const p=await paypal('/v1/billing/plans',{method:'POST',requestId:config.requestId+'-plan',body:{product_id:config.productId,name:'Licença MakerWorld · R$49,90 por ano',status:'ACTIVE',billing_cycles:[{frequency:{interval_unit:'YEAR',interval_count:1},tenure_type:'REGULAR',sequence:1,total_cycles:0,pricing_scheme:{fixed_price:{value:'49.90',currency_code:'BRL'}}}],payment_preferences:{auto_bill_outstanding:false,payment_failure_threshold:1}}});validatePlan(p);if(!p.id||p.status!=='ACTIVE')fail('Plano PayPal não confirmado.');await updateRecord(KEY,old=>{old.paypal.planId=p.id;return old});config={...config,planId:p.id};}
 validatePlan(await paypal(`/v1/billing/plans/${enc(config.planId)}`));
 const hook=await paypal(`/v1/notifications/webhooks/${enc(c.webhookId)}`);if(hook.url!==origin+'/api/webhooks/paypal')fail('Webhook PayPal aponta para outro site.');
 const current=(hook.event_types||[]).map(e=>e.name);if(!current.includes('*')){const names=[...new Set([...current,...events])];await paypal(`/v1/notifications/webhooks/${enc(c.webhookId)}`,{method:'PATCH',body:[{op:'replace',path:'/event_types',value:names.map(name=>({name}))}],allowEmpty:true});}
 const confirmed=await paypal(`/v1/notifications/webhooks/${enc(c.webhookId)}`),names=confirmed.event_types?.map(e=>e.name)||[];if(confirmed.url!==hook.url||!names.includes('*')&&!events.every(e=>names.includes(e)))fail('Eventos PayPal não confirmados.');
 await updateRecord(KEY,old=>{old.paypal.ready=true;return old});return {ready:true};
}
