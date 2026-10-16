import test from 'node:test';
import assert from 'node:assert/strict';
import {artworkDefaults as defaults,calculateArtwork,artworkOffer,workshopKeys} from '../lib/calculator.mjs';
import {calculatorCopy} from '../lib/artwork-calculator-copy.mjs';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
test('worksheet includes material, power, equipment, failed prints, manual work and packaging',()=>{
 const r=calculateArtwork(defaults),cost=(10+.72+3.6)/.95+6+3;
 near(r.cost,cost);near(r.material,10);near(r.printing,4.32);near(r.labor,6);near(r.extras,3);near(r.material+r.printing+r.labor+r.extras+r.risk,cost);
 assert.equal(r.price,43.9);near(r.basePrice,cost/.55);near(r.profit,43.9*.95-cost);near(r.breakEven,cost/.95);assert.ok(r.profit/r.price>=.4);
});
test('all extra costs and workshop adjustments contribute once',()=>{
 const v={...defaults,kgPrice:160,energy:1.5,watts:200,machine:1,minutes:30,labor:40,extras:2,fileCost:1,overhead:3,shipping:7,fee:18,margin:30},r=calculateArtwork(v);
 near(r.cost,(16+1.8+6)/.95+20+3+2+1+3+7);near(r.extras,16);near(r.fees,r.price*.18);assert.ok(r.profit/r.price>=.3);
});
test('rounds up to .90 including cent boundaries; zero production costs remain zero',()=>{
 const zero=Object.fromEntries(Object.keys(defaults).map(k=>[k,0]));assert.equal(calculateArtwork(zero).price,0);
 for(const [cost,expected] of [[.01,.9],[.9,.9],[1,1.9],[24.9,24.9],[24.9001,25.9],[25.1,25.9]])assert.equal(calculateArtwork({...zero,packaging:cost}).price,expected);
});
test('offer simulator reports real loss, lower margin and target reached',()=>{
 const r=calculateArtwork(defaults);assert.equal(artworkOffer(defaults,10).status,'loss');assert.equal(artworkOffer(defaults,39.9).status,'below');assert.equal(artworkOffer(defaults,r.price).status,'met');near(artworkOffer(defaults,r.breakEven).profit,0);assert.equal(artworkOffer(defaults,(r.basePrice+r.price)/2).status,'met');
});
test('invalid percentages, numbers and unsafe totals cannot generate a price',()=>{
 for(const changes of [{fee:60},{margin:100},{failure:100},{grams:-1},{grams:NaN},{hours:Infinity},{packaging:1000001},{fee:99.999999999,margin:0,grams:1000000,hours:1000000,energy:1000000,watts:1000000}])assert.throws(()=>calculateArtwork({...defaults,...changes}));
 for(const price of [-1,NaN,Infinity,1000001])assert.throws(()=>artworkOffer(defaults,price));
});
test('calculator copy covers all fields and every site language',()=>{
 const pt=calculatorCopy('pt');for(const lang of ['pt','en','es','fr']){const c=calculatorCopy(lang);assert.deepEqual(Object.keys(c),Object.keys(pt));for(const k of [...Object.keys(defaults),...workshopKeys].filter(k=>k!=='fee'&&k!=='margin'))assert.ok(c[k]);for(const value of Object.values(c))assert.equal(typeof value,'string');}
});

test('selection fills validated profile totals, while custom or unverified pieces start blank',async()=>{
 const {artworkStartingValues}=await import('../lib/artwork-selection.mjs');
 const v=artworkStartingValues({printEstimate:{grams:123.45,hours:7.123456}}, {kgPrice:150});assert.equal(v.grams,123.45);assert.equal(v.hours,7.1235);assert.equal(v.kgPrice,150);
 for(const product of [null,{}, {name:'Saci'}]){const v=artworkStartingValues(product,null);assert.ok(Number.isNaN(v.grams));assert.ok(Number.isNaN(v.hours));assert.throws(()=>calculateArtwork(v));}
});
