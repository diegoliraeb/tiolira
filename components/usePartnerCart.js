'use client';
import {useCallback,useEffect,useState} from 'react';
import {returnedPaymentId} from '../lib/payment-return.mjs';

export default function usePartnerCart(memberId){
 const [data,setData]=useState(null),[cart,setCart]=useState([]),[requestId,setRequestId]=useState(''),[error,setError]=useState(''),[ready,setReady]=useState(false);
 const [couponCode,setCouponCode]=useState(''),[couponResult,setCouponResult]=useState(null);
 const quoteKey=JSON.stringify({cart,couponCode,requestId});
 const couponQuote=couponResult?.key===quoteKey?couponResult.quote:null;
 const couponError=couponResult?.key===quoteKey?couponResult.error:'';
 const couponBusy=Boolean(couponCode&&cart.length&&couponResult?.key!==quoteKey);
 const [returnedOrderId,setReturnedOrderId]=useState(null);
 const [shopView,setShopView]=useState('catalog'),[activeOrderId,setActiveOrderId]=useState(null);
 const key=`tiolira-cart:${memberId}`;
 const load=useCallback(async()=>{
  const response=await fetch('/api/club/shop',{cache:'no-store'}),next=await response.json();
  if(!response.ok)throw Error(next.error||'Não foi possível carregar o carrinho.');
  setData(next);setError('');return next;
 },[memberId]);
 useEffect(()=>{
  setReady(false);setData(null);setError('');let saved;
  try{saved=JSON.parse(sessionStorage.getItem(key));}catch{}
  setReturnedOrderId(returnedPaymentId(window.location.search));
  const requestedOrder=new URLSearchParams(window.location.search).get('pedido');
  const orderFromEmail=/^[a-f0-9-]{36}$/.test(requestedOrder||'')?requestedOrder:null;
  setShopView(orderFromEmail?'cart':['catalog','cart','orders','files'].includes(saved?.shopView)?saved.shopView:'catalog');setActiveOrderId(orderFromEmail||(typeof saved?.activeOrderId==='string'?saved.activeOrderId:null));
  setCart(Array.isArray(saved?.cart)?saved.cart:[]);setCouponCode(typeof saved?.couponCode==='string'?saved.couponCode:'');setCouponResult(null);setRequestId(saved?.requestId||crypto.randomUUID());setReady(true);
  load().catch(e=>setError(e.message));
 },[key,load]);
 useEffect(()=>{if(ready&&requestId)try{sessionStorage.setItem(key,JSON.stringify({cart,requestId,couponCode,shopView,activeOrderId}));}catch{}},[key,ready,cart,requestId,couponCode,shopView,activeOrderId]);
 useEffect(()=>{
  if(!couponCode||!cart.length){setCouponResult(null);return;}
  let stale=false;setCouponResult(null);
  fetch('/api/club/cart-quote',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({items:cart,couponCode})}).then(async r=>{const quote=await r.json();if(!r.ok)throw Error(quote.error||'Não foi possível validar o cupom.');if(!stale)setCouponResult({key:quoteKey,quote});}).catch(e=>{if(!stale)setCouponResult({key:quoteKey,error:e.message});});
  return ()=>{stale=true};
 },[quoteKey,data]);
 return {returnedOrderId,shopView,setShopView,activeOrderId,setActiveOrderId,couponCode,setCouponCode,couponQuote,couponError,couponBusy,data,setData,cart,setCart,requestId,setRequestId,load,error,ready};
}
