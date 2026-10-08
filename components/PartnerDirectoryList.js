'use client';
import {useId,useState} from 'react';
import {partnerInstagram} from '../lib/instagram.mjs';
import {deliveryLabel} from '../lib/geography.mjs';

export default function PartnerDirectoryList({stores,lang,t,quoteUrl}){
 const [expanded,setExpanded]=useState(null),id=useId();
 return <div className="partner-directory-list">{stores.map((store,index)=>{
  const open=expanded===store.id,panelId=`${id}-panel-${index}`,buttonId=`${id}-button-${index}`;
  const initials=store.name.trim().split(/\s+/).slice(0,2).map(word=>Array.from(word)[0]).join('').toLocaleUpperCase(lang);
  return <article className={`partner-directory-row${open?' expanded':''}`} key={store.id}>
   <h4><button id={buttonId} type="button" className="partner-directory-toggle" aria-expanded={open} aria-controls={panelId} onClick={()=>setExpanded(open?null:store.id)}>
    {store.logo?<img src={store.logo} alt="" className="partner-directory-avatar" width="44" height="44" loading="lazy"/>:<span className="partner-directory-initials" aria-hidden="true">{initials}</span>}
    <span className="partner-directory-label"><strong>{store.name}</strong><span>{store.city} · {store.state}{store.country&&` · ${store.country}`}</span></span>
    <span className="partner-directory-chevron" aria-hidden="true">⌄</span>
   </button></h4>
   <div id={panelId} role="region" aria-labelledby={buttonId} className="partner-directory-detail" hidden={!open}>
    {store.description&&<p>{store.description}</p>}
    {(store.serviceArea||store.delivery)&&<p className="store-delivery">{store.serviceArea?deliveryLabel(store.serviceArea,lang):store.delivery}</p>}
    {store.offeringsUnspecified&&<p className="store-availability">{t.confirmAvailability}</p>}
    <div className="store-card-actions"><a className="store-contact" href={quoteUrl(store)} target="_blank" rel="noreferrer">{t.quote} ↗</a>{partnerInstagram(store)&&<a className="store-instagram" href={partnerInstagram(store)} target="_blank" rel="noopener noreferrer">{t.viewInstagram} ↗</a>}</div>
   </div>
  </article>;
 })}</div>;
}
