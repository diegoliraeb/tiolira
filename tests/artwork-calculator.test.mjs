import test from 'node:test';
import assert from 'node:assert/strict';
import {artworkDefaults as defaults,calculateArtwork,artworkOffer,workshopKeys} from '../lib/calculator.mjs';
import {calculatorCopy} from '../lib/artwork-calculator-copy.mjs';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
test('worksheet includes material, power, equipment, failed prints, manual work and packaging',()=>{
 const r=calculateArtwork(defaults),cost=(12+.72+3.6)/.95+6+3;
 near(r.cost,cost);near(r.material,12);near(r.printing,4.32);near(r.labor,6);near(r.extras,3);near(r.material+r.printing+r.labor+r.extras+r.risk,cost);
 assert.equal(r.price,47.9);near(r.basePrice,cost/.55);near(r.profit,47.9*.95-cost);near(r.breakEven,cost/.95);assert.ok(r.profit/r.price>=.4);
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


test('group references sum each quantity, and add/remove never retain stale totals',async()=>{
 const {artworkGroupTotals}=await import('../lib/artwork-selection.mjs');
 const products=[{id:'saci',printEstimate:{grams:91.12,hours:20556/3600}},{id:'curupira',printEstimate:{grams:89.81,hours:19127/3600}}];
 const items=[{productId:'saci',quantity:2},{productId:'curupira',quantity:3}];
 const result=artworkGroupTotals(items,products);assert.equal(result.quantity,5);assert.equal(result.grams,451.67);near(result.hours,Math.round((20556*2+19127*3)/3600*10000)/10000);
 assert.equal(artworkGroupTotals(items.slice(1),products).grams,269.43);
 assert.equal(artworkGroupTotals([{productId:'saci',quantity:1}],products).grams,91.12);
 for(const group of [[],[{productId:'missing',quantity:1}],[...items,{productId:'missing',quantity:1}]]){const r=artworkGroupTotals(group,products);assert.equal(r.complete,false);assert.ok(Number.isNaN(r.grams));assert.ok(Number.isNaN(r.hours));}
 for(const quantity of [0,-1,1.5,1000,NaN])assert.throws(()=>artworkGroupTotals([{productId:'saci',quantity}],products));
 assert.deepEqual(items,[{productId:'saci',quantity:2},{productId:'curupira',quantity:3}]);
});

test('individual group costs preserve the total and allocate shared costs only once',async()=>{
 const {artworkGroupBreakdown}=await import('../lib/artwork-selection.mjs');
 const products=[{id:'a',printEstimate:{grams:100,hours:2}},{id:'b',printEstimate:{grams:50,hours:4}}],items=[{productId:'a',quantity:2},{productId:'b',quantity:3}];
 const v={...defaults,grams:700,hours:32,minutes:50,packaging:10,extras:5,fileCost:15,overhead:20,shipping:25};
 const breakdown=artworkGroupBreakdown(items,products,v),[a,b]=breakdown.lines;
 const expectedA=calculateArtwork({...v,grams:200,hours:4,minutes:10,packaging:2,extras:1,fileCost:3,overhead:4,shipping:5});
 const expectedB=calculateArtwork({...v,grams:100,hours:8,minutes:10,packaging:2,extras:1,fileCost:3,overhead:4,shipping:5});
 near(a.unit.cost,expectedA.cost);near(b.unit.cost,expectedB.cost);assert.equal(a.unit.price,expectedA.price);assert.equal(b.unit.price,expectedB.price);
 near(a.cost+b.cost,calculateArtwork(v).cost);near(breakdown.individualTotal,a.unit.price*2+b.unit.price*3);assert.equal(a.subtotal,Math.round(a.unit.price*100)*2/100);
 for(const changed of [{...v,fee:18,margin:20},{...v,grams:0,hours:0},{...v,grams:451.67,hours:27.3592}]){const r=artworkGroupBreakdown(items,products,changed);near(r.lines.reduce((n,l)=>n+l.cost,0),calculateArtwork(changed).cost);}
 const one=artworkGroupBreakdown([{productId:'a',quantity:1}],products,v);near(one.lines[0].unit.cost,calculateArtwork(v).cost);assert.equal(one.lines[0].unit.price,calculateArtwork(v).price);
 assert.equal(artworkGroupBreakdown([],products,v),null);assert.equal(artworkGroupBreakdown([...items,{productId:'unknown',quantity:1}],products,v),null);
 assert.throws(()=>artworkGroupBreakdown(items,products,{...v,grams:NaN}));
});

test('individual rounding is separate from group rounding; repeated copies are unit priced',async()=>{
 const {artworkGroupBreakdown}=await import('../lib/artwork-selection.mjs');
 const zero=Object.fromEntries(Object.keys(defaults).map(k=>[k,0]));
 const items=[{productId:'a',quantity:3}],products=[{id:'a',printEstimate:{grams:1,hours:1}}];
 const v={...zero,packaging:3};const r=artworkGroupBreakdown(items,products,v);assert.equal(r.lines[0].unit.cost,1);assert.equal(r.lines[0].unit.price,1.9);assert.equal(r.individualTotal,5.7);assert.equal(calculateArtwork(v).price,3.9);
 assert.equal(artworkGroupBreakdown(items,products,zero).individualTotal,0);
});
