const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
export function filterAdminProducts(products,{query='',collection='all',publication='all'}={}){
 const term=normalize(query);
 return products.filter(p=>(collection==='all'||p.collection===collection)&&(publication==='all'||(publication==='published'?p.published!==false:p.published===false))&&normalize(p.name+' '+p.slug).includes(term));
}

export function sortAdminProductsBySales(products,counts={}){
 return [...products].sort((a,b)=>(counts[b.id]?.totalSales||0)-(counts[a.id]?.totalSales||0)||a.name.localeCompare(b.name,'pt-BR')||a.id.localeCompare(b.id));
}
