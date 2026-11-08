'use client';
import {useEffect,useState} from 'react';
import {natalActive,promotionEntries} from '../lib/natal-promotion.mjs';
import {natalCopy} from '../lib/natal-copy.mjs';
import {formatMoney} from '../lib/international-pricing.mjs';
import '../app/natal-promotion.css';
export default function NatalPromotion({lang='pt',state,onChoose,onResume,allOwned=false,collectionId='natal-brasileiro'}){
 const [active,setActive]=useState(natalActive(Date.now(),collectionId));
 useEffect(()=>{const check=()=>setActive(natalActive(Date.now(),collectionId));check();const timer=setInterval(check,30000);window.addEventListener('focus',check);return()=>{clearInterval(timer);window.removeEventListener('focus',check)};},[collectionId]);
 if(!active||state?.active===false||state?.used)return null;
 const c=natalCopy(lang,collectionId),prior=state?.previousCount||0,gift=prior>=2;
 return <section className="natal-promo" aria-label={`Black Friday · ${c.collection}`}>
  <div className="natal-promo-copy"><p className="eyebrow">BLACK FRIDAY · {c.collection}</p><h2>{gift&&!allOwned?c.gift:c.title}</h2><p>{allOwned?c.allOwned:state?.reserved?c.reserved:prior>=3?c.loyalty:gift?c.twoBefore:prior===1?c.one:c.previous}</p>
  {!allOwned&&(state?.reserved?<button type="button" className="button" onClick={onResume}>{c.resume} →</button>:onChoose?<button type="button" className="button" onClick={onChoose}>{c.choose} →</button>:<a className="button" href={`/${lang}/clube#colecao=${encodeURIComponent(collectionId)}`}>{c.choose} →</a>)}
  </div><div className="natal-promo-offers"><strong>{c.two}</strong><span>{c.three}</span><small>{c.dates}</small></div>
  <details className="natal-promo-terms"><summary>{c.terms}</summary><p>{c.rules}</p></details>
 </section>;
}
export function NatalSavings({lang='pt',promotion,currency='BRL'}){
 if(!promotion)return null;
 if(promotion.campaigns)return <>{promotionEntries(promotion).map(p=><NatalSavings key={p.id} lang={lang} promotion={p} currency={currency}/>)}</>;
 const c=natalCopy(lang,promotion.collectionId);
 return <div className="natal-savings" role="status"><p><span>{c.savings} · {c.collection} · {promotion.percent===100?c.free:'50% OFF'}</span><strong>− {formatMoney(promotion.discountCents,currency,lang)}</strong></p>{promotion.previousCount>0&&<small>{c.prior}: {promotion.previousCount}</small>}</div>;
}
