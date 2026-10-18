// A stalled connection (including the response body) must release the checkout.
// Never retry a purchase here: only the server may reconcile a payment intent.
export async function shopApi(path,body,{timeoutMs=60000,fetcher=fetch,method=body?'POST':'GET'}={}){
 const controller=new AbortController();let timer;
 const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>{
  reject(Object.assign(Error('A conexão demorou mais que o esperado. Confira Meus pedidos e tente novamente para retomar o pagamento.'),{uncertain:true}));
  controller.abort();
 },timeoutMs);});
 try{
  return await Promise.race([timeout,(async()=>{
   let response,data;
   try{
    response=await fetcher('/api/'+path,{method,cache:'no-store',signal:controller.signal,...(body?{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});
    data=await response.json();
   }catch{throw Object.assign(Error('Não foi possível confirmar a resposta. Confira Meus pedidos antes de tentar novamente.'),{uncertain:true});}
   if(!response.ok)throw Object.assign(Error(data.error||'Não foi possível concluir.'),{code:data.code,uncertain:typeof data.uncertain==='boolean'?data.uncertain:response.status>=500});
   return data;
  })()]);
 }finally{clearTimeout(timer);}
}
