import covers from '../data/family-covers-v1.json' with {type:'json'};
import {FAMILY_COLLECTION_ID} from '../lib/family-discount.mjs';
import {MAX_GALLERY_IMAGES,normalizeProductGallery} from '../lib/product-gallery.mjs';

const migration='sagrada-familia-covers-2026-10-19';
const byId=new Map(covers.map(cover=>[cover.id,cover]));

// Persist the media update once. Later cover selections in the admin must win.
export function migrateFamilyCovers(catalog){
 if(catalog.mediaMigrations?.includes(migration))return catalog;
 if(!catalog.products.some(p=>p.collection===FAMILY_COLLECTION_ID&&byId.has(p.id)))return catalog;
 const products=catalog.products.map(product=>{
  const cover=byId.get(product.id);
  if(product.collection!==FAMILY_COLLECTION_ID||!cover||product.image!==cover.previous)return product;
  const current=normalizeProductGallery(product);
  const gallery=[cover.image,...current.gallery.filter(image=>image!==cover.image)];
  if(gallery.length>MAX_GALLERY_IMAGES)return product;
  return {...product,image:cover.image,gallery};
 });
 return {...catalog,products,mediaMigrations:[...(catalog.mediaMigrations||[]),migration]};
}
