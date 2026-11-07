'use client';
import {useEffect,useState} from 'react';
import {natalActive} from '../lib/natal-promotion.mjs';
import {natalCopy} from '../lib/natal-copy.mjs';
import {formatMoney} from '../lib/international-pricing.mjs';
import '../app/natal-promotion.css';
export default function NatalPromotion({lang='pt',state,onChoose,onResume,allOwned=false}){
 const [active,setActive]=useState(natalActive());
 useEffect(()=>{const check=()=>setActive(natalActive());check();const timer=setInterval(check,30000);window.addEventListener('focus',check);return()=>{clearInterval(timer);window.removeEventListener('focus',check)};},[]);
 if(!active||state?.active===false||state?.used)return null;
 const c=natalCopy(lang),prior=state?.previousCount||0,gift=prior>=2;
 return <section className="natal-promo" aria-label={`Black Friday · ${c.collection}`}>
  <div className="natal-promo-copy"><p className="eyebrow">BLACK FRIDAY · {c.collection}</p><h2>{gift&&!allOwned?c.gift:c.title}</h2><p>{allOwned?c.allOwned:state?.reserved?c.reserved:prior>=3?c.loyalty:gift?c.twoBefore:prior===1?c.one:c.previous}</p>
  {!allOwned&&(state?.reserved?<button type="button" className="button" onClick={onResume}>{c.resume} →</button>:onChoose?<button type="button" className="button" onClick={onChoose}>{c.choose} →</button>:<a className="button" href={`/${lang}/clube#colecao=natal-brasileiro`}>{c.choose} →</a>)}
  </div><div className="natal-promo-offers"><strong>{c.two}</strong><span>{c.three}</span><small>{c.dates}</small></div>
  <details className="natal-promo-terms"><summary>{c.terms}</summary><p>{c.rules}</p></details>
 </section>;
}
export function NatalSavings({lang='pt',promotion,currency='BRL'}){
 if(!promotion)return null;const c=natalCopy(lang);
 return <div className="natal-savings" role="status"><p><span>{c.savings} · {promotion.percent===100?c.free:'50% OFF'}</span><strong>− {formatMoney(promotion.discountCents,currency,lang)}</strong></p>{promotion.previousCount>0&&<small>{c.prior}: {promotion.previousCount}</small>}</div>;
}
