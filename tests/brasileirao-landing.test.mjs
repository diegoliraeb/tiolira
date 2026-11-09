import test from 'node:test';
import assert from 'node:assert/strict';
import {BRASILEIRAO_ID,brasileiraoTeam,brasileiraoLineup,filterBrasileirao} from '../lib/brasileirao.mjs';
import {productSchema,publicCatalog} from '../server/schema.mjs';

const product=(overrides={})=>({id:'noel-gremio',slug:'noel-gremio',name:'Noel Grêmio',collection:BRASILEIRAO_ID,category:'Natal · Futebol brasileiro',description:'Arquivo digital',image:'/assets/test.jpg',access:'paid',priceCents:1990,filePath:'models/test.3mf',published:true,...overrides});

test('published edition maps known clubs including Flamengo legacy ID to Série A',()=>{
 for(const id of ['noel-vasco','noel-corinthians','noel-palmeiras','noel-sao-paulo','noel-santos','noel-botafogo','noel-fluminense','noel-athletico-pr','noel-atletico-mg','noel-bahia','noel-bragantino','noel-chapecoense','noel-coritiba','noel-cruzeiro','noel-gremio','noel-internacional','noel-mirassol','noel-remo','noel-vitoria','afb042fa-0f87-4d9e-9111-d3be10717a26'])assert.equal(brasileiraoTeam(product({id,slug:id})).series,'A');
 assert.equal(brasileiraoTeam(product({id:'afb042fa-0f87-4d9e-9111-d3be10717a26',slug:'noel-mengao'})).name,'Flamengo');
});
test('admin series overrides edition and category; imports can declare Série B',()=>{
 assert.equal(brasileiraoTeam(product({brasileiraoSeries:'B'})).series,'B');
 assert.equal(brasileiraoTeam(product({brasileiraoSeries:'extras',category:'Série B'})).series,'extras');
 assert.equal(brasileiraoTeam(product({category:'Natal · Série B'})).series,'B');
 assert.equal(brasileiraoTeam(product({id:'new-team',slug:'new-team'})).series,'extras');
});
test('search combines series and accent-insensitive names, aliases and cities; excludes other collections',()=>{
 const lineup=brasileiraoLineup([product(),product({id:'noel-mengao',slug:'noel-mengao',name:'Noel Mengão'}),product({id:'future-team',slug:'future-team',name:'Time Novo',brasileiraoSeries:'B'}),product({id:'nfl',collection:'nfl-santas'})]);
 assert.equal(lineup.length,3);
 assert.equal(filterBrasileirao(lineup,'gremio')[0].name,'Grêmio');
 assert.equal(filterBrasileirao(lineup,'RIO DE JANEIRO')[0].name,'Flamengo');
 assert.equal(filterBrasileirao(lineup,'Mengo')[0].name,'Flamengo');
 assert.equal(filterBrasileirao(lineup,'novo','B').length,1);
 assert.equal(filterBrasileirao(lineup,'gremio','B').length,0);
 assert.equal(filterBrasileirao(lineup,'','A').length,2);
 assert.equal(filterBrasileirao(lineup).length,3);
 assert.equal(filterBrasileirao(lineup,'unknown').length,0);
});
test('series persists through validation and public catalog without exposing downloads or changing price',()=>{
 const p=productSchema.parse(product({brasileiraoSeries:'B'}));
 const result=publicCatalog({collections:[{id:BRASILEIRAO_ID,published:true}],products:[p],stores:[],plans:[],settings:{}}).products[0];
 assert.equal(result.brasileiraoSeries,'B');
 assert.equal(result.priceCents,1990);
 assert.equal(result.hasFile,true);
 assert.equal(result.filePath,undefined);
 assert.equal(productSchema.safeParse(product()).success,true);
 assert.equal(productSchema.safeParse(product({brasileiraoSeries:'invalid'})).success,false);
});

 test('Séries C and D retain their classifications, prices and protected files',()=>{
 for(const series of ['C','D']){
 const p=productSchema.parse(product({id:'noel-extra-'+series.toLowerCase(),slug:'noel-extra-'+series.toLowerCase(),brasileiraoSeries:series}));
 const pub=publicCatalog({collections:[{id:BRASILEIRAO_ID,published:true}],products:[p],stores:[],plans:[],settings:{}}).products[0];
 assert.equal(pub.brasileiraoSeries,series);assert.equal(pub.priceCents,1990);assert.equal(pub.filePath,undefined);assert.equal(pub.hasFile,true);
 assert.equal(filterBrasileirao(brasileiraoLineup([pub]),'',series).length,1);
 assert.equal(brasileiraoTeam(product({category:'Natal · Série '+series})).series,series);
 }
 });
