export function cartSelection(data,cart){
 const offers=data?[...data.collections.map(x=>({...x,kind:'collection'})),...data.products.map(x=>({...x,kind:'product',productIds:[x.id]}))]:[];
 const seen=new Set(),selected=[];
 for(const item of cart){
  const key=item?.kind+':'+item?.id,offer=offers.find(x=>x.id===item?.id&&x.kind===item?.kind&&!x.owned);
  if(offer&&!seen.has(key)){seen.add(key);selected.push(offer);}
 }
 const selectedCollections=selected.filter(x=>x.kind==='collection');
 const lines=selected.filter(x=>x.kind==='collection'||!selectedCollections.some(c=>c.productIds.includes(x.id)));
 return {offers,selected,selectedCollections,lines,total:lines.reduce((n,x)=>n+x.priceCents,0)};
}
