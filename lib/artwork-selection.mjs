import {artworkDefaults,calculateArtwork} from './calculator.mjs';
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


// Shared expenses are per group: allocate each once, evenly per physical unit.
// Material/time retain each artwork's proportions when group totals are edited.
export function artworkGroupBreakdown(items,products,values){
 calculateArtwork(values);
 const totals=artworkGroupTotals(items,products);
 if(!items.length||(!totals.complete&&items.length>1))return null;
 const refs=items.map(item=>products.find(p=>p.id===item.productId)?.printEstimate);
 const grams=refs.reduce((sum,r,i)=>sum+(r?.grams||0)*items[i].quantity,0);
 const hours=refs.reduce((sum,r,i)=>sum+(r?.hours||0)*items[i].quantity,0);
 const shared=['minutes','packaging','extras','fileCost','overhead','shipping'];
 const lines=items.map((item,i)=>{
  const unitValues={...values,grams:grams>0?values.grams*refs[i].grams/grams:values.grams/totals.quantity,hours:hours>0?values.hours*refs[i].hours/hours:values.hours/totals.quantity};
  for(const key of shared)unitValues[key]=values[key]/totals.quantity;
  const unit=calculateArtwork(unitValues);
  return {productId:item.productId,quantity:item.quantity,unit,cost:unit.cost*item.quantity,subtotal:Math.round(unit.price*100)*item.quantity/100};
 });
 return {lines,individualTotal:Math.round(lines.reduce((sum,line)=>sum+line.subtotal,0)*100)/100};
}
