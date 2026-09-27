'use client';
import {brazilState,matchesAdminStore,normalize,storeCountry} from '../lib/geography.mjs';
export const emptyStoreFilters={status:'',region:'',state:'',city:'',query:''};
export default function AdminStoreFilters({stores,value,onChange}){
 const locations=stores.filter(s=>matchesAdminStore(s,{...emptyStoreFilters,region:value.region}));
 const states=[...new Map(locations.map(s=>{const br=brazilState(s);return [`${storeCountry(s)}:${s.stateId||br?.id||s.state}`,br?.name||s.state]})).entries()].sort((a,b)=>a[1].localeCompare(b[1],'pt'));
 const cities=[...new Map(locations.filter(s=>matchesAdminStore(s,{...emptyStoreFilters,state:value.state})).map(s=>[normalize(s.city),s.city])).values()].sort((a,b)=>a.localeCompare(b,'pt'));
 const filtered=stores.filter(s=>matchesAdminStore(s,value));
 return <div className="admin-store-filters">
  <label>Buscar loja ou cidade<input type="search" value={value.query} onChange={e=>onChange({...value,query:e.target.value})} placeholder="Nome, cidade ou estado"/></label>
  <label>Situação<select value={value.status} onChange={e=>onChange({...value,status:e.target.value})}><option value="">Todas as situações</option><option value="pending">Pendentes</option><option value="approved">Aprovadas</option><option value="paused">Pausadas</option><option value="rejected">Não aprovadas</option></select></label>
  <label>Região<select value={value.region} onChange={e=>onChange({...value,region:e.target.value,state:'',city:''})}><option value="">Todas as regiões</option>{['Norte','Nordeste','Centro-Oeste','Sudeste','Sul','Exterior'].map(r=><option key={r}>{r}</option>)}</select></label>
  <label>Estado<select value={value.state} onChange={e=>onChange({...value,state:e.target.value,city:''})}><option value="">Todos os estados</option>{states.map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
  <label>Cidade<select value={value.city} onChange={e=>onChange({...value,city:e.target.value})}><option value="">Todas as cidades</option>{cities.map(c=><option key={c}>{c}</option>)}</select></label>
  <button type="button" className="button outline" onClick={()=>onChange(emptyStoreFilters)}>Limpar filtros</button>
  <p className="full" role="status">{filtered.length} de {stores.length} participantes · localização da loja</p>
 </div>;
}
