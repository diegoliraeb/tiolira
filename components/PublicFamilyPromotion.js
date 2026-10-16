'use client';
import {useEffect,useState} from 'react';
import FamilyPromotion from './FamilyPromotion';
import {cartSelection} from '../lib/cart-lines.mjs';
import {FAMILY_COLLECTION_ID} from '../lib/family-discount.mjs';
// Read the existing member cart; do not create another cart or expose member data.
export default function PublicFamilyPromotion({lang}){
 const [quantity,setQuantity]=useState(0);
 useEffect(()=>{
  let stopped=false;
  async function refresh(){try{
   const session=await fetch('/api/club/me',{cache:'no-store'});if(!session.ok){if(!stopped)setQuantity(0);return;}
   const {member}=await session.json();if(!member?.id)return;
   const response=await fetch('/api/club/shop',{cache:'no-store'});if(!response.ok)return;
   const data=await response.json(),saved=JSON.parse(sessionStorage.getItem(`tiolira-cart:${member.id}`)||'null');
   if(!stopped)setQuantity(cartSelection(data,Array.isArray(saved?.cart)?saved.cart:[]).promotion?.quantity||0);
  }catch{}}
  refresh();window.addEventListener('focus',refresh);window.addEventListener('pageshow',refresh);
  return()=>{stopped=true;window.removeEventListener('focus',refresh);window.removeEventListener('pageshow',refresh);};
 },[]);
 return <FamilyPromotion quantity={quantity} lang={lang} href={`/${lang}/clube#colecao=${FAMILY_COLLECTION_ID}`}/>;
}
