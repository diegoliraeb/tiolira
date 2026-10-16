import {artworkDefaults} from './calculator.mjs';
export function artworkStartingValues(product,profile){
 const estimate=product?.printEstimate;
 return {...artworkDefaults,...profile,grams:estimate?.grams??NaN,hours:estimate?Math.round(estimate.hours*10000)/10000:NaN};
}
