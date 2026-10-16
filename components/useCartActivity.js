'use client';
import {useEffect} from 'react';
import {cartSelection} from '../lib/cart-lines.mjs';
export default function useCartActivity(memberId,ready,data,cart,couponCode,lang){
 const items=cartSelection(data,cart).lines.map(({id,kind,quantity})=>({id,kind,...(quantity>1?{quantity}:{})}));
 const signature=JSON.stringify({items,couponCode,currency:data?.currency});
 useEffect(()=>{
  if(!ready||!data)return;
  try{
   const key=`tiolira-cart-activity:${memberId}`;let state;try{state=JSON.parse(sessionStorage.getItem(key));}catch{}
   const hasItems=items.length>0;if(!state&&!hasItems)return;
   if(hasItems&&!state?.hadItems)state={cartId:crypto.randomUUID(),sequence:0,hadItems:true};
   if(state.ackSignature===signature)return;
   state={...state,sequence:state.sequence+1,hadItems:hasItems};sessionStorage.setItem(key,JSON.stringify(state));
   fetch('/api/club/cart-activity',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({cartId:state.cartId,sequence:state.sequence,items,couponCode,lang}),keepalive:true}).then(r=>{if(!r.ok)return;const current=JSON.parse(sessionStorage.getItem(key));if(current?.cartId===state.cartId&&current.sequence===state.sequence)sessionStorage.setItem(key,JSON.stringify({...current,ackSignature:signature}));}).catch(()=>{});
  }catch{}
 },[memberId,ready,Boolean(data),signature]);
}
