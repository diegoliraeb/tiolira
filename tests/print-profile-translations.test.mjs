import test from 'node:test';
import assert from 'node:assert/strict';
import {localizePrintProfile,translatePrintProfileText} from '../lib/print-profile-translations.mjs';
import templates from '../data/print-profile-translations.json' with {type:'json'};
const profile={id:'original',name:'Projeto completo v08 · 0,20 mm',layerHeight:0.2,format:'3MF',filePath:'private/surfer-v08.3mf',downloadUrl:'/api/download?id=surfer&profile=original',notes:'3MF completo com peças, bandejas e montagem. A1 · bico 0,4 mm · PLA · camada 0,20 mm. Tempo estimado: 17h 19min; filamento: 387 g, incluindo suportes. Total de 8 bandejas. Estimativas do Bambu Studio.'};
test('print profile translation preserves download identity and exact numeric values',()=>{
 const before=structuredClone(profile);
 for(const lang of ['en','es','fr']){
  const p=localizePrintProfile(profile,lang);
  assert.notEqual(p.name,profile.name);assert.notEqual(p.notes,profile.notes);
  assert.deepEqual(p.notes.match(/\d+(?:[,.]\d+)?/g).map(n=>n.replace(',','.')),profile.notes.match(/\d+(?:[,.]\d+)?/g).map(n=>n.replace(',','.')));
  for(const key of ['id','filePath','downloadUrl','layerHeight','format'])assert.equal(p[key],profile[key]);
 }
 assert.equal(localizePrintProfile(profile,'en').name,'Complete project v08 · 0.20 mm');
 assert.match(localizePrintProfile(profile,'fr').notes,/Temps estimé : 17h 19min/);
 assert.deepEqual(profile,before);assert.deepEqual(localizePrintProfile(profile,'pt'),profile);
});
test('unknown or updated custom instructions are preserved intact',()=>{
 for(const lang of ['en','es','fr']){
  const changed=profile.notes+' Nova orientação: usar PETG.';
  assert.equal(translatePrintProfileText(changed,lang),changed);
  assert.equal(translatePrintProfileText('My custom profile #2',lang),'My custom profile #2');
 }
});
test('every technical template keeps all numbers in order and contains each language',()=>{
 for(const row of templates){
  let i=0;const sample=row.pt.replace(/#/g,()=>String(++i));
  for(const lang of ['en','es','fr']){
   const actual=translatePrintProfileText(sample,lang);
   assert.notEqual(actual,sample);assert.ok(row[lang]);
   assert.deepEqual(actual.match(/\d+/g),sample.match(/\d+/g));
   assert.doesNotMatch(actual,/Tempo estimado|incluindo suportes|suportes revisados|bico|Refatiar|Camadas|bandejas/);
  }
 }
});
