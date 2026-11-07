'use client';

import {useState} from 'react';
import Link from 'next/link';
import teams from '../data/gameday-teams.json';
import {formatMoney} from '../lib/international-pricing.mjs';
import '../app/gameday.css';

const copy={
 en:{title:'Santa hits',accent:'the field.',lead:'A football Santa for every fan. Pick your colors and print your own game-day Santa at home.',action:'Find my team',pick:'Pick your team',search:'Search by city or team',all:'All teams',teams:'teams',conferences:'conferences',file:'3MF download',details:'View model',empty:'No teams found',reset:'Clear filters',prev:'Previous team',next:'Next team'},
 pt:{title:'Noel entra',accent:'em campo.',lead:'Um Papai Noel para cada torcida. Escolha as cores do seu time e imprima o seu Noel em 3D.',action:'Encontrar meu time',pick:'Escolha seu time',search:'Buscar por cidade ou time',all:'Todos',teams:'times',conferences:'conferências',file:'Arquivo 3MF',details:'Ver obra',empty:'Nenhum time encontrado',reset:'Limpar filtros',prev:'Time anterior',next:'Próximo time'}
};

export default function GamedayLanding({lang,products}){
 const t=copy[lang], [query,setQuery]=useState(''), [conference,setConference]=useState(''), [spot,setSpot]=useState(0);
 const byId=new Map(products.map(p=>[p.id,p]));
 const lineup=teams.map(team=>({...team,p:byId.get('gameday-santa-'+team.key)})).filter(team=>team.p);
 const featured=lineup.slice(0,3),hero=featured[spot%featured.length];
 const matches=lineup.filter(team=>team.division.startsWith(conference)&&(team.city+' '+team.team).toLowerCase().includes(query.trim().toLowerCase()));
 const link=p=>'/'+lang+'/produto/'+p.slug;
 const price=p=>lang==='pt'?formatMoney(p.priceCents,'BRL','pt-BR'):formatMoney(p.priceUsdCents,'USD','en-US');
 return <main className="gameday">
  <section className="gd-hero"><div className="gd-yard" aria-hidden="true"/><div className="gd-shell gd-pitch">
   <div className="gd-intro"><p className="gd-label"><span className="gd-stitch"/> GAMEDAY SANTAS</p><h1>{t.title.toUpperCase()}<br/><em>{t.accent.toUpperCase()}</em></h1><p className="gd-lead">{t.lead}</p><a className="gd-cta" href="#lineup">{t.action} ↓</a></div>
   {hero&&<div className="gd-showcase"><div className="gd-ghost" aria-hidden="true"/><figure className="gd-trade"><div className="gd-tradebar"><b>GAMEDAY SANTAS</b><span aria-hidden="true">★ ★ ★</span></div><Link href={link(hero.p)}><img className="gd-feature-photo" src={hero.p.image} alt={hero.city+' '+hero.team} fetchPriority="high"/></Link><figcaption><span>{hero.city.toUpperCase()}</span><strong>{hero.team.toUpperCase()}</strong><i aria-hidden="true">★</i></figcaption></figure><div className="gd-switch"><button aria-label={t.prev} onClick={()=>setSpot((spot+featured.length-1)%featured.length)}>←</button><span aria-live="polite">0{spot+1} / 0{featured.length}</span><button aria-label={t.next} onClick={()=>setSpot((spot+1)%featured.length)}>→</button></div></div>}
  </div></section>
  <section id="lineup" className="gd-shell gd-lineup"><div className="gd-sectionhead"><h2>{t.pick}<span>.</span></h2><p>{lineup.length} {t.teams} / 2 {t.conferences}</p></div>
   <div className="gd-filters"><label className="gd-search"><input type="search" value={query} placeholder={t.search} aria-label={t.search} onChange={e=>setQuery(e.target.value)}/></label><div className="gd-pills">{['','AFC','NFC'].map(c=><button key={c} aria-pressed={conference===c} onClick={()=>setConference(c)}>{c||t.all}</button>)}</div></div>
   <p id="count" aria-live="polite">{matches.length} {t.teams} · {t.file}</p><div id="grid">{matches.map(({key,city,team,division,p})=><Link key={key} href={link(p)} className="gd-card"><div className="gd-pic"><img src={p.image} alt={city+' '+team+' Santa'} loading="lazy"/></div><div className="gd-cardbody"><span className="gd-teammeta">{city.toUpperCase()} / {division}</span><strong className="gd-clubname">{team}</strong><span className="gd-cardfoot">{price(p)} <small>{t.details} ↗</small></span></div></Link>)}</div>
   {matches.length===0&&<div id="empty"><h3>{t.empty}</h3><button id="reset" onClick={()=>{setQuery('');setConference('')}}>{t.reset}</button></div>}
  </section>
 </main>;
}
