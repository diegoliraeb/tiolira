'use client';
import {useEffect,useRef,useState} from 'react';
import PurchaseDownloads from './PurchaseDownloads';
import ShopPayment from './ShopPayment';
import AsaasPaymentNotice,{PaymentLock} from './AsaasPaymentNotice';
import {cartSelection} from '../lib/cart-lines.mjs';
import {awaitsPayment,reconcilePayment} from '../lib/payment-return.mjs';
import {formatMoney,paypalPaymentUrl} from '../lib/international-pricing.mjs';
import {cardPaymentUrl} from '../lib/asaas-payment.mjs';

export const money=formatMoney;
export const statuses={creating:'Conferindo cobrança',pending:'Aguardando pagamento',overdue:'Vencido',paid:'Pagamento confirmado',revoked:'Acesso suspenso por estorno',cancelled:'Cancelado',failed:'Não concluído',review:'Em análise'};
async function api(path,body){const r=await fetch('/api/'+path,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{cache:'no-store'}),data=await r.json();if(!r.ok)throw Error(data.error||'Não foi possível concluir.');return data;}
export default function PartnerShop({lang='pt',cartState,member,onEditProfile,onRefresh,requestedProductId,onProductConsumed}){
 const {returnedOrderId,shopView,setShopView,activeOrderId,setActiveOrderId,couponCode,setCouponCode,couponQuote,couponError,couponBusy,data,setData,cart,setCart,requestId,setRequestId,load,error}=cartState;
 const international=data?.paymentProvider==='paypal',money=(cents,currency=data?.currency||'BRL')=>formatMoney(cents,currency);
 const viewHeading=useRef(null);
 useEffect(()=>{load().catch(()=>{});},[member.countryCode]);
 const [paymentLoading,setPaymentLoading]=useState(false),[paymentError,setPaymentError]=useState(''),[orderFilter,setOrderFilter]=useState('all');
 const [couponDraft,setCouponDraft]=useState(couponCode);
 useEffect(()=>setCouponDraft(couponCode),[couponCode]);
 const hasBillingDocument=/^(\d{11}|\d{14})$/.test(member.cpfCnpj||'');
 const maskedDocument=hasBillingDocument?`${member.cpfCnpj.length===11?'CPF •••.•••.•••-':'CNPJ ••.•••.•••/••••-'}${member.cpfCnpj.slice(-2)}`:'';
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[billingType,setBillingType]=useState('PIX'),[overlap,setOverlap]=useState(false),[payment,setPayment]=useState(null);
 useEffect(()=>{
  if(!data||!requestedProductId)return;
  const item=data.products.find(p=>p.id===requestedProductId&&!p.owned);
  if(item)add({...item,kind:'product',productIds:[item.id]});
  else setMessage('Esta peça não está disponível para compra ou já pertence à sua biblioteca.');
  onProductConsumed?.();
 },[data,requestedProductId]);
 const activeOrder=data?.orders.find(o=>o.id===activeOrderId)||(payment?.order?.id===activeOrderId?payment.order:null);
 function switchView(view){setShopView(view);setMessage('');requestAnimationFrame(()=>{viewHeading.current?.focus({preventScroll:true});viewHeading.current?.scrollIntoView({block:'start',behavior:'smooth'});});}
 function browse(){setActiveOrderId(null);setPayment(null);switchView('catalog');}
 function openOrder(order){setActiveOrderId(order.id);setPayment({order});setPaymentError('');switchView('cart');}
 const pendingOrder=awaitsPayment(activeOrder?.status),returningFromAsaas=Boolean(activeOrder&&returnedOrderId===activeOrder.id);
 useEffect(()=>{
  if(shopView!=='cart'||!activeOrder||!pendingOrder){setPaymentLoading(false);return;}
  setPaymentLoading(true);setPaymentError('');
  return reconcilePayment({
   read:async()=>{const result=await api('club/orders/payment',{id:activeOrder.id});if(result.order.status==='paid')result.shop=await api('club/shop');return result;},
   onPayment:async result=>{
    setPaymentError('');setPayment(result);setData(old=>result.shop||({...old,orders:old.orders.map(o=>o.id===result.order.id?result.order:o)}));
    if(result.order.status==='paid'){
     setMessage('Pagamento confirmado! Seus arquivos e licenças estão liberados abaixo.');
     await Promise.allSettled([onRefresh?.()]);
    }
   },
   onError:e=>setPaymentError(e.message),onDone:()=>setPaymentLoading(false),
   maxAttempts:returningFromAsaas?6:1
  });
 },[activeOrder?.id,pendingOrder,shopView,returningFromAsaas]);
 // Poll our own order state while the webhook confirms payment, without repeated Asaas calls.
 useEffect(()=>{
  if(!activeOrder||!['creating','pending','review','overdue'].includes(activeOrder.status))return;
  let stopped=false;const timer=setInterval(async()=>{if(document.hidden)return;try{const next=await api('club/shop');if(stopped)return;setData(next);const order=next.orders.find(o=>o.id===activeOrder.id);if(order?.status==='paid'){setMessage('Pagamento confirmado! Arquivos e licenças de venda liberados.');await onRefresh?.();}}catch{}},12000);
  return()=>{stopped=true;clearInterval(timer)};
 },[activeOrder?.id,activeOrder?.status]);
 const {offers,selected,selectedCollections,lines,total:subtotal}=cartSelection(data,cart);
 const partlyOwned=selectedCollections.some(c=>c.productIds.some(id=>data.products.some(p=>p.id===id&&p.owned))&&!c.owned);
 function change(next){setCart(next);setRequestId(crypto.randomUUID());setOverlap(false);setMessage('');}
 function add(item){setActiveOrderId(null);setPayment(null);if(cart.some(x=>x.id===item.id&&x.kind===item.kind))return;change([...cart.filter(x=>item.kind!=='collection'||x.kind!=='product'||!item.productIds.includes(x.id)),{id:item.id,kind:item.kind}]);}

 const total=couponQuote?.totalCents??subtotal;
 async function purchase(e){
  e.preventDefault();setBusy(true);setMessage('');
  try{
   const result=await api('club/checkout',{items:cart,requestId,billingType:international?'PAYPAL':billingType,couponCode,expectedTotalCents:total,acceptOverlap:overlap,lang});
   change([]);setCouponCode('');setCouponDraft('');setPayment({order:result.order});setActiveOrderId(result.order.id);switchView('cart');
   const paymentUrl=paypalPaymentUrl(result.order)||cardPaymentUrl(result.order);
   if(paymentUrl){setMessage(result.order.provider==='paypal'?'Abrindo o PayPal para concluir o pagamento…':'Abrindo o Asaas para preencher os dados do cartão…');window.location.assign(paymentUrl);return;}
   await load().catch(()=>{});await onRefresh?.();
   if(result.order.status==='paid')setMessage('Pagamento confirmado! Seus arquivos e licenças de venda já estão disponíveis.');
   else setMessage(result.order.billingType!==(international?'PAYPAL':billingType)?'Já existe um pedido pendente para este carrinho. Continue o pagamento salvo abaixo ou consulte Meus pedidos.':'Pedido registrado. Conclua o pagamento abaixo.');
  }catch(e){setMessage(e.message);setRequestId(crypto.randomUUID());await load().catch(()=>{});}finally{setBusy(false)}
 }
 async function refresh(id,details=false){setBusy(true);setMessage('');setPaymentError('');try{const result=await api(details?'club/orders/payment':'club/orders/refresh',{id});setPayment(result);setActiveOrderId(result.order.id);await load();await onRefresh?.();setMessage(result.order.status==='paid'?'Pagamento confirmado! Arquivos e licenças de venda liberados.':'Situação do pagamento atualizada.');}catch(e){setMessage(e.message)}finally{setBusy(false)}}
 async function copy(value){try{await navigator.clipboard.writeText(value);setMessage('Código copiado.');}catch{setMessage('Selecione e copie o código exibido abaixo.');}}
 return <section className="partner-shop">
  <header className="partner-panel-heading"><p className="eyebrow">ÁREA DO PARCEIRO</p><h2>Loja e carrinho</h2><p>Escolha uma peça ou leve a coleção completa. Após o pagamento, seus arquivos e a licença para vender as peças impressas são liberados automaticamente.</p></header>
  {!data?(error?<p className="notice" role="alert">{error} <button type="button" onClick={()=>load().catch(e=>setMessage(e.message))}>Tentar novamente</button></p>:<p>Carregando loja…</p>):<>
   {!data.paymentsReady&&<p className="notice">Os pagamentos estarão disponíveis em breve.</p>}
   <div id="partner-cart" ref={viewHeading} tabIndex={-1} className="shop-shopping-workspace">
   <nav className="shop-view-nav" aria-label="Navegação da loja">{[['catalog','Loja'],['cart',activeOrder?'Minha compra':'Carrinho'],['orders','Meus pedidos'],['files','Meus arquivos']].map(([view,label])=><button key={view} type="button" aria-current={shopView===view?'page':undefined} disabled={busy} onClick={()=>switchView(view)}>{label}{view==='cart'&&!activeOrder&&lines.length>0&&<span>{lines.length}</span>}{view==='orders'&&data.orders.some(o=>['pending','creating','overdue','review'].includes(o.status))&&<span className="shop-pending-dot" aria-label="Há pedidos pendentes"/>}</button>)}</nav>
   <div className="shop-view-content">
   {shopView==='cart'&&<ol className="shop-steps" aria-label="Etapas da compra">{['Carrinho','Pagamento','Concluído'].map((label,index)=>{const step=activeOrder?(activeOrder.status==='paid'?2:1):0;return <li key={label} aria-current={index===step?'step':undefined} className={index<step?'complete':''}><span>{index<step?'✓':index+1}</span>{label}</li>})}</ol>}
   {message&&<p className="notice" role="status">{message}</p>}
   {shopView==='cart'&&activeOrder&&<ShopPayment returning={returningFromAsaas} order={activeOrder} payment={payment} products={data.products} collections={data.collections} money={money} statuses={statuses} busy={busy} loading={paymentLoading} error={paymentError} onRefresh={()=>refresh(activeOrder.id,true)} onCopy={copy} onBrowse={browse} onFiles={()=>switchView('files')} onOrders={()=>switchView('orders')}/>}
   {shopView==='catalog'&&<><header className="shop-view-heading"><div><p className="eyebrow">CRIAÇÕES PARA IMPRIMIR</p><h3>Escolha sua próxima peça</h3><p>Arquivos digitais com licença para vender suas impressões.</p></div>{lines.length>0&&<button className="button primary" onClick={()=>switchView('cart')}>Revisar carrinho · {money(total)} →</button>}</header>
   <div className="shop-offers">{offers.filter(x=>!x.owned).map(item=><article className="shop-offer" key={item.kind+item.id}><img src={item.image} alt="" loading="lazy"/><div><span className="eyebrow">{item.kind==='collection'?`COLEÇÃO · ${item.productIds.length} PEÇAS`:'PEÇA AVULSA'}</span><h3>{item.name}</h3><strong className="shop-price">{money(item.priceCents)}</strong><button className="button outline" disabled={busy||cart.some(x=>x.id===item.id&&x.kind===item.kind)||item.kind==='product'&&selectedCollections.some(c=>c.productIds.includes(item.id))} onClick={()=>add(item)}>{cart.some(x=>x.id===item.id&&x.kind===item.kind)?'No carrinho':'Adicionar ao carrinho'}</button></div></article>)}</div>
   {!offers.filter(x=>!x.owned).length&&<div className="shop-empty-state"><h4>Nenhuma nova peça disponível</h4><p>Veja os arquivos que você já adquiriu ou volte para conhecer as próximas criações.</p><button className="button outline" onClick={()=>switchView('files')}>Acessar meus arquivos</button></div>}</>}
   {shopView==='cart'&&!activeOrder&&<form className="shop-cart admin-panel" onSubmit={purchase}>
    <header className="shop-cart-heading"><div><p className="eyebrow">SUAS ESCOLHAS</p><h3>Seu carrinho</h3></div><span>{lines.length} {lines.length===1?'item':'itens'}</span></header>
    {lines.length?<div className="shop-cart-items">{lines.map(item=><div className="shop-cart-row" key={item.kind+item.id}>{item.image?<img className="shop-cart-thumbnail" src={item.image} alt=""/>:<span className="shop-cart-thumbnail shop-cart-placeholder" aria-hidden="true">3D</span>}<div className="shop-cart-product"><span className="eyebrow">{item.kind==='collection'?'COLEÇÃO':'PEÇA AVULSA'}</span><strong>{item.name}</strong><small>{item.kind==='collection'?`${item.productIds.length} peças incluídas`:'Arquivo digital'} · licença de venda física</small></div><div className="shop-cart-item-actions"><strong>{money(item.priceCents)}</strong><button type="button" disabled={busy} onClick={()=>change(cart.filter(x=>x.id!==item.id||x.kind!==item.kind))} aria-label={`Remover ${item.name}`}>Remover</button></div></div>)}</div>:<div className="shop-cart-empty"><p>Seu carrinho está vazio.</p><small>Escolha uma peça ou coleção para começar.</small><button type="button" className="button primary" onClick={browse}>Explorar a loja</button></div>}
    {cart.length!==selected.length&&<p className="notice">Um item deixou de estar disponível. <button type="button" onClick={()=>change(selected.map(({kind,id})=>({kind,id})))}>Atualizar carrinho</button></p>}
    {lines.length>0&&<>
     <div className="shop-coupon"><label htmlFor="cart-coupon-code">Tem um cupom de desconto?</label><div className="shop-coupon-entry"><input id="cart-coupon-code" placeholder="Digite o código" autoCapitalize="characters" autoComplete="off" maxLength={40} value={couponDraft} disabled={busy||couponBusy} onChange={e=>setCouponDraft(e.target.value.toUpperCase())} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();if(couponDraft.trim()){setCouponCode(couponDraft.trim().toUpperCase());setRequestId(crypto.randomUUID());}}}}/><button type="button" className="button outline" disabled={busy||couponBusy||!couponDraft.trim()} onClick={()=>{setCouponCode(couponDraft.trim().toUpperCase());setRequestId(crypto.randomUUID());}}>{couponBusy?'Validando…':'Aplicar cupom'}</button></div>{couponCode&&<div className="shop-coupon-status"><span role="status">{couponError|| (couponQuote?`Cupom ${couponQuote.coupon.code} aplicado`:'Validando cupom…')}</span><button type="button" disabled={busy} onClick={()=>{setCouponCode('');setCouponDraft('');setRequestId(crypto.randomUUID());}}>Remover cupom</button></div>}</div>
     {couponQuote&&<div className="shop-discount-summary"><p><span>Subtotal</span><strong>{money(couponQuote.subtotalCents)}</strong></p><p><span>Desconto · {couponQuote.coupon.code}</span><strong>− {money(couponQuote.discountCents)}</strong></p></div>}
     <div className="shop-total"><div><span>Total da compra</span><small>Pagamento único · arquivos digitais</small></div><strong>{money(total)}</strong></div>{international&&<p className="notice">Compra internacional · valores em dólar americano (USD). País do cadastro: {member.country}. Pagamento seguro no PayPal.</p>}<div className="shop-billing-summary"><div><strong>{international||hasBillingDocument?member.name:'Complete seus dados para comprar'}</strong><small>{international?'Não é necessário informar CPF/CNPJ para pagar no PayPal.':hasBillingDocument?`${maskedDocument} · salvo em Meus dados`:'Informe seu CPF ou CNPJ uma única vez em Meus dados.'}</small></div><button type="button" disabled={busy} onClick={onEditProfile}>{international||hasBillingDocument?'Editar meus dados':'Preencher meus dados'}</button></div>
     <fieldset disabled={busy} className="shop-checkout-fields">{international?<div className="shop-card-fields"><h4>PayPal · pagamento internacional</h4><p>Você será direcionado ao PayPal para pagar em USD. Ao concluir, volte para conferir a aprovação e acessar os arquivos e licenças.</p></div>:<div className="shop-payment-method"><label>Forma de pagamento<select value={billingType} onChange={e=>{setBillingType(e.target.value);setRequestId(crypto.randomUUID());}}><option value="PIX">Pix</option><option value="BOLETO">Boleto</option><option value="CREDIT_CARD">Cartão de crédito</option></select></label></div>}
     {!international&&billingType==='CREDIT_CARD'&&<div className="shop-card-fields"><AsaasPaymentNotice/><div className="shop-card-form-heading"><div><span className="eyebrow">PAGAMENTO NO ASAAS</span><h4>Preencha seu cartão na próxima etapa</h4></div><div className="shop-card-amount"><span>Total no cartão</span><strong>{money(total)}</strong></div></div><p>Ao continuar, você será direcionado à página do Asaas para informar os dados do cartão e concluir o pagamento. Depois, volte à loja para acessar sua compra.</p></div>}
     {partlyOwned&&<label className="check"><input type="checkbox" checked={overlap} onChange={e=>setOverlap(e.target.checked)} required/>Já possuo peças desta coleção e aceito pagar o preço integral do pacote, sem abatimento.</label>}
     </fieldset>
     <p className="field-help">{international?'Confira o total em USD antes de continuar para o PayPal.':billingType==='CREDIT_CARD'?'Confira o total antes de continuar para o Asaas.':'Pagamento processado pelo Asaas aqui no site.'} A compra inclui licença para vender as peças impressas; os arquivos digitais não podem ser revendidos ou compartilhados.</p>
     <button className={`button primary ${billingType==='CREDIT_CARD'?'shop-card-pay-button':''}`} disabled={busy||Boolean(couponCode&&!couponQuote)||(!international&&!hasBillingDocument)||!data.paymentsReady||cart.length!==selected.length}>{billingType==='CREDIT_CARD'&&<PaymentLock/>}{busy?'Preparando pagamento…':international?`Continuar no PayPal · ${money(total)}`:billingType==='PIX'?`Gerar Pix de ${money(total)}`:billingType==='BOLETO'?`Gerar boleto de ${money(total)}`:`Continuar no Asaas · ${money(total)}`}</button>
    </>}
   </form>}
   {shopView==='files'&&<section className="shop-files"><header className="shop-view-heading"><div><p className="eyebrow">SUA BIBLIOTECA</p><h3>Meus arquivos</h3><p>Baixe os arquivos das suas compras e guarde suas licenças de venda em PDF.</p></div></header>{data.orders.some(o=>o.status==='paid')?<div className="shop-library-purchases">{data.orders.filter(o=>o.status==='paid').map(o=><section key={o.id}><h4>Compra de {new Date(o.createdAt).toLocaleDateString('pt-BR')}</h4><PurchaseDownloads order={o} products={data.products} compact/></section>)}</div>:<div className="shop-empty-state"><h4>Sua biblioteca começa com a primeira peça</h4><p>Após a confirmação do pagamento, os arquivos aparecerão aqui.</p><button className="button primary" onClick={browse}>Explorar a loja</button></div>}</section>}
   {shopView==='orders'&&<section className="shop-history"><header className="shop-view-heading"><div><p className="eyebrow">HISTÓRICO DE COMPRAS</p><h3>Meus pedidos</h3><p>Acompanhe pagamentos e consulte suas compras anteriores.</p></div><label>Mostrar<select value={orderFilter} onChange={e=>setOrderFilter(e.target.value)}><option value="all">Todos os pedidos</option><option value="pending">Aguardando pagamento</option><option value="paid">Pagos</option></select></label></header><div className="shop-history-list">{data.orders.filter(o=>orderFilter==='all'||orderFilter==='paid'&&o.status==='paid'||orderFilter==='pending'&&['creating','pending','review','overdue'].includes(o.status)).map(o=><article className="shop-history-order" key={o.id}><div className="shop-history-order-top"><span>{new Date(o.createdAt).toLocaleDateString('pt-BR')}</span><span className={`shop-status shop-status-${o.status}`}>{statuses[o.status]||o.status}</span></div><div className="shop-history-order-main"><div><h4>{o.items.map(i=>i.name).join(', ')}</h4><p>{{PIX:'Pix',BOLETO:'Boleto',CREDIT_CARD:'Cartão de crédito',PAYPAL:'PayPal'}[o.billingType]}{o.coupon&&` · Cupom ${o.coupon.code}`}</p></div><strong>{money(o.totalCents,o.currency)}</strong></div><div className="shop-history-order-actions"><button className={`button ${['pending','creating','overdue','review'].includes(o.status)?'primary':'outline'}`} disabled={busy} onClick={()=>openOrder(o)}>{['pending','overdue'].includes(o.status)?'Continuar pagamento':o.status==='paid'?'Baixar arquivos e licença':'Ver detalhes'}</button>{o.status==='paid'&&<button className="text-link" onClick={()=>switchView('files')}>Acessar arquivos →</button>}</div></article>)}</div>{!data.orders.length?<div className="shop-empty-state"><h4>Você ainda não tem pedidos</h4><p>As compras feitas na loja aparecerão aqui.</p><button className="button primary" onClick={browse}>Conhecer as peças</button></div>:!data.orders.some(o=>orderFilter==='all'||orderFilter==='paid'&&o.status==='paid'||orderFilter==='pending'&&['creating','pending','review','overdue'].includes(o.status))&&<p className="notice">Nenhum pedido nesta situação.</p>}</section>}
   </div></div>
  </>}
 </section>;
}
