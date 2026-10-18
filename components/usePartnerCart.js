'use client';
import {shopApi} from '../lib/shop-api.mjs';
import {useCallback,useEffect,useState} from 'react';
import {recoveryToken,reminderCopy} from '../lib/cart-reminder-copy.mjs';
import useCartActivity from './useCartActivity';
import {returnedPaymentId} from '../lib/payment-return.mjs';

export default function usePartnerCart(memberId,lang='pt'){
 const [recoveryMessage,setRecoveryMessage]=useState('');
 const [data,setData]=useState(null),[cart,setCart]=useState([]),[requestId,setRequestId]=useState(''),[error,setError]=useState(''),[ready,setReady]=useState(false);
 const [couponCode,setCouponCode]=useState(''),[couponResult,setCouponResult]=useState(null);
 const quoteKey=JSON.stringify({cart,couponCode,requestId});
 const couponQuote=couponResult?.key===quoteKey?couponResult.quote:null;
 const couponError=couponResult?.key===quoteKey?couponResult.error:'';
 const couponBusy=Boolean(couponCode&&cart.length&&couponResult?.key!==quoteKey);
 const [returnedOrderId,setReturnedOrderId]=useState(null);
 const [shopView,setShopView]=useState('catalog'),[activeOrderId,setActiveOrderId]=useState(null);
 const key=`tiolira-cart:${memberId}`;
 useCartActivity(memberId,ready,data,cart,couponCode,lang);
 const load=useCallback(async()=>{
  const next=await shopApi('club/shop',undefined,{timeoutMs:20000});
  setData(next);setError('');return next;
 },[memberId]);
 useEffect(()=>{
  setReady(false);setData(null);setError('');let saved;
  try{saved=JSON.parse(sessionStorage.getItem(key));}catch{}
  setReturnedOrderId(returnedPaymentId(window.location.search));
  const requestedOrder=new URLSearchParams(window.location.search).get('pedido');
  const orderFromEmail=/^[a-f0-9-]{36}$/.test(requestedOrder||'')?requestedOrder:null;
  setShopView(orderFromEmail?'cart':['catalog','cart','orders','files'].includes(saved?.shopView)?saved.shopView:'catalog');setActiveOrderId(orderFromEmail||(typeof saved?.activeOrderId==='string'?saved.activeOrderId:null));
  let cancelled=false;
  const token=recoveryToken(window.location.hash),copy=reminderCopy(lang);
  if(token){
   setRecoveryMessage(copy.loading);setShopView('cart');setActiveOrderId(null);
   (async()=>{
    try{
     const response=await fetch('/api/club/cart-recover',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token})});
     const recovered=await response.json();if(!response.ok){const e=Error(copy[response.status===403?'wrong':response.status===410?'invalid':'retry']);throw e;}
     const next=await load();if(cancelled)return;
     setCart(recovered.items);setCouponCode(recovered.couponCode||'');setCouponResult(null);setRequestId(crypto.randomUUID());setActiveOrderId(recovered.orderId||null);setShopView(recovered.status==='empty'?'orders':'cart');
     if(recovered.cartId)try{sessionStorage.setItem(`tiolira-cart-activity:${memberId}`,JSON.stringify({cartId:recovered.cartId,sequence:recovered.sequence,hadItems:true,ackSignature:JSON.stringify({items:recovered.items,couponCode:recovered.couponCode||'',currency:next.currency})}));}catch{}
     setRecoveryMessage(copy[recovered.status]||copy.restored);setReady(true);window.history.replaceState(null,'',window.location.pathname+window.location.search+'#compras');
    }catch(e){if(!cancelled){setRecoveryMessage(e.message);setCart(Array.isArray(saved?.cart)?saved.cart:[]);setCouponCode(saved?.couponCode||'');setRequestId(saved?.requestId||crypto.randomUUID());await load().catch(err=>setError(err.message));setReady(true);}}
   })();
  }else{
   setRecoveryMessage('');setCart(Array.isArray(saved?.cart)?saved.cart:[]);setCouponCode(typeof saved?.couponCode==='string'?saved.couponCode:'');setCouponResult(null);setRequestId(saved?.requestId||crypto.randomUUID());setReady(true);load().catch(e=>setError(e.message));
  }
  return ()=>{cancelled=true};
 },[key,load]);
 useEffect(()=>{if(ready&&requestId)try{sessionStorage.setItem(key,JSON.stringify({cart,requestId,couponCode,shopView,activeOrderId}));}catch{}},[key,ready,cart,requestId,couponCode,shopView,activeOrderId]);
 useEffect(()=>{
  if(!couponCode||!cart.length){setCouponResult(null);return;}
  let stale=false;setCouponResult(null);
  fetch('/api/club/cart-quote',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({items:cart,couponCode})}).then(async r=>{const quote=await r.json();if(!r.ok)throw Error(quote.error||'Não foi possível validar o cupom.');if(!stale)setCouponResult({key:quoteKey,quote});}).catch(e=>{if(!stale)setCouponResult({key:quoteKey,error:e.message});});
  return ()=>{stale=true};
 },[quoteKey,data]);
 return {recoveryMessage,returnedOrderId,shopView,setShopView,activeOrderId,setActiveOrderId,couponCode,setCouponCode,couponQuote,couponError,couponBusy,data,setData,cart,setCart,requestId,setRequestId,load,error,ready};
}
