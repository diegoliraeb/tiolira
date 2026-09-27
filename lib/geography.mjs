import countries from '../data/geography/countries.json' with {type:'json'};
import brStates from '../data/geography/br-states.json' with {type:'json'};
export {countries,brStates};
export const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const names=new Map();
export const countryName=(code,lang='pt')=>{const key=`${lang}:${code}`;if(!names.has(key)){try{names.set(key,new Intl.DisplayNames([lang],{type:'region'}).of(code))}catch{names.set(key,code)}}return names.get(key)};
const countryAliases=new Map(countries.flatMap(c=>[c.name,...['pt','en','es'].map(l=>countryName(c.code,l))].map(n=>[normalize(n),c.code])));
export function storeCountry(store){if(store.countryCode)return store.countryCode;return countryAliases.get(normalize(store.country))||''}
export function brazilState(store){if(storeCountry(store)!=='BR')return null;return brStates.find(s=>s.id===(store.stateId||store.stateCode)||[s.name,s.code].some(v=>normalize(v)===normalize(store.state)))}
export function locationFromStore(store){return {countryCode:storeCountry(store)||'BR',stateId:store.stateId||brazilState(store)?.id||'',state:store.state||'',cityId:store.cityId||'',city:store.city||''}}
export function deliveryLabel(area,lang='pt'){
 if(!area)return '';
 if(area.scope==='country')return ({pt:'Todo o país',en:'Nationwide',es:'Todo el país'}[lang])+` · ${countryName(area.countryCode,lang)}`;
 if(area.scope==='state')return `${area.state} · ${countryName(area.countryCode,lang)}`;
 return area.cities.map(c=>`${c.name} (${c.stateCode||c.state})`).join(', ');
}
export function matchesAdminStore(store,filters){
 const state=brazilState(store),stateKey=store.stateId||state?.id||store.state;
 return (!filters.status||store.status===filters.status)&&(!filters.region||(state?.region||'Exterior')===filters.region)&&(!filters.state||`${storeCountry(store)}:${stateKey}`===filters.state)&&(!filters.city||normalize(store.city)===normalize(filters.city))&&(!filters.query||normalize(`${store.name} ${store.city} ${store.state} ${store.country}`).includes(normalize(filters.query)));
}
