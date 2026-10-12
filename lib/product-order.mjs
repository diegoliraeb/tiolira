export function isAvailable(product){
 return product.access!=='soon'&&Boolean(product.url||(['site','paid'].includes(product.access)&&(product.hasFile||product.filePath)));
}

export function sortProducts(products){
 return [...products].sort((a,b)=>Number(isAvailable(b))-Number(isAvailable(a))||(b.clickCount||0)-(a.clickCount||0)||(a.order||0)-(b.order||0)||a.id.localeCompare(b.id));
}
