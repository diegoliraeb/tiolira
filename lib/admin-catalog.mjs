const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
export function filterAdminProducts(products,{query='',collection='all',publication='all'}={}){
 const term=normalize(query);
 return products.filter(p=>(collection==='all'||p.collection===collection)&&(publication==='all'||(publication==='published'?p.published!==false:p.published===false))&&normalize(p.name+' '+p.slug).includes(term));
}
