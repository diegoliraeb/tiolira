'use client';
import {useEffect,useId,useState} from 'react';
import {normalize,countryName} from '../lib/geography.mjs';
import countryOptions from '../data/geography/country-options.json';
import {dictionaries} from '../lib/i18n';
const cache=new Map();
function useOptions(countryCode,stateId,kind){
 const key=countryCode?`${countryCode}:${stateId||''}`:'';
 const [result,setResult]=useState({key:'',items:[],error:false}),[retry,setRetry]=useState(0);
 useEffect(()=>{
  if(!key||kind==='cities'&&!stateId)return;
  if(cache.has(key)){setResult({key,items:cache.get(key),error:false});return;}
  const controller=new AbortController();
  fetch(`/api/locations?country=${countryCode}${stateId?`&state=${encodeURIComponent(stateId)}`:''}`,{signal:controller.signal}).then(async r=>{if(!r.ok)throw Error();const data=await r.json();const items=data[kind];if(!Array.isArray(items))throw Error();cache.set(key,items);setResult({key,items,error:false})}).catch(e=>{if(e.name!=='AbortError')setResult({key,items:[],error:true})});
  return()=>controller.abort();
 },[key,countryCode,stateId,kind,retry]);
 const ready=result.key===key;
 return {items:ready?result.items:[],loading:Boolean(key)&&!(kind==='cities'&&!stateId)&&!ready,error:ready&&result.error,retry:()=>setRetry(n=>n+1)};
}
export default function LocationFields({lang='pt',value,onChange,required=false,showCountry=true,showCity=true,prefix='',stateFilter,children}){
 const t=dictionaries[lang],id=useId();
 const manual=Boolean(value.countryCode&&value.countryCode!=='BR');
 const states=useOptions(manual?'':value.countryCode,'','states'),cities=useOptions(manual?'':value.countryCode,value.stateId,'cities');
 const cityId=value.cityId||cities.items.find(c=>normalize(c.name)===normalize(value.city))?.id||'';
 const visibleStates=stateFilter?states.items.filter(stateFilter):states.items;
 // Keep labels and ordering identical across Node and browsers with different ICU versions.
 const ordered=countryOptions[lang]||countryOptions.pt;
 return <>
  {showCountry&&<label htmlFor={`${id}-country`}>{prefix}{t.country}<select id={`${id}-country`} required={required} value={value.countryCode||''} onChange={e=>onChange({countryCode:e.target.value,country:e.target.value?countryName(e.target.value):'',stateId:'',state:'',stateCode:'',cityId:'',city:''})}><option value="">{t.selectCountry}</option>{ordered.map(c=><option key={c.code} value={c.code}>{c.label}</option>)}</select></label>}
  {children}
  {manual?<>
   <label htmlFor={`${id}-state`}>{prefix}{showCity?t.manualState:t.state}<input id={`${id}-state`} autoComplete="address-level1" maxLength={120} required={required&&!showCity} value={value.state||''} onChange={e=>onChange({...value,state:e.target.value,stateId:'',stateCode:'',cityId:''})}/></label>
   {showCity&&<label htmlFor={`${id}-city`}>{prefix}{t.city}<input id={`${id}-city`} autoComplete="address-level2" maxLength={120} required={required} value={value.city||''} onChange={e=>onChange({...value,city:e.target.value,stateId:'',stateCode:'',cityId:''})}/></label>}
   <p className="field-help full">{t.manualLocationHelp}</p>
  </>:<>
  <label htmlFor={`${id}-state`}>{prefix}{t.state}<select id={`${id}-state`} required={required} value={value.stateId||''} disabled={!value.countryCode||states.loading||states.error} onChange={e=>{const s=states.items.find(s=>s.id===e.target.value);onChange({...value,stateId:s?.id||'',state:s?.name||'',stateCode:s?.code||'',cityId:'',city:''})}}><option value="">{states.loading?t.loading:t.selectState}</option>{[...visibleStates].sort((a,b)=>a.name.localeCompare(b.name,lang)).map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
  {showCity&&<label htmlFor={`${id}-city`}>{prefix}{t.city}<select id={`${id}-city`} required={required} value={cityId} disabled={!value.stateId||cities.loading||cities.error} onChange={e=>{const c=cities.items.find(c=>c.id===e.target.value);onChange({...value,cityId:c?.id||'',city:c?.name||''})}}><option value="">{cities.loading?t.loading:t.selectCity}</option>{[...cities.items].sort((a,b)=>a.name.localeCompare(b.name,lang)).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>}
  {(states.error||showCity&&cities.error)&&<p className="error-text full" role="alert">{t.locationError} <button type="button" className="text-link" onClick={()=>{states.retry();cities.retry()}}>{t.retry}</button></p>}
  {!states.loading&&!states.error&&value.countryCode&&states.items.length===0&&<p className="notice full">{t.locationMissing}</p>}
  {showCity&&!cities.loading&&!cities.error&&value.stateId&&cities.items.length===0&&<p className="notice full">{t.locationMissing}</p>}
  </>}
 </>;
}
