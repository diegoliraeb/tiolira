import {artworkDefaults} from './calculator.mjs';
export function artworkStartingValues(product,profile){
 const estimate=product?.printEstimate;
 return {...artworkDefaults,...profile,grams:estimate?.grams??NaN,hours:estimate?Math.round(estimate.hours*10000)/10000:NaN};
}

// Sum complete per-artwork profiles before rounding, including every copy.
export function artworkGroupTotals(items,products){
 let grams=0,hours=0,quantity=0,complete=items.length>0;
 for(const item of items){
  if(!Number.isInteger(item.quantity)||item.quantity<1||item.quantity>999)throw new RangeError('Invalid artwork quantity');
  quantity+=item.quantity;
  const estimate=products.find(p=>p.id===item.productId)?.printEstimate;
  if(!estimate||!Number.isFinite(estimate.grams)||!Number.isFinite(estimate.hours)){complete=false;continue;}
  grams+=estimate.grams*item.quantity;hours+=estimate.hours*item.quantity;
 }
 return {quantity,complete,grams:complete?Math.round(grams*100)/100:NaN,hours:complete?Math.round(hours*10000)/10000:NaN};
}
