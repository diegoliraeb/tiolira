export function cartSelection(data,cart){
 const offers=data?[...collectionOffers(data),...data.products.map(x=>({...x,kind:'product',productIds:[x.id]}))]:[];
 const seen=new Set(),selected=[];
 for(const item of cart){
  const key=item?.kind+':'+item?.id,offer=offers.find(x=>x.id===item?.id&&x.kind===item?.kind&&!x.owned);
  if(offer&&!seen.has(key)){seen.add(key);selected.push(offer);}
 }
 const selectedCollections=selected.filter(x=>x.kind==='collection');
 const lines=selected.filter(x=>x.kind==='collection'||!selectedCollections.some(c=>c.productIds.includes(x.id)));
 return {offers,selected,selectedCollections,lines,total:lines.reduce((n,x)=>n+x.priceCents,0)};
}

export function collectionOffers(data){
 if(!data)return [];
 return data.collections.map(collection=>{
  const pieces=collection.productIds.map(id=>data.products.find(p=>p.id===id));
  const individualTotalCents=pieces.every(p=>p&&Number.isInteger(p.priceCents))?pieces.reduce((sum,p)=>sum+p.priceCents,0):0;
  return {...collection,kind:'collection',individualTotalCents,savingsCents:Math.max(0,individualTotalCents-collection.priceCents)};
 });
}

export function addCartOffer(cart,item){
 return [...cart.filter(x=>!(x.kind===item.kind&&x.id===item.id)&&!(item.kind==='collection'&&x.kind==='product'&&item.productIds.includes(x.id))),{id:item.id,kind:item.kind}];
}

export function collectionUpsells(data,cart){
 const {lines}=cartSelection(data,cart);
 return collectionOffers(data).filter(c=>!c.owned&&c.savingsCents>0&&!lines.some(x=>x.kind==='collection'&&x.id===c.id)&&lines.some(x=>x.kind==='product'&&c.productIds.includes(x.id)));
}
