'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import Footer from './Footer';
import StoreNetwork from './StoreNetwork';
import MovementWaves from './MovementWaves';
import {dictionaries,localized,languages} from '../lib/i18n';
import {isAvailable,sortProducts} from '../lib/product-order.mjs';
import {collectionCover} from '../lib/collection-covers.mjs';
import {movementCopy} from '../lib/movement-copy.mjs';

const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export default function MovementStudio({lang,catalog}){
 const t=dictionaries[lang],copy=movementCopy(lang),s=localized(catalog.settings,lang);
 const collections=catalog.collections.map(c=>({...localized(c,lang),image:collectionCover(c)}));
 const nativity=collections.find(c=>c.id==='presepio');
 const [activeId,setActiveId]=useState(nativity?.id||collections[0]?.id);
 const active=collections.find(c=>c.id===activeId)||collections[0],activeIndex=collections.findIndex(c=>c.id===active?.id);
 const [motion,setMotion]=useState(false),[filter,setFilter]=useState('all'),[query,setQuery]=useState(''),[onlyAvailable,setOnlyAvailable]=useState(false),[limit,setLimit]=useState(6);
 useEffect(()=>{const media=window.matchMedia('(prefers-reduced-motion: reduce)'),change=()=>setMotion(!media.matches);change();media.addEventListener('change',change);return()=>media.removeEventListener('change',change);},[]);
 const products=sortProducts(catalog.products).map(p=>localized(p,lang)).filter(p=>(filter==='all'||p.collection===filter)&&(!onlyAvailable||isAvailable(p))&&normalize(p.name+' '+p.description).includes(normalize(query)));
 const rawFeature=catalog.products.find(p=>p.slug==='sagrada-familia-caminho-de-nazare');
 const featured=rawFeature?localized(rawFeature,lang):null,featureCollection=collections.find(c=>c.id===featured?.collection);
 const featureUrl=featured?`/${lang}/produto/${featured.slug}`:'';
 function trackClick(id){fetch('/api/products/click',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id}),keepalive:true}).catch(()=>{});}
 function choose(id){setFilter(id);setQuery('');setLimit(6);}
 function select(id){setActiveId(id);choose(id);}
 function step(offset){if(collections.length)select(collections[(activeIndex+offset+collections.length)%collections.length].id);}
 function tilt(e){if(!motion||e.pointerType==='touch')return;const el=e.currentTarget,b=el.getBoundingClientRect(),x=(e.clientX-b.left)/b.width-.5,y=(e.clientY-b.top)/b.height-.5;el.style.setProperty('--ry',`${x*9}deg`);el.style.setProperty('--rx',`${-y*7}deg`);el.style.setProperty('--ix',`${x*10}px`);el.style.setProperty('--iy',`${y*8}px`);}
 function resetTilt(e){['--ry','--rx','--ix','--iy'].forEach(p=>e.currentTarget.style.removeProperty(p));}
 const tiltProps={onPointerMove:tilt,onPointerLeave:resetTilt};
 const price=value=>new Intl.NumberFormat(lang==='pt'?'pt-BR':lang==='es'?'es':'en',{style:'currency',currency:'BRL'}).format(value/100);
 return <div id="tl-vivo" className="movement-site" data-motion={motion?'on':'off'}>
  <a className="skip" href="#obras">{t.works}</a>
  {s.announcement&&<div className="announcement"><span>{s.announcement}</span><Link href={`/${lang}/clube`}>{t.club} ↗</Link></div>}
  <header className="v-header">
   <Link className="v-brand" href={`/${lang}`} aria-label="Tio Lira"><img src="/assets/tl-monogram-3d.webp" alt="TL" width="42" height="42"/><span>tio lira<small>{t.studio}</small></span></Link>
   <nav aria-label={t.collections}><a href="#colecoes">{t.collections}</a><a href="#obras" onClick={()=>choose('all')}>{t.works}</a><a href="#lojas">{copy.makerNav}</a><Link href={`/${lang}/clube`}>{t.club}</Link></nav>
   <div className="v-header-right"><div className="v-languages" aria-label="Idioma / Language">{languages.map(l=><Link key={l} href={`/${l}`} lang={l} aria-current={l===lang?'page':undefined}>{l.toUpperCase()}</Link>)}</div><Link className="v-pill" href={`/${lang}/clube`}>{t.clubArea} <span>↗</span></Link></div>
  </header>
  <main>
   <section className="v-hero" id="inicio">
    <MovementWaves enabled={motion}/>
    <div className="v-hero-top"><span className="v-overline"><b/>{copy.eyebrow}</span><button className="v-motion" aria-pressed={!motion} onClick={()=>setMotion(!motion)}>{motion?'Ⅱ':'▷'} {motion?copy.pause:copy.play}</button></div>
    <div className="v-hero-grid"><div className="v-hero-copy"><span className="v-tiny">{copy.tiny}</span><h1>{copy.title[0]}<br/>{copy.title[1]}<br/><em>{copy.title[2]}</em></h1><p>{copy.intro}</p><a className="v-pill v-primary" href={nativity?'#presente':'#colecoes'}>{nativity?copy.nativity:copy.explore}<span>↘</span></a><a className="v-text-link" href="#lojas">{copy.makers} ↗</a></div>
     {active&&<div className="v-gallery"><div className="v-orbit" aria-hidden="true"/><span className="v-gallery-word" aria-hidden="true">{lang==='en'?'create.':'criar.'}</span><a className="v-main-photo v-tilt" href="#obras" onClick={()=>choose(active.id)} aria-label={`${copy.explore}: ${active.name}`} {...tiltProps}><img key={active.id} className="v-hero-img" src={active.image} alt={active.name} width="1000" height="1000" fetchPriority="high"/><span className="v-photo-glint"/><span className="v-photo-action">{copy.explore}<b>↗</b></span></a>
      {featured&&<Link className="v-floating-photo v-tilt" href={featureUrl} aria-label={featured.name} onClick={()=>trackClick(featured.id)} {...tiltProps}><img src={featured.image} alt={featured.name} width="240" height="240"/><span>{copy.closeLook} ↗</span></Link>}
      <div className="v-gallery-caption"><span className="v-counter">{String(activeIndex+1).padStart(2,'0')} / {String(collections.length).padStart(2,'0')}</span><div aria-live="polite"><small>{active.comingSoon?t.soon:t.collections}</small><h2>{active.name}</h2></div><div className="v-arrows"><button aria-label={copy.previous} onClick={()=>step(-1)}>←</button><button aria-label={copy.next} onClick={()=>step(1)}>→</button></div></div>
     </div>}
    </div><div className="v-hero-bottom"><span>{copy.author}</span><a href="#colecoes">{copy.scroll} ↓</a><span>POR DIEGO LIRA</span></div>
   </section>
   {nativity&&<section className="v-gift" id="presente"><img src={nativity.image} alt={nativity.name} width="600" height="600" loading="lazy"/><div><span className="v-overline">{copy.gift}</span><h2>{copy.giftTitle[0]}<br/>{copy.giftTitle[1]} <em>{copy.giftTitle[2]}</em></h2><p>{copy.giftText}</p><Link className="v-pill" href={`/${lang}/clube#colecao=presepio`}>{copy.giftAction}<span>↗</span></Link></div><span className="v-gift-mark" aria-hidden="true">✳</span></section>}
   {active&&<section className="v-collections" id="colecoes"><div className="v-section-heading"><div><p className="v-overline">{copy.collectionsEyebrow}</p><h2>{copy.collectionsTitle[0]} <em>{copy.collectionsTitle[1]}</em></h2></div><p>{copy.collectionsIntro}</p></div>
    <div className="v-collection-deck" aria-label={t.collections}>{collections.map((c,i)=><button className="v-collection-card" key={c.id} aria-label={`${t.explore}: ${c.name}`} aria-pressed={active.id===c.id} onClick={()=>select(c.id)}><img src={c.image} alt="" width="600" height="600" loading="lazy"/><span className="v-num">{String(i+1).padStart(2,'0')}</span><span className="v-card-name">{c.name}</span><span className="v-card-arrow">↗</span></button>)}</div>
    <div className="v-collection-detail" aria-live="polite"><div><span className="v-detail-kind">{active.comingSoon?t.soon:t.collections}</span><h3>{active.name}</h3></div><p className="v-detail-description">{active.description}</p><a className="v-pill" href="#obras" onClick={()=>choose(active.id)}>{t.explore}<span>↗</span></a></div>
   </section>}
   {featured&&<section className="v-works" id="destaque"><div className="v-section-heading"><div><p className="v-overline">{featureCollection?.name}</p><h2>{copy.featureTitle[0]} <em>{copy.featureTitle[1]}</em></h2></div><a className="v-text-link" href="#obras" onClick={()=>choose(featured.collection)}>{copy.allWorks} ↗</a></div><div className="v-work-grid"><Link className="v-work-image v-tilt" href={featureUrl} onClick={()=>trackClick(featured.id)} aria-label={featured.name} {...tiltProps}><img src={featured.image} alt={featured.name} loading="lazy" width="900" height="900"/><span className="v-photo-glint"/><span className="v-work-label">Caminho de Nazaré <b>+</b></span></Link><div className="v-work-copy"><span className="v-overline">{copy.featureEyebrow}</span><h3>Caminho<br/>de <em>Nazaré.</em></h3><p>{(lang==='pt'&&featured.summary)||featured.description.split('\n\n')[0]}</p><div className="v-specs"><span>{featured.size}</span><span>{copy.file}</span></div>{featured.access==='paid'&&<strong className="v-price">{price(featured.priceCents)}</strong>}<Link className="v-pill v-primary" href={featureUrl} onClick={()=>trackClick(featured.id)}>{isAvailable(featured)?copy.featureAction:t.soon}<span>↗</span></Link><p className="v-small">{copy.fileNote}</p></div></div></section>}
   <section className="catalog-section" id="obras"><div className="wrap section"><div className="section-heading"><div><p className="eyebrow">{t.catalogEyebrow}</p><h2>{t.catalogTitle}</h2></div><label className="search"><span>⌕</span><input type="search" placeholder={t.search} aria-label={t.search} value={query} onChange={e=>{setQuery(e.target.value);setLimit(6)}}/></label></div><div className="catalog-toolbar"><div className="filters"><button aria-pressed={filter==='all'} onClick={()=>choose('all')}>{t.all}</button>{collections.map(c=><button key={c.id} aria-pressed={filter===c.id} onClick={()=>choose(c.id)}>{c.name}</button>)}</div><label className="availability"><input type="checkbox" checked={onlyAvailable} onChange={e=>setOnlyAvailable(e.target.checked)}/>{t.available}</label></div><div className="catalog-meta"><span role="status">{products.length} {t.results}</span><span>{t.digital}</span></div><div className="product-grid">{products.slice(0,limit).map(p=><article className="product-card" key={p.id}><Link className="product-image" href={`/${lang}/produto/${p.slug}`} onClick={()=>trackClick(p.id)} onAuxClick={e=>{if(e.button===1)trackClick(p.id)}}><img src={p.image} alt={p.name} loading="lazy"/><span className={`badge ${!isAvailable(p)?'coming':''}`}>{!isAvailable(p)?t.soon:t[p.access==='site'?'free':p.access]}</span><span className="image-arrow">↗</span></Link><div className="product-info"><p className="category">{collections.find(c=>c.id===p.collection)?.name}</p><h3>{p.name}</h3><div className="product-bottom"><Link href={`/${lang}/produto/${p.slug}`} onClick={()=>trackClick(p.id)} onAuxClick={e=>{if(e.button===1)trackClick(p.id)}}>{t.details} →</Link>{p.size&&<span>{p.size}</span>}</div></div></article>)}</div>{products.length===0&&<p className="empty">{t.none}</p>}{products.length>limit&&<div className="more-wrap"><button className="button outline" onClick={()=>setLimit(limit+6)}>{t.more} ↓</button></div>}</div></section>
   <StoreNetwork lang={lang} catalog={catalog}/>
   <section className="v-club" id="clube"><MovementWaves enabled={motion} variant="club"/><div><span className="v-overline">{copy.clubEyebrow}</span><h2>{copy.clubTitle[0]}<br/>{copy.clubTitle[1]} <em>{copy.clubTitle[2]}</em></h2><p>{copy.clubIntro}</p><Link className="v-pill v-cream" href={`/${lang}/clube`}>{t.clubLoginSubmit}<span>↗</span></Link></div><div className="v-club-links">{['compras','licencas','cupons','cadastro'].map((hash,i)=><Link key={hash} href={`/${lang}/clube#${hash}`}><span>0{i+1}</span>{copy.clubLinks[i]}<b>↗</b></Link>)}{catalog.plans.filter(p=>p.status==='active').map(p=><a key={p.id} href={p.url} target="_blank" rel="noreferrer">{localized(p,lang).name} · {p.priceLabel} ↗</a>)}</div></section>
   <section className="about wrap" id="sobre"><div className="about-art"><img src="/assets/efc464ed6ed95396.jpg" alt={t.original} loading="lazy"/><span>{t.fromBrazil}</span></div><div className="about-copy"><p className="eyebrow">{t.aboutEyebrow}</p><h2>{t.aboutTitle}</h2><p>{s.about}</p><a className="text-link" href={s.instagram} target="_blank" rel="noreferrer">{t.instagram} ↗</a><span className="signature">Diego Lira</span></div></section>
 <section className="faq wrap section"><div><p className="eyebrow">TIO LIRA / FAQ</p><h2>{t.faqTitle}</h2><Link className="calculator-link" href={`/${lang}/calculadora`}>{t.sell}<br/><strong>{t.calculator} ↗</strong></Link></div><div className="faq-list">{t.faq.map(([q,a])=><details key={q}><summary>{q}</summary><p>{a}</p></details>)}</div></section>
  </main><Footer lang={lang}/>
 </div>;
}
