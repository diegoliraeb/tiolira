'use client';
import {useEffect,useState} from 'react';
import {cartSelection} from '../lib/cart-lines.mjs';

export const money=cents=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format((cents||0)/100);
export const statuses={creating:'Conferindo cobrança',pending:'Aguardando pagamento',overdue:'Vencido',paid:'Pagamento confirmado',revoked:'Acesso suspenso por estorno',cancelled:'Cancelado',failed:'Não concluído',review:'Em análise'};
const blankCard=(member={})=>({holderName:'',number:'',expiryMonth:'',expiryYear:'',ccv:'',name:member.name||'',email:member.email||'',cpfCnpj:'',postalCode:'',addressNumber:'',phone:member.whatsapp||''});
async function api(path,body){const r=await fetch('/api/'+path,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{cache:'no-store'}),data=await r.json();if(!r.ok)throw Error(data.error||'Não foi possível concluir.');return data;}
export default function PartnerShop({cartState,member,onEditProfile,onRefresh,requestedProductId,onProductConsumed}){
 const {couponCode,setCouponCode,couponQuote,couponError,couponBusy,data,setData,cart,setCart,requestId,setRequestId,load,error}=cartState;
 const [couponDraft,setCouponDraft]=useState(couponCode);
 const hasBillingDocument=/^(\d{11}|\d{14})$/.test(member.cpfCnpj||'');
 const maskedDocument=hasBillingDocument?`${member.cpfCnpj.length===11?'CPF •••.•••.•••-':'CNPJ ••.•••.•••/••••-'}${member.cpfCnpj.slice(-2)}`:'';
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[otherHolder,setOtherHolder]=useState(false),[billingType,setBillingType]=useState('PIX'),[overlap,setOverlap]=useState(false),[card,setCard]=useState(()=>blankCard(member)),[payment,setPayment]=useState(null);
 useEffect(()=>{
  if(!data||!requestedProductId)return;
  const item=data.products.find(p=>p.id===requestedProductId&&!p.owned);
  if(item)add({...item,kind:'product',productIds:[item.id]});
  else setMessage('Esta peça não está disponível para compra ou já pertence à sua biblioteca.');
  onProductConsumed?.();
 },[data,requestedProductId]);
 const activeOrder=data?.orders.find(o=>o.id===payment?.order?.id)||payment?.order;
 // Poll our own order state while the webhook confirms payment, without repeated Asaas calls.
 useEffect(()=>{
  if(!activeOrder||!['creating','pending','review','overdue'].includes(activeOrder.status))return;
  let stopped=false;const timer=setInterval(async()=>{if(document.hidden)return;try{const next=await api('club/shop');if(stopped)return;setData(next);const order=next.orders.find(o=>o.id===activeOrder.id);if(order?.status==='paid'){setMessage('Pagamento confirmado! Arquivos e licenças de venda liberados.');await onRefresh?.();}}catch{}},12000);
  return()=>{stopped=true;clearInterval(timer)};
 },[activeOrder?.id,activeOrder?.status]);
 const {offers,selected,selectedCollections,lines,total:subtotal}=cartSelection(data,cart);
 const partlyOwned=selectedCollections.some(c=>c.productIds.some(id=>data.products.some(p=>p.id===id&&p.owned))&&!c.owned);
 function change(next){setCart(next);setRequestId(crypto.randomUUID());setOverlap(false);setMessage('');}
 function add(item){if(cart.some(x=>x.id===item.id&&x.kind===item.kind))return;change([...cart.filter(x=>item.kind!=='collection'||x.kind!=='product'||!item.productIds.includes(x.id)),{id:item.id,kind:item.kind}]);}
 async function showPayment(order){setPayment({order});if(['pending','overdue'].includes(order.status)&&order.billingType!=='CREDIT_CARD')setPayment(await api('club/orders/payment',{id:order.id}));}
 const total=couponQuote?.totalCents??subtotal;
 async function purchase(e){
  e.preventDefault();setBusy(true);setMessage('');
  try{
   const cardData=billingType==='CREDIT_CARD'?{creditCard:{holderName:card.holderName,number:card.number,expiryMonth:card.expiryMonth,expiryYear:card.expiryYear,ccv:card.ccv},creditCardHolderInfo:{name:card.name,email:card.email,cpfCnpj:otherHolder?card.cpfCnpj:member.cpfCnpj,postalCode:card.postalCode,addressNumber:card.addressNumber,phone:card.phone}}:{};
   const result=await api('club/checkout',{items:cart,requestId,billingType,couponCode,expectedTotalCents:total,acceptOverlap:overlap,...cardData});
   change([]);setCouponCode('');setCouponDraft('');setOtherHolder(false);setCard(blankCard(member));setPayment({order:result.order});await load();await onRefresh?.();
   if(result.order.status==='paid')setMessage('Pagamento confirmado! Seus arquivos e licenças de venda já estão disponíveis.');
   else{setMessage('Pedido registrado. A confirmação aparecerá aqui automaticamente.');try{await showPayment(result.order);}catch{setMessage('Pedido registrado. Use “Ver pagamento” para recuperar as instruções sem gerar outra cobrança.');}}
  }catch(e){setMessage(e.message);setRequestId(crypto.randomUUID());await load().catch(()=>{});}finally{setCard(blankCard(member));setBusy(false)}
 }
 async function refresh(id,details=false){setBusy(true);setMessage('');try{const result=await api(details?'club/orders/payment':'club/orders/refresh',{id});setPayment(result);await load();await onRefresh?.();setMessage(result.order.status==='paid'?'Pagamento confirmado! Arquivos e licenças de venda liberados.':'Situação do pagamento atualizada.');}catch(e){setMessage(e.message)}finally{setBusy(false)}}
 async function copy(value){try{await navigator.clipboard.writeText(value);setMessage('Código copiado.');}catch{setMessage('Selecione e copie o código exibido abaixo.');}}
 function cardField(key,label,props={}){return <label>{label}<input value={card[key]} onChange={e=>setCard(c=>({...c,[key]:e.target.value}))} required {...props}/></label>}
 return <section className="partner-shop">
  <header className="partner-panel-heading"><p className="eyebrow">ÁREA DO PARCEIRO</p><h2>Loja e carrinho</h2><p>Escolha uma peça ou leve a coleção completa. Após o pagamento, seus arquivos e a licença para vender as peças impressas são liberados automaticamente.</p></header>
  {message&&<p className="notice" role="status">{message}</p>}
  {!data?(error?<p className="notice" role="alert">{error} <button type="button" onClick={()=>load().catch(e=>setMessage(e.message))}>Tentar novamente</button></p>:<p>Carregando loja…</p>):<>
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
   <form id="partner-cart" className="shop-cart admin-panel" onSubmit={purchase}>
    <header className="shop-cart-heading"><div><p className="eyebrow">SUAS ESCOLHAS</p><h3>Seu carrinho</h3></div><span>{lines.length} {lines.length===1?'item':'itens'}</span></header>
    {lines.length?<div className="shop-cart-items">{lines.map(item=><div className="shop-cart-row" key={item.kind+item.id}>{item.image?<img className="shop-cart-thumbnail" src={item.image} alt=""/>:<span className="shop-cart-thumbnail shop-cart-placeholder" aria-hidden="true">3D</span>}<div className="shop-cart-product"><span className="eyebrow">{item.kind==='collection'?'COLEÇÃO':'PEÇA AVULSA'}</span><strong>{item.name}</strong><small>{item.kind==='collection'?`${item.productIds.length} peças incluídas`:'Arquivo digital'} · licença de venda física</small></div><div className="shop-cart-item-actions"><strong>{money(item.priceCents)}</strong><button type="button" disabled={busy} onClick={()=>change(cart.filter(x=>x.id!==item.id||x.kind!==item.kind))} aria-label={`Remover ${item.name}`}>Remover</button></div></div>)}</div>:<div className="shop-cart-empty"><p>Seu carrinho está vazio.</p><small>Escolha uma peça ou coleção para começar.</small></div>}
    {cart.length!==selected.length&&<p className="notice">Um item deixou de estar disponível. <button type="button" onClick={()=>change(selected.map(({kind,id})=>({kind,id})))}>Atualizar carrinho</button></p>}
    {lines.length>0&&<>
     <div className="shop-coupon"><label htmlFor="cart-coupon-code">Tem um cupom de desconto?</label><div className="shop-coupon-entry"><input id="cart-coupon-code" placeholder="Digite o código" autoCapitalize="characters" autoComplete="off" maxLength={40} value={couponDraft} disabled={busy||couponBusy} onChange={e=>setCouponDraft(e.target.value.toUpperCase())} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();if(couponDraft.trim()){setCouponCode(couponDraft.trim().toUpperCase());setRequestId(crypto.randomUUID());}}}}/><button type="button" className="button outline" disabled={busy||couponBusy||!couponDraft.trim()} onClick={()=>{setCouponCode(couponDraft.trim().toUpperCase());setRequestId(crypto.randomUUID());}}>{couponBusy?'Validando…':'Aplicar cupom'}</button></div>{couponCode&&<div className="shop-coupon-status"><span role="status">{couponError|| (couponQuote?`Cupom ${couponQuote.coupon.code} aplicado`:'Validando cupom…')}</span><button type="button" disabled={busy} onClick={()=>{setCouponCode('');setCouponDraft('');setRequestId(crypto.randomUUID());}}>Remover cupom</button></div>}</div>
     {couponQuote&&<div className="shop-discount-summary"><p><span>Subtotal</span><strong>{money(couponQuote.subtotalCents)}</strong></p><p><span>Desconto · {couponQuote.coupon.code}</span><strong>− {money(couponQuote.discountCents)}</strong></p></div>}
     <div className="shop-total"><div><span>Total da compra</span><small>Pagamento único · arquivos digitais</small></div><strong>{money(total)}</strong></div><div className="shop-billing-summary"><div><strong>{hasBillingDocument?member.name:'Complete seus dados para comprar'}</strong><small>{hasBillingDocument?`${maskedDocument} · salvo em Meus dados`:'Informe seu CPF ou CNPJ uma única vez em Meus dados.'}</small></div><button type="button" disabled={busy} onClick={onEditProfile}>{hasBillingDocument?'Editar meus dados':'Preencher meus dados'}</button></div>
     <fieldset disabled={busy} className="shop-checkout-fields"><div className="shop-payment-method"><label>Forma de pagamento<select value={billingType} onChange={e=>{setBillingType(e.target.value);setCard(blankCard(member));setRequestId(crypto.randomUUID());}}><option value="PIX">Pix</option><option value="BOLETO">Boleto</option><option value="CREDIT_CARD">Cartão de crédito</option></select></label></div>
     {billingType==='CREDIT_CARD'&&<div className="shop-card-fields"><h4>Cartão de crédito · à vista</h4><div className="form-grid">
      {cardField('holderName','Nome impresso no cartão',{autoComplete:'cc-name',maxLength:100})}{cardField('number','Número do cartão',{autoComplete:'cc-number',inputMode:'numeric',maxLength:23})}
      {cardField('expiryMonth','Mês de validade (MM)',{autoComplete:'cc-exp-month',inputMode:'numeric',pattern:'0[1-9]|1[0-2]',maxLength:2,placeholder:'MM'})}{cardField('expiryYear','Ano de validade (AAAA)',{autoComplete:'cc-exp-year',inputMode:'numeric',pattern:'20[0-9]{2}',maxLength:4,placeholder:'AAAA'})}
      {cardField('ccv','Código de segurança',{type:'password',autoComplete:'off',inputMode:'numeric',pattern:'[0-9]{3,4}',maxLength:4})}
     </div><h4>Dados do titular</h4><label className="check"><input type="checkbox" checked={otherHolder} onChange={e=>{setOtherHolder(e.target.checked);setCard(c=>({...c,cpfCnpj:''}));}}/>O cartão pertence a outra pessoa</label>{!otherHolder&&<p className="field-help">Usaremos o CPF/CNPJ salvo em Meus dados.</p>}<div className="form-grid">
      {cardField('name','Nome completo do titular',{autoComplete:'name',maxLength:100})}{cardField('email','E-mail do titular',{type:'email',autoComplete:'email',maxLength:254})}{otherHolder&&cardField('cpfCnpj','CPF ou CNPJ do outro titular',{inputMode:'numeric',autoComplete:'off',maxLength:18})}{cardField('phone','Telefone com DDD',{inputMode:'tel',autoComplete:'tel-national',maxLength:16})}{cardField('postalCode','CEP da fatura',{inputMode:'numeric',autoComplete:'postal-code',maxLength:9})}{cardField('addressNumber','Número do endereço da fatura',{autoComplete:'off',maxLength:20})}
     </div></div>}
     {partlyOwned&&<label className="check"><input type="checkbox" checked={overlap} onChange={e=>setOverlap(e.target.checked)} required/>Já possuo peças desta coleção e aceito pagar o preço integral do pacote, sem abatimento.</label>}
     </fieldset>
     <p className="field-help">Pagamento processado pelo Asaas aqui no site. Os dados do cartão não são salvos. A compra inclui licença para vender as peças impressas; os arquivos digitais não podem ser revendidos ou compartilhados.</p>
     <button className="button primary" disabled={busy||Boolean(couponCode&&!couponQuote)||!hasBillingDocument||!data.paymentsReady||cart.length!==selected.length}>{busy?'Processando…':billingType==='PIX'?`Gerar Pix de ${money(total)}`:billingType==='BOLETO'?`Gerar boleto de ${money(total)}`:`Pagar ${money(total)} com cartão`}</button>
    </>}
   </form>
   <section className="club-library"><h3>Meus arquivos comprados</h3>{data.products.some(p=>p.owned)?<div className="club-download-grid">{data.products.filter(p=>p.owned).map(p=><article className="club-download-card" key={p.id}><img src={p.image} alt=""/><div><h3>{p.name}</h3><a className="button primary" href={p.downloadUrl}>Baixar arquivo</a><a className="button outline" href="#licencas">Ver licença de venda</a></div></article>)}</div>:<p>Seus arquivos e licenças serão liberados após o pagamento.</p>}</section>
   <section className="club-library"><h3>Meus pedidos</h3>{data.orders.length?data.orders.map(o=><article className="shop-order" key={o.id}><div><strong>{o.items.map(i=>i.name).join(', ')}</strong><p>{new Date(o.createdAt).toLocaleDateString('pt-BR')} · {money(o.totalCents)} · {statuses[o.status]||o.status}</p><small>Pedido {o.id}</small>{o.coupon&&<p>Cupom {o.coupon.code} · desconto {money(o.discountCents)}</p>}</div><div className="partner-actions">{['pending','overdue'].includes(o.status)&&<button className="button outline" disabled={busy} onClick={()=>refresh(o.id,true)}>Ver pagamento</button>}{['creating','review'].includes(o.status)&&<button className="button outline" disabled={busy} onClick={()=>refresh(o.id)}>Consultar pagamento</button>}{o.status==='paid'&&<a className="button outline" href="#licencas">Ver licenças</a>}</div></article>):<p>Nenhum pedido ainda.</p>}</section>
  </>}
 </section>;
}
