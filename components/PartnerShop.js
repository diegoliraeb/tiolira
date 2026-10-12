'use client';
import {useEffect,useState} from 'react';

export const money=cents=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format((cents||0)/100);
export const statuses={creating:'Conferindo cobrança',pending:'Aguardando pagamento',overdue:'Vencido',paid:'Pagamento confirmado',revoked:'Acesso suspenso por estorno',cancelled:'Cancelado',failed:'Não concluído',review:'Em análise'};
const blankCard=()=>({holderName:'',number:'',expiryMonth:'',expiryYear:'',ccv:'',name:'',email:'',cpfCnpj:'',postalCode:'',addressNumber:'',phone:''});
async function api(path,body){const r=await fetch('/api/'+path,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{cache:'no-store'}),data=await r.json();if(!r.ok)throw Error(data.error||'Não foi possível concluir.');return data;}
export default function PartnerShop({memberId,onRefresh}){
 const [data,setData]=useState(null),[cart,setCart]=useState([]),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[cpf,setCpf]=useState(''),[billingType,setBillingType]=useState('PIX'),[overlap,setOverlap]=useState(false),[requestId,setRequestId]=useState(''),[card,setCard]=useState(blankCard),[payment,setPayment]=useState(null);
 const key=`tiolira-cart:${memberId}`;
 async function load(){const next=await api('club/shop');setData(next);return next;}
 useEffect(()=>{load().catch(e=>setMessage(e.message));try{const saved=JSON.parse(sessionStorage.getItem(key));if(Array.isArray(saved?.cart))setCart(saved.cart);setRequestId(saved?.requestId||crypto.randomUUID());}catch{setRequestId(crypto.randomUUID());}},[key]);
 useEffect(()=>{if(requestId)try{sessionStorage.setItem(key,JSON.stringify({cart,requestId}));}catch{}},[cart,requestId,key]);
 const activeOrder=data?.orders.find(o=>o.id===payment?.order?.id)||payment?.order;
 // Poll our own order state while the webhook confirms payment, without repeated Asaas calls.
 useEffect(()=>{
  if(!activeOrder||!['creating','pending','review','overdue'].includes(activeOrder.status))return;
  let stopped=false;const timer=setInterval(async()=>{if(document.hidden)return;try{const next=await api('club/shop');if(stopped)return;setData(next);const order=next.orders.find(o=>o.id===activeOrder.id);if(order?.status==='paid'){setMessage('Pagamento confirmado! Arquivos e licenças de venda liberados.');await onRefresh?.();}}catch{}},12000);
  return()=>{stopped=true;clearInterval(timer)};
 },[activeOrder?.id,activeOrder?.status]);
 const offers=data?[...data.collections.map(x=>({...x,kind:'collection'})),...data.products.map(x=>({...x,kind:'product',productIds:[x.id]}))]:[];
 const selected=cart.map(c=>offers.find(x=>x.id===c.id&&x.kind===c.kind)).filter(Boolean),selectedCollections=selected.filter(x=>x.kind==='collection');
 const lines=selected.filter(x=>x.kind==='collection'||!selectedCollections.some(c=>c.productIds.includes(x.id)));
 const total=lines.reduce((n,x)=>n+x.priceCents,0),partlyOwned=selectedCollections.some(c=>c.productIds.some(id=>data.products.some(p=>p.id===id&&p.owned))&&!c.owned);
 function change(next){setCart(next);setRequestId(crypto.randomUUID());setOverlap(false);setMessage('');}
 function add(item){if(cart.some(x=>x.id===item.id&&x.kind===item.kind))return;change([...cart.filter(x=>item.kind!=='collection'||x.kind!=='product'||!item.productIds.includes(x.id)),{id:item.id,kind:item.kind}]);}
 async function showPayment(order){setPayment({order});if(['pending','overdue'].includes(order.status)&&order.billingType!=='CREDIT_CARD')setPayment(await api('club/orders/payment',{id:order.id}));}
 async function purchase(e){
  e.preventDefault();setBusy(true);setMessage('');
  try{
   const cardData=billingType==='CREDIT_CARD'?{creditCard:{holderName:card.holderName,number:card.number,expiryMonth:card.expiryMonth,expiryYear:card.expiryYear,ccv:card.ccv},creditCardHolderInfo:{name:card.name,email:card.email,cpfCnpj:card.cpfCnpj,postalCode:card.postalCode,addressNumber:card.addressNumber,phone:card.phone}}:{};
   const result=await api('club/checkout',{items:cart,requestId,billingType,cpfCnpj:cpf,acceptOverlap:overlap,...cardData});
   change([]);setCpf('');setCard(blankCard());setPayment({order:result.order});await load();await onRefresh?.();
   if(result.order.status==='paid')setMessage('Pagamento confirmado! Seus arquivos e licenças de venda já estão disponíveis.');
   else{setMessage('Pedido registrado. A confirmação aparecerá aqui automaticamente.');try{await showPayment(result.order);}catch{setMessage('Pedido registrado. Use “Ver pagamento” para recuperar as instruções sem gerar outra cobrança.');}}
  }catch(e){setMessage(e.message);setRequestId(crypto.randomUUID());await load().catch(()=>{});}finally{setCard(blankCard());setBusy(false)}
 }
 async function refresh(id,details=false){setBusy(true);setMessage('');try{const result=await api(details?'club/orders/payment':'club/orders/refresh',{id});setPayment(result);await load();await onRefresh?.();setMessage(result.order.status==='paid'?'Pagamento confirmado! Arquivos e licenças de venda liberados.':'Situação do pagamento atualizada.');}catch(e){setMessage(e.message)}finally{setBusy(false)}}
 async function copy(value){try{await navigator.clipboard.writeText(value);setMessage('Código copiado.');}catch{setMessage('Selecione e copie o código exibido abaixo.');}}
 function cardField(key,label,props={}){return <label>{label}<input value={card[key]} onChange={e=>setCard(c=>({...c,[key]:e.target.value}))} required {...props}/></label>}
 return <section className="partner-shop">
  <header className="partner-panel-heading"><p className="eyebrow">ÁREA DO PARCEIRO</p><h2>Loja e carrinho</h2><p>Escolha uma peça ou leve a coleção completa. Após o pagamento, seus arquivos e a licença para vender as peças impressas são liberados automaticamente.</p></header>
  {message&&<p className="notice" role="status">{message}</p>}
  {!data?<p>Carregando loja…</p>:<>
   {!data.paymentsReady&&<p className="notice">Os pagamentos estarão disponíveis em breve.</p>}
   {activeOrder&&<section className="shop-payment admin-panel" aria-label="Pagamento do pedido"><h3>{statuses[activeOrder.status]||activeOrder.status}</h3><p>{activeOrder.items.map(i=>i.name).join(', ')} · <strong>{money(activeOrder.totalCents)}</strong></p>
    {activeOrder.status==='paid'?<p>Compra concluída. Os arquivos estão logo abaixo e suas autorizações estão em <a href="#licencas">Minhas licenças</a>.</p>:['pending','overdue'].includes(activeOrder.status)?<>
     {payment.pix&&<><p>Leia o QR Code com o aplicativo do seu banco ou use o Pix Copia e Cola.</p>{payment.pix.encodedImage&&<img className="shop-pix-qr" alt="QR Code Pix deste pedido" src={`data:image/png;base64,${payment.pix.encodedImage}`}/>}<label>Pix Copia e Cola<textarea readOnly value={payment.pix.payload}/></label><button type="button" className="button outline" onClick={()=>copy(payment.pix.payload)}>Copiar código Pix</button>{payment.pix.expirationDate&&<p className="field-help">Validade informada pelo Asaas: {payment.pix.expirationDate}</p>}</>}
     {payment.boleto&&<><p>Pague no aplicativo do banco usando a linha digitável. A liberação ocorre após a compensação.</p><label>Linha digitável do boleto<textarea readOnly value={payment.boleto.identificationField}/></label><button type="button" className="button outline" onClick={()=>copy(payment.boleto.identificationField)}>Copiar linha digitável</button>{activeOrder.dueDate&&<p>Vencimento: {activeOrder.dueDate.split('-').reverse().join('/')}</p>}</>}
     {activeOrder.billingType==='CREDIT_CARD'&&<p>O processamento do cartão está sendo acompanhado. Aguarde a confirmação antes de tentar novamente.</p>}
    </>:<p>Acompanhe a situação neste painel. A licença e os downloads dependem da confirmação do pagamento.</p>}
    {['creating','pending','overdue','review'].includes(activeOrder.status)&&<button type="button" className="button outline" disabled={busy} onClick={()=>refresh(activeOrder.id,true)}>Atualizar pagamento</button>}
   </section>}
   <div className="shop-offers">{offers.filter(x=>!x.owned).map(item=><article className="shop-offer" key={item.kind+item.id}><img src={item.image} alt="" loading="lazy"/><div><span className="eyebrow">{item.kind==='collection'?`COLEÇÃO · ${item.productIds.length} PEÇAS`:'PEÇA AVULSA'}</span><h3>{item.name}</h3><strong className="shop-price">{money(item.priceCents)}</strong><button className="button outline" disabled={busy||cart.some(x=>x.id===item.id&&x.kind===item.kind)||item.kind==='product'&&selectedCollections.some(c=>c.productIds.includes(item.id))} onClick={()=>add(item)}>{cart.some(x=>x.id===item.id&&x.kind===item.kind)?'No carrinho':'Adicionar ao carrinho'}</button></div></article>)}</div>
   {!offers.length&&<p className="notice">As peças estão sendo preparadas. Elas aparecerão aqui quando os arquivos forem disponibilizados.</p>}
   <form className="shop-cart admin-panel" onSubmit={purchase}>
    <h3>Seu carrinho</h3>
    {lines.length?lines.map(item=><div className="shop-cart-row" key={item.kind+item.id}><span>{item.name}<small>{item.kind==='collection'?`${item.productIds.length} peças incluídas`:'Arquivo digital'} · licença para venda de impressos</small></span><strong>{money(item.priceCents)}</strong><button type="button" disabled={busy} onClick={()=>change(cart.filter(x=>x.id!==item.id||x.kind!==item.kind))} aria-label={`Remover ${item.name}`}>Remover</button></div>):<p>Seu carrinho está vazio.</p>}
    {cart.length!==selected.length&&<p className="notice">Um item deixou de estar disponível. <button type="button" onClick={()=>change(selected.map(({kind,id})=>({kind,id})))}>Atualizar carrinho</button></p>}
    {lines.length>0&&<>
     <p className="shop-total">Total <strong>{money(total)}</strong></p>
     <fieldset disabled={busy} className="shop-checkout-fields"><div className="form-grid"><label>CPF ou CNPJ do comprador<input value={cpf} onChange={e=>setCpf(e.target.value)} inputMode="numeric" autoComplete="off" maxLength={18} required/></label><label>Forma de pagamento<select value={billingType} onChange={e=>{setBillingType(e.target.value);setCard(blankCard());setRequestId(crypto.randomUUID());}}><option value="PIX">Pix</option><option value="BOLETO">Boleto</option><option value="CREDIT_CARD">Cartão de crédito</option></select></label></div>
     {billingType==='CREDIT_CARD'&&<div className="shop-card-fields"><h4>Cartão de crédito · à vista</h4><div className="form-grid">
      {cardField('holderName','Nome impresso no cartão',{autoComplete:'cc-name',maxLength:100})}{cardField('number','Número do cartão',{autoComplete:'cc-number',inputMode:'numeric',maxLength:23})}
      {cardField('expiryMonth','Mês de validade (MM)',{autoComplete:'cc-exp-month',inputMode:'numeric',pattern:'0[1-9]|1[0-2]',maxLength:2,placeholder:'MM'})}{cardField('expiryYear','Ano de validade (AAAA)',{autoComplete:'cc-exp-year',inputMode:'numeric',pattern:'20[0-9]{2}',maxLength:4,placeholder:'AAAA'})}
      {cardField('ccv','Código de segurança',{type:'password',autoComplete:'off',inputMode:'numeric',pattern:'[0-9]{3,4}',maxLength:4})}
     </div><h4>Dados do titular</h4><div className="form-grid">
      {cardField('name','Nome completo do titular',{autoComplete:'name',maxLength:100})}{cardField('email','E-mail do titular',{type:'email',autoComplete:'email',maxLength:254})}{cardField('cpfCnpj','CPF ou CNPJ do titular',{inputMode:'numeric',autoComplete:'off',maxLength:18})}{cardField('phone','Telefone com DDD',{inputMode:'tel',autoComplete:'tel-national',maxLength:16})}{cardField('postalCode','CEP da fatura',{inputMode:'numeric',autoComplete:'postal-code',maxLength:9})}{cardField('addressNumber','Número do endereço da fatura',{autoComplete:'off',maxLength:20})}
     </div></div>}
     {partlyOwned&&<label className="check"><input type="checkbox" checked={overlap} onChange={e=>setOverlap(e.target.checked)} required/>Já possuo peças desta coleção e aceito pagar o preço integral do pacote, sem abatimento.</label>}
     </fieldset>
     <p className="field-help">Pagamento processado pelo Asaas aqui no site. Os dados do cartão não são salvos. A compra inclui licença para vender as peças impressas; os arquivos digitais não podem ser revendidos ou compartilhados.</p>
     <button className="button primary" disabled={busy||!data.paymentsReady||cart.length!==selected.length}>{busy?'Processando…':billingType==='PIX'?`Gerar Pix de ${money(total)}`:billingType==='BOLETO'?`Gerar boleto de ${money(total)}`:`Pagar ${money(total)} com cartão`}</button>
    </>}
   </form>
   <section className="club-library"><h3>Meus arquivos comprados</h3>{data.products.some(p=>p.owned)?<div className="club-download-grid">{data.products.filter(p=>p.owned).map(p=><article className="club-download-card" key={p.id}><img src={p.image} alt=""/><div><h3>{p.name}</h3><a className="button primary" href={p.downloadUrl}>Baixar arquivo</a><a className="button outline" href="#licencas">Ver licença de venda</a></div></article>)}</div>:<p>Seus arquivos e licenças serão liberados após o pagamento.</p>}</section>
   <section className="club-library"><h3>Meus pedidos</h3>{data.orders.length?data.orders.map(o=><article className="shop-order" key={o.id}><div><strong>{o.items.map(i=>i.name).join(', ')}</strong><p>{new Date(o.createdAt).toLocaleDateString('pt-BR')} · {money(o.totalCents)} · {statuses[o.status]||o.status}</p><small>Pedido {o.id}</small></div><div className="partner-actions">{['pending','overdue'].includes(o.status)&&<button className="button outline" disabled={busy} onClick={()=>refresh(o.id,true)}>Ver pagamento</button>}{['creating','review'].includes(o.status)&&<button className="button outline" disabled={busy} onClick={()=>refresh(o.id)}>Consultar pagamento</button>}{o.status==='paid'&&<a className="button outline" href="#licencas">Ver licenças</a>}</div></article>):<p>Nenhum pedido ainda.</p>}</section>
  </>}
 </section>;
}
