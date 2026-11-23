import {currentOrderEnvironment} from './payment-environment.mjs';
import {soldQuantity} from './product-sales.mjs';
import {downloadPartners} from './download-history.mjs';

export function productPerformance(catalog,state){
 const rows=new Map(),collections=new Map((catalog.collections||[]).map(c=>[c.id,c.name]));
 function ensure(product){
  if(!rows.has(product.id))rows.set(product.id,{id:product.id,name:product.name||'Obra fora do catálogo',image:product.image||'',collection:product.collection||'',collectionName:collections.get(product.collection)||'Sem coleção / histórico',individualSales:0,collectionSales:0,totalSales:0,revenueCents:0,revenueUsdCents:0,downloads:state.downloads?.[product.id]||0,uniquePartners:0,lastDownloadAt:null});
  return rows.get(product.id);
 }
 for(const product of catalog.products||[])ensure(product);
 for(const order of state.orders||[]){
  if(order.status!=='paid'||!currentOrderEnvironment(order))continue;
  for(const item of order.items||[]){
   const products=[...new Map((item.products||[]).filter(p=>p.id).map(p=>[p.id,p])).values()];
   products.forEach((product,index)=>{
    const row=ensure(product),quantity=soldQuantity(item),amount=item.totalCents??item.priceCents??0;
    row[item.kind==='collection'?'collectionSales':'individualSales']+=quantity;row.totalSales+=quantity;
    row[order.currency==='USD'?'revenueUsdCents':'revenueCents']+=Math.floor(amount/products.length)+(index<amount%products.length?1:0);
   });
  }
 }
 for(const event of state.recentDownloads||[])ensure({id:event.productId,name:event.productName});
 for(const id of Object.keys(state.downloads||{}))ensure({id});
 const seen=new Set();
 for(const partner of downloadPartners(state)){
  const row=ensure({id:partner.productId}),key=JSON.stringify([partner.productId,partner.memberId]);
  if(partner.memberId&&!seen.has(key)){row.uniquePartners++;seen.add(key);}
  if(partner.lastAt&&(!row.lastDownloadAt||partner.lastAt>row.lastDownloadAt))row.lastDownloadAt=partner.lastAt;
 }
 return [...rows.values()];
}
