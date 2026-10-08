'use client';
import {useId} from 'react';
import geometry from '../data/geography/br-map.json';
import {brStates} from '../lib/geography.mjs';

export default function StoreMap({counts,stateId,region,onSelect,t}){
 const id=useId(),total=Object.values(counts).reduce((n,v)=>n+v,0);
 return <div className="store-map-block">
  <div className="store-map-heading"><div><h3>{t.mapTitle}</h3><p>{t.mapHelp}</p></div><span>{total} {t.mapTotal}</span></div>
  <svg className="store-map" viewBox="0 0 590 530" role="group" aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`}>
   <title id={`${id}-title`}>{t.mapTitle}</title><desc id={`${id}-description`}>{t.mapHelp} {t.mapAddressNote}</desc>
   {geometry.map(shape=>{const state=brStates.find(s=>s.code===shape.code),count=counts[state.id]||0,selected=stateId?stateId===state.id:Boolean(region&&state.region===region),[x,y]=shape.center,[lx,ly]=shape.label;
    return <g key={state.id} className={`store-map-state level-${count===0?'zero':count<=2?'low':count<=5?'mid':'high'}${selected?' selected':''}`} role="button" tabIndex={0} aria-label={`${state.name}: ${count} ${count===1?t.mapShop:t.mapShops}`} aria-pressed={selected} onClick={()=>onSelect(state)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onSelect(state)}}}>
     <title>{state.name}: {count} {count===1?t.mapShop:t.mapShops}</title>
     <path d={shape.path} transform="matrix(.0013 0 0 -.0013 962 71.5)" vectorEffect="non-scaling-stroke"/>
     {(x!==lx||y!==ly)&&<line x1={x} y1={y} x2={lx} y2={ly-4}/>}
     <text x={lx} y={ly} textAnchor="middle">{state.code} {count}</text>
    </g>;
   })}
  </svg>
  <div className="store-map-legend"><span><i className="level-zero"/>{t.mapNoShops}</span><span><i className="level-low"/>1–2</span><span><i className="level-mid"/>3–5</span><span><i className="level-high"/>6+</span><span><i className="selected"/>{t.mapSelected}</span></div>
  <p className="store-map-source">{t.mapAddressNote} · <a href="https://servicodados.ibge.gov.br/api/docs/malhas?versao=3" target="_blank" rel="noreferrer">IBGE</a></p>
 </div>;
}
