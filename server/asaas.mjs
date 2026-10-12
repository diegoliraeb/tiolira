// Private API key stays on the server. Card data is forwarded only in memory, never stored or logged.
export function asaasConfig(){
 const environment=process.env.ASAAS_ENVIRONMENT||'sandbox';
 if(!['sandbox','production'].includes(environment))throw Object.assign(new Error('Ambiente Asaas inválido.'),{status:503});
 return {environment,key:process.env.ASAAS_API_KEY,base:environment==='production'?'https://api.asaas.com/v3':'https://api-sandbox.asaas.com/v3'};
}
export function paymentsReady(){return Boolean(asaasConfig().key&&process.env.ASAAS_WEBHOOK_TOKEN?.length>=32);}
export async function asaas(path,{method='GET',body,timeoutMs=15000}={}){
 const {base,key}=asaasConfig();
 if(!paymentsReady())throw Object.assign(new Error('Os pagamentos ainda não estão configurados.'),{status:503});
 let response;
 try{response=await fetch(base+path,{method,headers:{access_token:key,'Content-Type':'application/json','User-Agent':'TioLira/1.0'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(timeoutMs)});}
 catch{throw Object.assign(new Error('Não foi possível confirmar a resposta do Asaas. Consulte o pedido antes de tentar novamente.'),{status:503,uncertain:true});}
 const data=await response.json().catch(()=>null);
 if(!response.ok||!data)throw Object.assign(new Error('O Asaas não concluiu a operação. Confira os dados ou consulte o pedido.'),{status:502,uncertain:response.status>=500||!data});
 return data;
}
export function invoiceUrl(value){
 try{const u=new URL(value);if(u.protocol==='https:'&&!u.username&&!u.password&&['www.asaas.com','asaas.com','sandbox.asaas.com','www.sandbox.asaas.com'].includes(u.hostname))return u.href;}catch{}
 return '';
}
