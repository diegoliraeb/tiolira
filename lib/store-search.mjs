const normalize=value=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
export function matchesStore(store,city,selection,products){
 if(city&&!normalize(`${store.city} ${store.state} ${store.country}`).includes(normalize(city)))return false;
 if(selection==='all')return true;
 if(!selection.startsWith('collection:'))return store.productIds.includes(selection);
 const collection=selection.slice('collection:'.length);
 const required=products.filter(p=>p.collection===collection&&p.access!=='soon').map(p=>p.id);
 // A collection match means the maker offers every currently released piece.
 return required.length>0&&required.every(id=>store.productIds.includes(id));
}
