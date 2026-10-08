import {brStates,brazilState,normalize,storeCountry} from './geography.mjs';
import {matchesStore} from './store-search.mjs';

// Fisher–Yates: call on search interactions, never during render or expansion.
export function shuffleStores(stores,random=Math.random){
 const result=[...stores];
 for(let i=result.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[result[i],result[j]]=[result[j],result[i]];}
 return result;
}

// Directory counts represent shop addresses, not overlapping delivery areas.
export function directorySelected(location,region=''){
 return Boolean(location?.countryCode&&(location.countryCode!=='BR'||location.stateId||region));
}
export function directoryStores(stores,location,region,selection,products){
 if(!directorySelected(location,region))return [];
 return stores.filter(store=>{
  if(storeCountry(store)!==location.countryCode)return false;
  const state=location.countryCode==='BR'?brazilState(store):null;
  if(region&&state?.region!==region)return false;
  if(location.stateId&&(state?.id||store.stateId)!==location.stateId)return false;
  if(location.cityId&&(store.cityId?store.cityId!==location.cityId:normalize(store.city)!==normalize(location.city)))return false;
  return matchesStore(store,null,selection,products);
 });
}
export function directoryCounts(stores,selection,products){
 const counts=Object.fromEntries(brStates.map(s=>[s.id,0]));
 for(const store of stores){const state=brazilState(store);if(state&&matchesStore(store,null,selection,products))counts[state.id]++;}
 return counts;
}
