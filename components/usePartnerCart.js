'use client';
import {useCallback,useEffect,useState} from 'react';

export default function usePartnerCart(memberId){
 const [data,setData]=useState(null),[cart,setCart]=useState([]),[requestId,setRequestId]=useState(''),[error,setError]=useState(''),[ready,setReady]=useState(false);
 const key=`tiolira-cart:${memberId}`;
 const load=useCallback(async()=>{
  const response=await fetch('/api/club/shop',{cache:'no-store'}),next=await response.json();
  if(!response.ok)throw Error(next.error||'Não foi possível carregar o carrinho.');
  setData(next);setError('');return next;
 },[memberId]);
 useEffect(()=>{
  setReady(false);setData(null);setError('');let saved;
  try{saved=JSON.parse(sessionStorage.getItem(key));}catch{}
  setCart(Array.isArray(saved?.cart)?saved.cart:[]);setRequestId(saved?.requestId||crypto.randomUUID());setReady(true);
  load().catch(e=>setError(e.message));
 },[key,load]);
 useEffect(()=>{if(ready&&requestId)try{sessionStorage.setItem(key,JSON.stringify({cart,requestId}));}catch{}},[key,ready,cart,requestId]);
 return {data,setData,cart,setCart,requestId,setRequestId,load,error,ready};
}
