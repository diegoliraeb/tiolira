import test from 'node:test';
import assert from 'node:assert/strict';
import {dictionaries,languages,localeNames,localized,localizeOrder} from '../lib/i18n.js';
import {frenchCatalog} from '../lib/catalog-fr.mjs';
import {movementCopy} from '../lib/movement-copy.mjs';
import {partnerCopy} from '../lib/partner-copy.mjs';
import {shopText} from '../lib/shop-fr.mjs';
import {internationalBuyer,marketCatalog,formatMoney} from '../lib/international-pricing.mjs';
import {countryName,deliveryLabel} from '../lib/geography.mjs';
import {paymentReturnUrl} from '../server/asaas.mjs';
import {paypalReturnUrl} from '../server/paypal.mjs';
import {purchaseApprovedEmail} from '../server/purchase-email.mjs';
import {productSchema,collectionSchema,settingsSchema} from '../server/schema.mjs';
import countryOptions from '../data/geography/country-options.json' with {type:'json'};
import seed from '../data/catalog.json' with {type:'json'};

test('French covers every interface key and nested array, homepage and partner navigation',()=>{
 assert.ok(languages.includes('fr'));assert.equal(localeNames.fr,'Français');
 function sameShape(original,translated){if(Array.isArray(original)){assert.ok(Array.isArray(translated));assert.equal(translated.length,original.length);original.forEach((v,i)=>sameShape(v,translated[i]));}else assert.ok(typeof translated==='string'&&translated.trim());}
 for(const [key,value]of Object.entries(dictionaries.pt))sameShape(value,dictionaries.fr[key]);
 assert.equal(dictionaries.fr.faq.length,8);
 for(const copy of [movementCopy,partnerCopy])for(const [key,value]of Object.entries(copy('pt')))sameShape(value,copy('fr')[key]);
 assert.equal(shopText('fr','COLEÇÃO · {0} PEÇAS',5),'COLLECTION · 5 PIÈCES');
 assert.equal(shopText('pt','COLEÇÃO · {0} PEÇAS',5),'COLEÇÃO · 5 PEÇAS');
});
test('French catalog and admin overrides translate content without changing price, permissions or files',()=>{
 for(const p of [...seed.products,...seed.collections]){assert.ok(frenchCatalog[p.id]?.name,p.id);assert.ok(frenchCatalog[p.id]?.description,p.id);}
 const p={...seed.products[0],access:'paid',exclusive:false,url:'',collection:'fe',priceCents:1690,filePath:'models/example.3mf',translations:{fr:{name:'Titre personnalisé'}}};
 const translated=localized(p,'fr');assert.equal(translated.name,'Titre personnalisé');assert.equal(translated.priceCents,p.priceCents);assert.equal(translated.filePath,p.filePath);assert.equal(translated.access,p.access);assert.equal(translated.published,p.published);
 assert.equal(productSchema.parse(p).translations.fr.name,'Titre personnalisé');
 assert.equal(collectionSchema.parse({...seed.collections[0],translations:{fr:{name:'Crèche'}}}).translations.fr.name,'Crèche');
 assert.equal(settingsSchema.parse({...seed.settings,translations:{fr:{heroTitle:'Bienvenue'}}}).translations.fr.heroTitle,'Bienvenue');
 assert.deepEqual(localized(p,'es'),{...p});
 const order={id:'unchanged',totalCents:6990,status:'pending',items:[{id:'presepio',name:'Presépio',products:[{id:seed.products[0].id,name:'Original'}]}]};
 const before=structuredClone(order),view=localizeOrder(order,'fr');assert.deepEqual(order,before);assert.equal(view.totalCents,6990);assert.equal(view.status,'pending');assert.equal(view.items[0].name,'Crèche Tio Lira');
});
test('French language preserves country based currency and translates country/service area',()=>{
 assert.equal(internationalBuyer({countryCode:'BR',lang:'fr'}),false);assert.equal(internationalBuyer({countryCode:'FR',lang:'pt'}),true);
 const data={products:[{priceCents:1690}],collections:[{priceCents:6990}]};assert.equal(marketCatalog(data,'USD').products[0].priceCents,282);assert.equal(marketCatalog(data,'USD').collections[0].priceCents,1165);
 assert.match(formatMoney(282,'USD','fr'),/2,82/);assert.equal(countryName('BR','fr'),'Brésil');assert.equal(countryOptions.fr.find(c=>c.code==='BR').label,'Brésil');assert.equal(countryOptions.fr.length,countryOptions.pt.length);assert.equal(deliveryLabel({scope:'country',countryCode:'FR'},'fr'),'Tout le pays · France');
});
test('French payment returns and purchase email keep the authenticated French partner route',()=>{
 const previous=process.env.SITE_URL;process.env.SITE_URL='https://www.tiolira.com.br';
 try{assert.match(paymentReturnUrl('order','fr'),/\/fr\/clube\?pedido=order&retorno=asaas#compras$/);for(const cancel of [false,true])assert.match(paypalReturnUrl({id:'order',lang:'fr'},cancel),/\/fr\/clube\?pedido=order&retorno=paypal/);}finally{previous===undefined?delete process.env.SITE_URL:process.env.SITE_URL=previous;}
 const email=purchaseApprovedEmail({id:'test',lang:'fr',memberName:'<script>alert(1)</script>',items:[{name:'Saci & Cuca'}]},'https://www.tiolira.com.br');
 assert.match(email.subject,/Paiement confirmé/);assert.match(email.html,/lang="fr"/);assert.match(email.html,/&lt;script&gt;/);assert.ok(!email.html.includes('<script>'));assert.match(email.html,/Saci &amp; Cuca/);assert.match(email.text,/\/fr\/clube\?pedido=test#compras/);assert.ok(!email.text.includes('/api/download'));
});
