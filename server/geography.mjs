import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {countries,countryName,deliveryLabel,normalize} from '../lib/geography.mjs';
const cache=new Map();
export async function geography(code){
 if(!countries.some(c=>c.code===code))throw Object.assign(new Error('Selecione um país válido.'),{status:400});
 if(!cache.has(code))cache.set(code,readFile(join(process.cwd(),'public','geography',`${code}.json`),'utf8').then(JSON.parse).catch(e=>{cache.delete(code);throw e}));
 return cache.get(code);
}
export async function geographyOptions(code,stateId){
 const country=await geography(code);
 if(stateId){const state=Object.hasOwn(country.states,stateId)?country.states[stateId]:null;if(!state)throw Object.assign(new Error('Selecione um estado válido.'),{status:400});return {cities:state.cities.map(([id,name])=>({id,name}))};}
 return {states:Object.entries(country.states).map(([id,s])=>({id,name:s.name,code:s.code,region:s.region||''}))};
}
export async function normalizeStoreLocation(store){
 // Legacy records keep their original text until their address is edited.
 const fail=()=>{throw Object.assign(new Error('Confira país, estado, cidade e área atendida.'),{status:400})};
 let result={...store};
 if(store.countryCode){
  if(!countries.some(c=>c.code===store.countryCode))fail();
  if(store.countryCode!=='BR'){
   if(!store.city?.trim())fail();
   result={...store,country:countryName(store.countryCode),state:(store.state||'').trim(),city:store.city.trim(),stateId:'',stateCode:'',cityId:'',region:''};
  }else{
  const country=await geography(store.countryCode),state=Object.hasOwn(country.states,store.stateId)?country.states[store.stateId]:null;if(!state)fail();
  const city=state.cities.find(([id])=>id===store.cityId);if(!city)fail();
  result={...store,country:countryName(store.countryCode),state:state.code||state.name,stateCode:state.code,city:city[1],region:state.region||''};
  }
 }
 const area=store.serviceArea;
 if(area){
  if(!countries.some(c=>c.code===area.countryCode))fail();
  if(area.countryCode!=='BR'){
   const base={...area,stateId:'',stateCode:'',state:'',cities:[]};
   if(area.scope==='state'){if(!area.state?.trim())fail();base.state=area.state.trim();}
   else if(['city','cities'].includes(area.scope)){
    if(!area.cities.length||(area.scope==='city'&&area.cities.length!==1))fail();
    const seen=new Set();
    base.cities=area.cities.map(c=>{const name=c.name.trim(),state=(c.state||'').trim(),key=normalize(`${state}|${name}`);if(!name||seen.has(key))fail();seen.add(key);return {id:'',name,state,stateId:'',stateCode:''};});
   }else if(area.scope!=='country')fail();
   result.serviceArea=base;result.delivery=deliveryLabel(base);return result;
  }
  const deliveryCountry=await geography(area.countryCode);
  if(area.scope==='state'){const s=Object.hasOwn(deliveryCountry.states,area.stateId)?deliveryCountry.states[area.stateId]:null;if(!s)fail();result.serviceArea={...area,state:s.name,stateCode:s.code,cities:[]};}
  else if(area.scope==='country')result.serviceArea={...area,stateId:'',state:'',stateCode:'',cities:[]};
  else{
   if(!area.cities.length||(area.scope==='city'&&area.cities.length!==1))fail();
   const seen=new Set();
   const cities=area.cities.map(c=>{const s=Object.hasOwn(deliveryCountry.states,c.stateId)?deliveryCountry.states[c.stateId]:null,found=s?.cities.find(([id])=>id===c.id);if(!found||seen.has(c.id))fail();seen.add(c.id);return {id:c.id,name:found[1],stateId:c.stateId,state:s.name,stateCode:s.code}});
   result.serviceArea={...area,stateId:'',state:'',stateCode:'',cities};
  }
  result.delivery=deliveryLabel(result.serviceArea);
 }
 return result;
}
