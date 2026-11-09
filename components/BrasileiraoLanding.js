'use client';
import {useState} from 'react';
import Link from 'next/link';
import NatalPromotion from './NatalPromotion';
import {brasileiraoLineup,filterBrasileirao,BRASILEIRAO_ID,BRASIL_STATES} from '../lib/brasileirao.mjs';
import {formatMoney} from '../lib/international-pricing.mjs';
import {isAvailable} from '../lib/product-order.mjs';
import '../app/gameday.css';
import '../app/brasileirao.css';

const copy={
 pt:{title:'O Natal veste',accent:'a sua torcida.',lead:'O espírito do Natal encontra a paixão pelo futebol. Escolha seu time e dê vida ao seu Noel com impressão 3D.',action:'Encontrar meu time',pick:'Escalação de Natal',search:'Buscar time, cidade ou estado',state:'Estado',allStates:'Todos os estados',all:'Todos',series:'Série',extras:'Especiais',team:'obra',teams:'obras',file:'Arquivos digitais para impressão 3D',details:'Ver obra',empty:'Nenhum time encontrado',reset:'Limpar filtros',soon:'Em breve',nextTitle:'A Série B vem aí.',nextText:'Novos Noéis estão chegando para completar a torcida. Volte em breve para encontrar seu time.',prev:'Time anterior',next:'Próximo time',note:'Arquivos digitais. Peças físicas não incluídas.',collection:'NOEL BRASILEIRÃO',download:'Escolha · imprima · monte',area:'Área do parceiro',free:'Gratuito',tag:'TIO LIRA · FUTEBOL & NATAL'},
 en:{title:'Christmas wears',accent:'your team colors.',lead:'Christmas spirit meets a passion for Brazilian football. Choose your team and bring your Santa to life with 3D printing.',action:'Find my team',pick:'The Christmas lineup',search:'Search team, city or state',state:'State',allStates:'All states',all:'All',series:'Série',extras:'Special editions',team:'model',teams:'models',file:'Digital files for 3D printing',details:'View model',empty:'No teams found',reset:'Clear filters',soon:'Coming soon',nextTitle:'Série B is on its way.',nextText:'More Santas are joining the lineup. Come back soon to find your team.',prev:'Previous team',next:'Next team',note:'Digital files. Physical models not included.',collection:'BRAZILIAN FOOTBALL SANTAS',download:'Choose · print · assemble',area:'Partner area',free:'Free',tag:'TIO LIRA · FOOTBALL & CHRISTMAS'},
 es:{title:'La Navidad viste',accent:'los colores de tu equipo.',lead:'El espíritu navideño se une a la pasión por el fútbol brasileño. Elige tu equipo y dale vida a tu Papá Noel con impresión 3D.',action:'Encontrar mi equipo',pick:'Alineación navideña',search:'Buscar equipo, ciudad o estado',state:'Estado',allStates:'Todos los estados',all:'Todos',series:'Serie',extras:'Especiales',team:'modelo',teams:'modelos',file:'Archivos digitales para impresión 3D',details:'Ver modelo',empty:'No se encontraron equipos',reset:'Borrar filtros',soon:'Próximamente',nextTitle:'La Serie B está en camino.',nextText:'Llegarán más Papás Noel. Vuelve pronto para encontrar tu equipo.',prev:'Equipo anterior',next:'Siguiente equipo',note:'Archivos digitales. Piezas físicas no incluidas.',collection:'PAPÁS NOEL DEL FÚTBOL BRASILEÑO',download:'Elige · imprime · monta',area:'Área de socios',free:'Gratis',tag:'TIO LIRA · FÚTBOL Y NAVIDAD'},
 fr:{title:'Noël porte',accent:'vos couleurs.',lead:'La magie de Noël rencontre la passion du football brésilien. Choisissez votre équipe et donnez vie à votre Père Noël en impression 3D.',action:'Trouver mon équipe',pick:'La sélection de Noël',search:'Rechercher une équipe, une ville ou un État',state:'État',allStates:'Tous les États',all:'Toutes',series:'Série',extras:'Éditions spéciales',team:'modèle',teams:'modèles',file:'Fichiers numériques pour impression 3D',details:'Voir le modèle',empty:'Aucune équipe trouvée',reset:'Effacer les filtres',soon:'Bientôt',nextTitle:'La Série B arrive.',nextText:'De nouveaux Pères Noël rejoindront la sélection. Revenez bientôt pour trouver votre équipe.',prev:'Équipe précédente',next:'Équipe suivante',note:'Fichiers numériques. Objets physiques non inclus.',collection:'PÈRES NOËL DU FOOTBALL BRÉSILIEN',download:'Choisissez · imprimez · assemblez',area:'Espace Partenaire',free:'Gratuit',tag:'TIO LIRA · FOOTBALL ET NOËL'}
};
export default function BrasileiraoLanding({lang='pt',products}){
 const t=copy[lang]||copy.pt;
 const [query,setQuery]=useState(''),[series,setSeries]=useState(''),[stateCode,setStateCode]=useState(''),[spot,setSpot]=useState(0);
 const lineup=brasileiraoLineup(products),matches=filterBrasileirao(lineup,query,series,stateCode);
 const states=Object.entries(BRASIL_STATES).filter(([code])=>lineup.some(team=>team.stateCode===code)).sort((a,b)=>a[1].localeCompare(b[1],'pt-BR'));
 const featured=lineup.filter(t=>['noel-mengao','noel-palmeiras','noel-bahia'].includes(t.product.slug));
 const highlights=featured.length?featured:lineup.slice(0,3),hero=highlights[spot%highlights.length];
 const count=s=>lineup.filter(t=>t.series===s).length;
 const activeSeries=['A','B','C','D'].filter(s=>count(s));
 const tabs=['','A','B',...['C','D'].filter(s=>count(s)),...(count('extras')?['extras']:[])];
 const label=s=>s==='extras'?t.extras:s?`${t.series} ${s}`:t.all;
 const href=p=>`/${lang}/produto/${p.slug}`;
 const price=p=>!isAvailable(p)?t.soon:p.access==='paid'?formatMoney(p.priceCents,'BRL',lang==='pt'?'pt-BR':lang):t.free;
 return <main className="gameday brasileirao">
  <section className="gd-hero"><div className="br-field" aria-hidden="true"><i/><b/></div><div className="gd-shell gd-pitch">
   <div className="gd-intro"><p className="gd-label">{t.tag}</p><h1>{t.title}<br/><em>{t.accent}</em></h1><p className="gd-lead">{t.lead}</p><a className="gd-cta" href="#lineup">{t.action} ↓</a><p className="br-digital">{t.note}</p></div>
   {hero&&<div className="gd-showcase"><div className="gd-ghost" aria-hidden="true"/><figure className="gd-trade"><div className="gd-tradebar"><b>{t.collection}</b><span aria-hidden="true">★</span></div><Link href={href(hero.product)} aria-label={hero.name}><img className="gd-feature-photo" src={hero.product.image} alt={hero.product.name} fetchPriority="high"/></Link><figcaption><span>{label(hero.series)} · {[hero.city,hero.stateCode].filter(Boolean).join(' · ')}</span><strong>{hero.name}</strong></figcaption></figure><div className="gd-switch"><button type="button" aria-label={t.prev} onClick={()=>setSpot((spot+highlights.length-1)%highlights.length)}>←</button><span aria-live="polite">{spot%highlights.length+1} / {highlights.length}</span><button type="button" aria-label={t.next} onClick={()=>setSpot((spot+1)%highlights.length)}>→</button></div></div>}
  </div></section>
  <div className="br-matchbar"><div className="gd-shell"><span>{t.collection}</span><span>{t.download}</span></div></div>
  <div className="gd-shell br-promotion"><NatalPromotion lang={lang} collectionId={BRASILEIRAO_ID}/></div>
  <section id="lineup" className="gd-shell gd-lineup" aria-labelledby="br-lineup-title"><div className="gd-sectionhead"><h2 id="br-lineup-title">{t.pick}<span>.</span></h2><p>{lineup.length} {t.teams} · {activeSeries.map(s=>`${t.series} ${s}`).join(' / ')}</p></div>
   <div className="gd-filters"><label className="gd-search"><input type="search" value={query} placeholder={t.search} aria-label={t.search} onChange={e=>setQuery(e.target.value)}/></label><label className="br-state"><span>{t.state}</span><select aria-label={t.state} value={stateCode} onChange={e=>setStateCode(e.target.value)}><option value="">{t.allStates}</option>{states.map(([code,name])=><option key={code} value={code}>{name} ({code})</option>)}</select></label><div className="gd-pills" aria-label={t.pick}>{tabs.map(s=><button type="button" key={s} aria-pressed={series===s} onClick={()=>setSeries(s)}>{label(s)} <span>{s==='B'&&!count('B')?t.soon:s?count(s):lineup.length}</span></button>)}</div></div>
   <p id="count" aria-live="polite">{matches.length} {matches.length===1?t.team:t.teams} · {t.file}</p>
   <div id="grid">{matches.map(({product:p,name,city,stateCode,color,series:s})=><Link key={p.id} href={href(p)} className="gd-card" style={{'--club-color':color}}><div className="gd-pic"><img src={p.image} alt={p.name} loading="lazy" width="600" height="900"/></div><div className="gd-cardbody"><span className="gd-teammeta">{label(s)}{city&&` · ${city}`}{stateCode&&` · ${stateCode}`}</span><strong className="gd-clubname">{name}</strong><span className="gd-cardfoot">{price(p)} <small>{t.details} ↗</small></span></div></Link>)}</div>
   {series==='B'&&!count('B')?<div className="br-coming"><span className="br-series">B</span><div><p className="gd-kicker">{t.soon}</p><h3>{t.nextTitle}</h3><p>{t.nextText}</p><button type="button" onClick={()=>{setQuery('');setSeries('');setStateCode('')}}>{t.reset} →</button></div></div>:matches.length===0&&<div id="empty"><h3>{t.empty}</h3><button id="reset" onClick={()=>{setQuery('');setSeries('');setStateCode('')}}>{t.reset}</button></div>}
   <div className="br-bottom"><p>{t.note}</p><Link href={`/${lang}/clube#colecao=${BRASILEIRAO_ID}`}>{t.area} ↗</Link></div>
  </section>
 </main>;
}
