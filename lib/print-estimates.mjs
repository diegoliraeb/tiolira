import estimates from '../data/print-estimates.json' with {type:'json'};
// Keep estimates tied to the published model revision, never a similar title.
export function productPrintEstimate(product){
 const estimate=estimates[product.id];
 if(!estimate||estimate.filePath!==(product.filePath||'')||estimate.url!==(product.url||''))return null;
 return {grams:estimate.grams,hours:estimate.seconds/3600,plates:estimate.plates,material:estimate.material,printer:estimate.printer,layer:estimate.layer,source:estimate.source,checkedAt:estimate.checkedAt};
}
