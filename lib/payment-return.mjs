const awaiting=new Set(['creating','pending','overdue','review']);
export const awaitsPayment=status=>awaiting.has(status);
export function returnedPaymentId(search){
 const params=new URLSearchParams(search),id=params.get('pedido');
 return params.get('retorno')==='asaas'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id||'')?id:null;
}
// Retry only verified server reads, sequentially and for a bounded time. A return URL never grants access.
export function reconcilePayment({read,onPayment,onError,onDone,maxAttempts=6,delayMs=3000,schedule=setTimeout,cancel=clearTimeout}){
 let stopped=false,timer,attempts=0;
 async function run(){
  let retry=true;attempts++;
  try{const result=await read();if(stopped)return;retry=awaitsPayment(result.order.status);await onPayment(result);}
  catch(error){if(stopped)return;onError(error);}
  if(stopped)return;
  if(retry&&attempts<maxAttempts)timer=schedule(run,delayMs);else onDone();
 }
 void run();
 return ()=>{stopped=true;if(timer!==undefined)cancel(timer);};
}
