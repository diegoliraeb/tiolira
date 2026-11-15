'use client';
import {useEffect,useState} from 'react';
import {makerCopy,MAKER_VERSION,makerTerms} from '../lib/maker-license.mjs';
export default function MakerSubscription({lang='pt',onRefresh}){
 const c=makerCopy[lang]||makerCopy.pt;
 const [data,setData]=useState(null),[consent,setConsent]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{let stopped=false;fetch('/api/club/maker-subscription').then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error||c.error);if(!stopped)setData(d)}).catch(e=>!stopped&&setError(e.message));return()=>{stopped=true}},[c.error]);
 async function action(kind){if(kind==='cancel'&&!window.confirm(c.confirm))return;setBusy(true);setError('');try{const r=await fetch(`/api/club/maker-subscription/${kind}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({consent,termsVersion:MAKER_VERSION,lang})}),d=await r.json();if(!r.ok)throw Error(d.error||c.error);setData(d);if(kind==='start'&&d.checkoutUrl)window.location.assign(d.checkoutUrl);else await onRefresh?.();}catch(e){setError(e.message)}finally{setBusy(false)}}
 return <section className="maker-subscription"><div className="maker-license-hero"><p className="eyebrow">TIO LIRA × MAKERWORLD</p><h1>{c.title}</h1><strong className="maker-license-price">{c.price}</strong><p>{c.intro}</p><p>{c.details}</p><p>{c.paid}</p></div>
 {data?.active?<div className="maker-license-state"><h2>{c.active} {new Date(data.validUntil).toLocaleDateString(lang,{timeZone:'America/Maceio'})}</h2><a className="button primary" href="/api/club/maker-subscription/license">{c.pdf}</a></div>:data&&<div className="maker-license-state">{['pending','creating','review','subscribed'].includes(data.status)?<><p>{c.pending}</p>{data.checkoutUrl&&<a className="button primary" href={data.checkoutUrl}>{c.subscribe}</a>}</>:<><label className="check"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/><span>{c.consent}</span></label><button className="button primary" disabled={busy||!consent||!data.ready} onClick={()=>action('start')}>{c.subscribe}</button></>}</div>}
 {data?.cancelledAt&&<p className="notice">{c.cancelled}</p>}{data&&!data.ready&&!data.active&&<p className="notice">{c.unavailable}</p>}
 {data?.autoRenew&&<button disabled={busy} className="button outline" onClick={()=>action('cancel')}>{c.cancel}</button>}<button className="button outline" disabled={busy||!data} onClick={()=>action('refresh')}>{c.refresh}</button><details><summary>{c.terms}</summary><p>{makerTerms[lang]||makerTerms.pt}</p></details>{error&&<p role="alert" className="notice">{error}</p>}
 </section>;
}
