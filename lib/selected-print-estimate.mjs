export function selectedPrintEstimate(product,variantId){
 const estimate=product?.printEstimate;
 if(!estimate)return null;
 if(variantId)return estimate.variants?.find(v=>v.id===variantId)||null;
 return estimate;
}

export function printVariantLabel(variant,lang='pt'){
 return variant?.label?.[lang]||variant?.label?.pt||variant?.id||'';
}
