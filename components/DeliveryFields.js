'use client';
import {useState} from 'react';
import LocationFields from './LocationFields';
import {countryName} from '../lib/geography.mjs';
import {dictionaries} from '../lib/i18n';
export default function DeliveryFields({lang='pt',value,onChange}){
 const t=dictionaries[lang],[candidate,setCandidate]=useState({countryCode:value.countryCode,stateId:'',cityId:'',city:''});
 const selected=value.scope==='state'?{countryCode:value.countryCode,stateId:value.stateId||'',state:value.state||''}:candidate;
 const changeLocation=loc=>{
  if(value.scope==='state'){onChange({...value,stateId:loc.stateId,state:loc.state,stateCode:loc.stateCode||'',cities:[]});return;}
  setCandidate(loc);
  if(loc.cityId){const city={id:loc.cityId,name:loc.city,stateId:loc.stateId,state:loc.state,stateCode:loc.stateCode||''};onChange({...value,cities:value.scope==='city'?[city]:[...value.cities.filter(c=>c.id!==city.id),city]});}
 };
 return <fieldset className="full delivery-fields"><legend>{t.delivery}</legend>
  <label>{t.deliveryScope}<select value={value.scope} onChange={e=>{onChange({...value,scope:e.target.value,stateId:'',state:'',stateCode:'',cities:[]});setCandidate({countryCode:value.countryCode,stateId:'',cityId:'',city:''})}}><option value="country">{t.wholeCountry} — {countryName(value.countryCode,lang)}</option><option value="state">{t.oneState}</option><option value="city">{t.oneCity}</option><option value="cities">{t.severalCities}</option></select></label>
  {value.scope!=='country'&&<div className="delivery-selectors"><LocationFields lang={lang} value={selected} onChange={changeLocation} showCountry={false} showCity={value.scope!=='state'} required={value.scope==='state'} prefix={`${t.deliveryPrefix} `}/></div>}
  {['city','cities'].includes(value.scope)&&<><p className="field-help">{t.citiesHelp}</p><div className="selected-cities">{value.cities.map(c=><span key={c.id}>{c.name} · {c.stateCode||c.state}<button type="button" aria-label={`${t.remove} ${c.name}`} onClick={()=>{onChange({...value,cities:value.cities.filter(x=>x.id!==c.id)});setCandidate({...candidate,cityId:'',city:''})}}>×</button></span>)}</div>{!value.cities.length&&<p className="field-help">{t.chooseDeliveryCity}</p>}</>}
 </fieldset>;
}
