import {normalize,storeCountry,brazilState} from './geography.mjs';
export function servesLocation(store,location){
 if(typeof location==='string')return !location||normalize(`${store.city} ${store.state} ${store.country}`).includes(normalize(location));
 if(!location?.countryCode)return true;
 const area=store.serviceArea;
 if(area){
  if(area.countryCode!==location.countryCode)return false;
  if(!location.stateId)return true;
  if(area.scope==='country')return true;
  if(area.scope==='state')return area.stateId===location.stateId;
  return area.cities.some(c=>c.stateId===location.stateId&&(!location.cityId||c.id===location.cityId));
 }
 if(storeCountry(store)!==location.countryCode)return false;
 if(!location.stateId)return true;
 const stateId=store.stateId||brazilState(store)?.id;
 if(stateId?stateId!==location.stateId:normalize(store.state)!==normalize(location.state))return false;
 return !location.cityId||(store.cityId?store.cityId===location.cityId:normalize(store.city)===normalize(location.city));
}
export function matchesStore(store,location,selection,products){
 if(!servesLocation(store,location))return false;
 if(selection==='all')return true;
 if(!selection.startsWith('collection:'))return products.some(p=>p.id===selection&&p.access!=='soon')&&(store.offeringsUnspecified||store.productIds.includes(selection));
 const collection=selection.slice('collection:'.length);
 const required=products.filter(p=>p.collection===collection&&p.access!=='soon').map(p=>p.id);
 // Unspecified catalogs require direct confirmation; otherwise every released piece must match.
 return required.length>0&&(store.offeringsUnspecified||required.every(id=>store.productIds.includes(id)));
}
