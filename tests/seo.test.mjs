import test from 'node:test';
import assert from 'node:assert/strict';
import {sitemapEntries,productMetadata,productSchema,collectionMetadata,collectionSlug,jsonLd,SITE_ORIGIN} from '../lib/seo.mjs';
const family={id:'de1d16c4-5306-4f91-8696-fa0d512a5dbf',name:'Esculturas Sagrada Família',description:'Esculturas autorais.',image:'/assets/collections/sagrada-familia-v3.webp',published:true};
const piece={id:'test-nazare',slug:'sagrada-familia-caminho-de-nazare',name:'Escultura Sagrada Família - Caminho de Nazaré',description:'Maria e José caminham com Jesus.',image:'/api/media?path=images%2Ftest.png',gallery:[],hasFile:true,access:'paid',priceCents:1290,collection:family.id,published:true,translations:{en:{name:'Holy Family — Path of Nazareth',description:'Mary and Joseph walk with Jesus.'}}};
test('sitemap covers every public product and language while excluding private, draft and empty content',()=>{
 const catalog={collections:[family,{id:'empty',published:true},{id:'hidden',published:false}],products:[piece,{...piece,id:'draft',slug:'draft',published:false},{...piece,id:'hidden-piece',slug:'hidden-piece',collection:'hidden'}]};
 const entries=sitemapEntries(catalog);assert.equal(entries.length,20);assert.equal(new Set(entries.map(e=>e.url)).size,20);
 for(const lang of ['pt','en','es','fr']){const entry=entries.find(e=>e.url===`${SITE_ORIGIN}/${lang}/produto/${piece.slug}`);assert.ok(entry);assert.equal(Object.keys(entry.alternates.languages).length,5);assert.equal(entry.alternates.languages['x-default'],`${SITE_ORIGIN}/pt/produto/${piece.slug}`);assert.deepEqual(entry.images,[`${SITE_ORIGIN}/api/media?path=images%2Ftest.png`]);assert.equal(entry.lastModified,undefined);}
 assert.ok(entries.every(e=>!/(draft|hidden|empty|clube|admin|download|lembretes)/.test(e.url)));
});
test('canonical and translated metadata share the exact sitemap URL and preserve distinctive product names',()=>{
 for(const lang of ['pt','en','es','fr']){const meta=productMetadata(piece,lang);assert.equal(meta.alternates.canonical,`${SITE_ORIGIN}/${lang}/produto/${piece.slug}`);assert.equal(meta.openGraph.url,meta.alternates.canonical);assert.equal(meta.robots.index,true);assert.ok(meta.description.length<=180);assert.equal(meta.twitter.images[0],`${SITE_ORIGIN}/api/media?path=images%2Ftest.png`);}
 assert.match(productMetadata(piece,'pt').title,/Sagrada Família 3D - Caminho de Nazaré/);assert.match(productMetadata(piece,'en').title,/Holy Family/);
 assert.equal(collectionSlug(family),'sagrada-familia-3d');assert.equal(collectionMetadata(family,'pt',0).robots.index,false);assert.equal(collectionMetadata(family,'pt',1).robots.index,true);
});
test('product structured data uses actual visible prices and never fabricates ratings or external offers',()=>{
 const paid=productSchema(piece,'pt',family);assert.equal(paid.offers.price,'12.90');assert.equal(paid.offers.priceCurrency,'BRL');assert.equal(paid.aggregateRating,undefined);assert.equal(paid.review,undefined);assert.match(paid.description,/Arquivo digital/);
 assert.equal(productSchema({...piece,access:'site'},'pt',family).offers.price,'0.00');
 for(const changed of [{access:'soon'},{access:'maker',url:'https://makerworld.com/model'},{access:'members'},{hasFile:false}])assert.equal(productSchema({...piece,...changed},'pt',family).offers,undefined);
});
test('JSON-LD escapes HTML termination so catalog text cannot inject scripts',()=>{const raw={name:'</script><script>alert(1)</script>',description:'A & B'};const result=jsonLd(raw);assert.ok(!result.includes('<'));assert.deepEqual(JSON.parse(result),raw);});
