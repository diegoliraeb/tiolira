import test from 'node:test';
import assert from 'node:assert/strict';
import {directoryCounts,directorySelected,directoryStores} from '../lib/store-directory.mjs';
import {publicCatalog} from '../server/schema.mjs';
import seed from '../data/catalog.json' with {type:'json'};
import geometry from '../data/geography/br-map.json' with {type:'json'};
import {brStates} from '../lib/geography.mjs';
const products=[{id:'a',collection:'nativity',access:'maker'},{id:'b',collection:'nativity',access:'maker'},{id:'c',collection:'nativity',access:'soon'}];
const shops=[
 {id:'al',countryCode:'BR',stateId:'AL',cityId:'2704302',city:'Maceió',productIds:['a','b'],serviceArea:{countryCode:'BR',scope:'country'}},
 {id:'legacy',country:'Brasil',state:'Alagoas',city:'Arapiraca',productIds:['a']},
 {id:'sp',countryCode:'BR',stateId:'SP',cityId:'3550308',city:'São Paulo',productIds:[],offeringsUnspecified:true},
 {id:'pt',countryCode:'PT',stateId:'11',city:'Lisboa',productIds:['a','b']}
];
test('initial and cleared directory never list all shops',()=>{
 for(const l of [{countryCode:'BR'},{}]){assert.equal(directorySelected(l),false);assert.deepEqual(directoryStores(shops,l,'','all',products),[])}
 assert.equal(directorySelected({countryCode:'BR'},'Nordeste'),true);
 assert.equal(directorySelected({countryCode:'PT'}),true);
});
test('state totals equal drill-down results and count physical addresses only',()=>{
 const totals=directoryCounts(shops,'all',products);
 assert.equal(totals.AL,2);assert.equal(totals.SP,1);assert.equal(totals.PE,0);
 assert.equal(Object.values(totals).reduce((a,b)=>a+b,0),3);
 for(const s of brStates)assert.equal(directoryStores(shops,{countryCode:'BR',stateId:s.id},'','all',products).length,totals[s.id]);
 assert.deepEqual(directoryStores(shops,{countryCode:'BR'},'Nordeste','all',products).map(s=>s.id),['al','legacy']);
 assert.deepEqual(directoryStores(shops,{countryCode:'BR',stateId:'PE'},'','all',products),[]);
});
test('city, collection and international filters combine without leaking unrelated stores',()=>{
 assert.deepEqual(directoryStores(shops,{countryCode:'BR',stateId:'AL',cityId:'2700300',city:'Arapiraca'},'','a',products).map(s=>s.id),['legacy']);
 assert.deepEqual(directoryStores(shops,{countryCode:'BR',stateId:'AL'},'','collection:nativity',products).map(s=>s.id),['al']);
 assert.equal(directoryCounts(shops,'collection:nativity',products).AL,1);
 assert.equal(directoryCounts(shops,'collection:missing',products).AL,0);
 assert.equal(directoryCounts(shops,'c',products).AL,0);
 assert.deepEqual(directoryStores(shops,{countryCode:'PT'},'','all',products).map(s=>s.id),['pt']);
});
test('only approved and consented public shops contribute to the map',()=>{
 const data=structuredClone(seed);data.stores=['approved','pending','paused','rejected'].map((status,i)=>({...shops[0],id:String(i),status,consent:true,productIds:[]}));
 data.stores.push({...data.stores[0],id:'private',consent:false});
 const publicData=publicCatalog(data);
 assert.equal(directoryCounts(publicData.stores,'all',publicData.products).AL,1);
});
test('IBGE map has exactly one nonempty geometry and finite labels per UF',()=>{
 assert.deepEqual(geometry.map(g=>g.code).sort(),brStates.map(s=>s.code).sort());
 for(const g of geometry){assert.match(g.path,/^M/);assert.ok(g.center.concat(g.label).every(Number.isFinite))}
});
