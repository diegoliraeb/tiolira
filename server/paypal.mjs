const fail=(message,status=503,uncertain=false)=>{throw Object.assign(Error(message),{status,uncertain});};
export function paypalConfig(){
 const environment=process.env.PAYPAL_ENVIRONMENT||'sandbox';
 if(!['sandbox','production'].includes(environment))fail('Ambiente PayPal inválido.');
 return {environment,base:environment==='production'?'https://api-m.paypal.com':'https://api-m.sandbox.paypal.com',clientId:process.env.PAYPAL_CLIENT_ID,secret:process.env.PAYPAL_CLIENT_SECRET,merchantId:process.env.PAYPAL_MERCHANT_ID,webhookId:process.env.PAYPAL_WEBHOOK_ID};
}
export function paypalReady(){const c=paypalConfig();return Boolean(c.clientId&&c.secret&&c.merchantId&&c.webhookId&&siteOrigin());}
function siteOrigin(){try{const u=new URL(process.env.SITE_URL);if(u.protocol==='https:'&&!u.username&&!u.password)return u.origin;}catch{}return '';}
export function paypalReturnUrl(order,cancel=false){const origin=siteOrigin();if(!origin)fail('Configure o endereço HTTPS oficial do site.');return `${origin}/${['pt','en','es','fr'].includes(order.lang)?order.lang:'pt'}/clube?pedido=${encodeURIComponent(order.id)}&retorno=paypal${cancel?'&cancelado=1':''}#compras`;}
export async function paypal(path,{method='GET',body,requestId,rawBody}={}){
 const c=paypalConfig();if(!c.clientId||!c.secret)fail('PayPal ainda não configurado.');
 let tokenResponse;
 try{tokenResponse=await fetch(c.base+'/v1/oauth2/token',{method:'POST',headers:{Authorization:'Basic '+Buffer.from(c.clientId+':'+c.secret).toString('base64'),'Content-Type':'application/x-www-form-urlencoded'},body:'grant_type=client_credentials',signal:AbortSignal.timeout(15000)});}catch{fail('Não foi possível conectar ao PayPal.');}
 const token=await tokenResponse.json().catch(()=>null);if(!tokenResponse.ok||!token?.access_token)fail('Não foi possível autenticar a integração PayPal.');
 let response;
 try{response=await fetch(c.base+path,{method,headers:{Authorization:'Bearer '+token.access_token,'Content-Type':'application/json',Prefer:'return=representation',...(requestId?{'PayPal-Request-Id':requestId}:{})},...(rawBody?{body:rawBody}:body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000)});}catch{fail('Resposta do PayPal não confirmada. Confira o pedido antes de tentar novamente.',503,true);}
 const result=await response.json().catch(()=>null);
 if(!response.ok||!result)fail('O PayPal não concluiu a operação. Confira o pedido ou contate o suporte.',502,response.status>=500||response.status===409||!result);
 return result;
}
export async function verifyPaypalWebhook(headers,raw){
 const c=paypalConfig();if(!paypalReady())fail('PayPal ainda não configurado.');
 const fields={'auth_algo':'paypal-auth-algo','cert_url':'paypal-cert-url','transmission_id':'paypal-transmission-id','transmission_sig':'paypal-transmission-sig','transmission_time':'paypal-transmission-time'},payload={webhook_id:c.webhookId};
 for(const [key,header] of Object.entries(fields)){const value=headers[header];if(typeof value!=='string'||!value||value.length>5000)fail('Webhook não autorizado.',401);payload[key]=value;}
 // Preserve the event bytes for PayPal's postback signature verification.
 const result=await paypal('/v1/notifications/verify-webhook-signature',{method:'POST',rawBody:JSON.stringify(payload).slice(0,-1)+',"webhook_event":'+raw+'}'});
 if(result.verification_status!=='SUCCESS')fail('Webhook não autorizado.',401);
 return JSON.parse(raw);
}

export async function checkPaypalConnection(){
 if(!paypalReady())return {configured:false};
 const c=paypalConfig(),hook=await paypal(`/v1/notifications/webhooks/${encodeURIComponent(c.webhookId)}`);
 const required=['CHECKOUT.ORDER.APPROVED','PAYMENT.CAPTURE.COMPLETED','PAYMENT.CAPTURE.PENDING','PAYMENT.CAPTURE.DENIED','PAYMENT.CAPTURE.REFUNDED','PAYMENT.CAPTURE.REVERSED','CUSTOMER.DISPUTE.CREATED'];
 const events=new Set((hook.event_types||[]).map(e=>e.name));
 return {configured:true,connected:true,environment:c.environment,webhookMatches:hook.id===c.webhookId&&hook.url===siteOrigin()+'/api/webhooks/paypal',eventsReady:events.has('*')||required.every(e=>events.has(e))};
}
