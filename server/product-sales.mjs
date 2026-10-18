import {currentOrderEnvironment} from './payment-environment.mjs';
export const soldQuantity=item=>Number.isSafeInteger(item.quantity)&&item.quantity>0?item.quantity:1;
// Use the order snapshot: later collection changes must not rewrite sales history.
export function countProductSales(orders=[]){
 const counts=new Map();
 for(const order of orders){
  if(order.status!=='paid'||!currentOrderEnvironment(order))continue;
  for(const item of order.items||[]){
   for(const id of new Set((item.products||[]).map(product=>product.id).filter(Boolean))){
    const row=counts.get(id)||{id,individualSales:0,collectionSales:0,totalSales:0};
    const quantity=soldQuantity(item);
    row[item.kind==='collection'?'collectionSales':'individualSales']+=quantity;
    row.totalSales+=quantity;counts.set(id,row);
   }
  }
 }
 return [...counts.values()];
}
