import test from 'node:test';
import assert from 'node:assert/strict';
import {catalogTranslations} from '../lib/catalog-translations.mjs';
import {localized,catalogTranslationField} from '../lib/i18n.js';
import {productMetadata,productSchema,cleanText} from '../lib/seo.mjs';
import teams from '../data/gameday-teams.json' with {type:'json'};

const surfer={id:'bb63207f-e18d-40db-8ba5-21e3ad296d97',slug:'noel-surfista',name:'Noel Surfista — Noel da Onda',description:'Um Natal com os pés na areia.',summary:'Resumo em português',size:'21.8 cm de altura',collection:'natal-brasileiro',access:'paid',priceCents:1990,hasFile:true,filePath:'models/test-private.3mf',published:true,allowPhysicalSales:true,translations:{}};
test('new editorial translations provide descriptions, card summaries and usable titles in all three languages',()=>{
 for(const [id,translations] of Object.entries(catalogTranslations))for(const lang of ['en','es','fr']){
  const t=translations[lang];assert.ok(t?.name?.trim(),`${id}:${lang}`);assert.ok(t.description?.length>60,`${id}:${lang}`);
  assert.ok(t.summary?.trim());assert.ok(t.summary.length<=1000);assert.ok(t.name.length<=200);assert.ok(t.description.length<=16000);
  assert.ok(!t.description.includes('undefined'));assert.ok(!t.description.includes('NaN'));
 }
});
test('localization changes only presentation text, preserving checkout, downloads, permissions and source data',()=>{
 const before=structuredClone(surfer);
 for(const lang of ['en','es','fr']){
  const p=localized(surfer,lang);assert.notEqual(p.description,surfer.description);assert.notEqual(p.summary,surfer.summary);
  for(const key of ['id','slug','collection','access','priceCents','hasFile','filePath','published','allowPhysicalSales'])assert.deepEqual(p[key],surfer[key]);
  const meta=productMetadata(surfer,lang),schema=productSchema(surfer,lang);
  assert.ok(meta.description.includes(p.name));assert.ok(meta.alternates.canonical.endsWith(`/${lang}/produto/noel-surfista`));
  assert.ok(schema.description.includes(cleanText(p.description)));assert.equal(schema.offers.price,'19.90');assert.equal(schema.offers.priceCurrency,'BRL');
 }
 assert.deepEqual(surfer,before);assert.deepEqual(localized(surfer,'pt'),surfer);
});
test('admin custom text wins and descriptions never inherit the Portuguese card summary',()=>{
 const p={...surfer,translations:{en:{name:'Custom surfer',description:'A custom description.\n\nDetails and assembly.',summary:''}}};
 const t=localized(p,'en');assert.equal(t.name,'Custom surfer');assert.equal(t.description,p.translations.en.description);assert.equal(t.summary,'A custom description.');
 assert.equal(localized({...surfer,translations:{en:{description:''}}},'en').description,catalogTranslations[surfer.id].en.description);
 assert.equal(catalogTranslationField(surfer,'es','description'),catalogTranslations[surfer.id].es.description);
 assert.equal(catalogTranslationField(p,'en','summary'),''); // Empty fields remain editable.
});
test('French mixed-language paragraph repairs retain saved technical details and later editorial changes',()=>{
 const sentence='Uma flor compartilhada entre Maria e Jesus, sob o olhar atento de José: um encontro de carinho e simplicidade no jardim de Nazaré.';
 const tail='\n\nProfil 0,16 mm : 16h 56min 16s · 238,2 g de PLA.\n\nProfil 0,20 mm : 14h 4min 26s · 238,1 g.';
 const p={id:'6172a405-5f85-43ba-a543-feddc42fe79d',name:'Jardim',summary:sentence,translations:{fr:{description:sentence+tail}}};
 const t=localized(p,'fr');assert.match(t.description,/^Une fleur partagée/);assert.ok(t.description.endsWith(tail));assert.match(t.summary,/^Une fleur partagée/);
 assert.equal(catalogTranslationField(p,'fr','description'),t.description);
 const custom={...p,translations:{fr:{description:'Mon nouveau texte.'+tail}}};assert.equal(localized(custom,'fr').description,custom.translations.fr.description);
});
test('print quantities and printer fit caveats remain accurate in the translated copy',()=>{
 for(const lang of ['en','es','fr']){
  const text=catalogTranslations[surfer.id][lang].description.replaceAll(',','.');
  for(const detail of ['v08','29','8','21.8','0.4','0.20','17 h 19 min','387'])assert.ok(text.includes(detail),`${lang}: ${detail}`);
  const egypt=catalogTranslations['67d8ec08-c34e-445b-81ae-4080aff81678'][lang].description.replaceAll(',','.');
  for(const detail of ['23 h 48 min 25 s','248.34','19 h 32 min 25 s','244.91','17.9'])assert.ok(egypt.includes(detail));
 }
 assert.match(catalogTranslations['791d460b-38c9-41df-b199-ebe5e7a47da3'].en.description,/does not fit the A1 Mini/);
 assert.match(catalogTranslations['791d460b-38c9-41df-b199-ebe5e7a47da3'].es.description,/no cabe en la A1 Mini/);
 assert.match(catalogTranslations['791d460b-38c9-41df-b199-ebe5e7a47da3'].fr.description,/ne tient pas sur l’A1 Mini/);
});
test('every NFL team has its own localized description and commercial license restrictions',()=>{
 assert.equal(teams.length,32);
 for(const team of teams)for(const lang of ['en','es','fr']){
  const t=localized({id:'gameday-santa-'+team.key,priceUsdCents:1499},lang);
  assert.ok(t.description.includes(`${team.city} ${team.team}`));assert.ok(t.description.includes('3MF'));assert.equal(t.priceUsdCents,1499);
 }
 const cowboys=catalogTranslations['gameday-santa-cowboys'];
 assert.match(cowboys.en.description,/Reselling or sharing the digital files is prohibited/);
 assert.match(cowboys.es.description,/prohibido revender o compartir los archivos digitales/);
 assert.match(cowboys.fr.description,/revente et le partage des fichiers numériques sont interdits/);
});
test('Senna stays personal-use-only, and Portuguese plaque lettering is disclosed rather than mistranslated',()=>{
 const senna=catalogTranslations['96f7f843-b608-4a57-8f27-6ba12e2862da'];
 assert.match(senna.en.description,/Selling physical prints or the digital files is not permitted/);
 assert.match(senna.es.description,/No se permite vender las piezas físicas/);
 assert.match(senna.fr.description,/vente des objets physiques imprimés.*interdites/);
 assert.match(senna.en.license,/including made-to-order prints/);
 assert.match(senna.es.license,/incluso por encargo/);
 assert.match(senna.fr.license,/y compris sur commande/);
 const plaque=catalogTranslations['c91600a4-3eda-4780-b4eb-ee5d0dd43915'];
 assert.ok(plaque.en.description.includes('lettering is in Portuguese'));assert.ok(plaque.en.description.includes('Se avexe não!'));
 assert.ok(plaque.es.description.includes('letras del modelo están en portugués'));assert.ok(plaque.fr.description.includes('texte du modèle est en portugais'));
});
