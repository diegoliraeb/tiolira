// Previously a work could have a separate cover plus 20 gallery photos.
export const MAX_GALLERY_IMAGES=21;

export function normalizeProductGallery(product){
 const gallery=[...new Set([product.image,...(product.gallery||[])].filter(Boolean))];
 const image=gallery[0]||'';
 if(product.image===image&&Array.isArray(product.gallery)&&product.gallery.length===gallery.length&&product.gallery.every((value,index)=>value===gallery[index]))return product;
 return {...product,image,gallery};
}

export function normalizeCatalogGalleries(catalog){
 const products=catalog.products.map(normalizeProductGallery);
 return products.every((product,index)=>product===catalog.products[index])?catalog:{...catalog,products};
}

export function selectGalleryCover(images,index){
 if(index<0||index>=images.length)return images;
 return [images[index],...images.filter((_,position)=>position!==index)];
}
