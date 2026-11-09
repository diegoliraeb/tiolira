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
 const p=productSchema.parse(product({brasileiraoSeries:'B',brasileiraoCity:'  Cidade Nova  '}));
 const result=publicCatalog({collections:[{id:BRASILEIRAO_ID,published:true}],products:[p],stores:[],plans:[],settings:{}}).products[0];
 assert.equal(result.brasileiraoSeries,'B');
 assert.equal(result.brasileiraoCity,'Cidade Nova');
 assert.equal(brasileiraoTeam(result).city,'Cidade Nova');
 assert.equal(filterBrasileirao(brasileiraoLineup([result]),'porto alegre').length,0);
 assert.equal(filterBrasileirao(brasileiraoLineup([result]),'cidade nova','B').length,1);
 assert.equal(result.priceCents,1990);
 assert.equal(result.hasFile,true);
 assert.equal(result.filePath,undefined);
 assert.equal(productSchema.safeParse(product()).success,true);
 assert.equal(productSchema.safeParse(product({brasileiraoSeries:'invalid'})).success,false);
});

test('new catalog clubs match their home cities with UUID ids and keep their series',()=>{
 const rows=[['noel-crb','B','Maceió'],['noel-csa','D','Maceió'],['noel-nautico','B','Recife'],['noel-sport','B','Recife'],['noel-santa-cruz','C','Recife'],['noel-avai','B','Florianópolis'],['noel-figueirense','C','Florianópolis'],['noel-guarani','C','Campinas'],['noel-ponte-preta','B','Campinas'],['noel-botafogo-sp','B','Ribeirão Preto'],['noel-botafogo-pb','C','João Pessoa'],['noel-barra-sc','C','Balneário Camboriú'],['noel-athletic','B','São João del Rei']];
 const lineup=brasileiraoLineup(rows.map(([slug,series,city],i)=>product({id:`uuid-${i}`,slug,name:slug,brasileiraoSeries:series})));
 for(const [slug,series,city] of rows){const item=lineup.find(t=>t.product.slug===slug);assert.equal(item.city,city);assert.equal(item.series,series);assert.ok(filterBrasileirao(lineup,city,series).includes(item));}
 assert.deepEqual(filterBrasileirao(lineup,'maceio').map(t=>t.product.slug),['noel-crb','noel-csa']);
 assert.deepEqual(filterBrasileirao(lineup,'maceio','D').map(t=>t.product.slug),['noel-csa']);
 assert.equal(filterBrasileirao(lineup,'  Sao   Joao del Rei  ').length,1);
 assert.equal(brasileiraoTeam(product({id:'noel-crb',slug:'renamed',brasileiraoCity:' '})).city,'Maceió');
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

test('state names and exact abbreviations return all clubs in that state across cities and series',()=>{
 const rows=[['noel-csa','D'],['noel-crb','B'],['noel-internacional','A'],['noel-gremio','A'],['noel-mengao','A'],['noel-volta-redonda','C'],['noel-palmeiras','A'],['noel-guarani','C'],['noel-athletic','B'],['noel-remo','A'],['noel-athletico-pr','A']];
 const lineup=brasileiraoLineup(rows.map(([slug,series])=>product({id:slug,slug,name:slug,brasileiraoSeries:series})));
 const slugs=(query,series='')=>filterBrasileirao(lineup,query,series).map(t=>t.product.slug);
 assert.deepEqual(slugs(' al '),['noel-csa','noel-crb']);
 assert.deepEqual(slugs('Alagoas'),slugs('AL'));
 assert.deepEqual(slugs('AL','D'),['noel-csa']);
 assert.deepEqual(slugs('Rio de Janeiro'),['noel-mengao','noel-volta-redonda']);
 assert.deepEqual(slugs('rj'),slugs('Rio de Janeiro'));
 assert.deepEqual(slugs('sao paulo'),['noel-palmeiras','noel-guarani']);
 assert.deepEqual(slugs('SP'),slugs('São Paulo'));
 assert.deepEqual(slugs('Pará'),['noel-remo']);
 assert.deepEqual(slugs('PA'),slugs('Pará'));
 assert.deepEqual(slugs('Paraná'),['noel-athletico-pr']);
 assert.deepEqual(slugs('Minas Gerais'),['noel-athletic']);
 assert.deepEqual(slugs('AC'),[]);
 assert.deepEqual(slugs('maceio'),['noel-csa','noel-crb']);
 assert.equal(slugs('').length,rows.length);
});
test('state admin override survives catalog validation and invalid states are rejected',()=>{
 const p=productSchema.parse(product({brasileiraoCity:'Cidade Nova',brasileiraoState:'RN'}));
 const pub=publicCatalog({collections:[{id:BRASILEIRAO_ID,published:true}],products:[p],stores:[],plans:[],settings:{}}).products[0];
 assert.equal(pub.brasileiraoState,'RN');
 assert.equal(brasileiraoTeam(pub).state,'Rio Grande do Norte');
 assert.equal(filterBrasileirao(brasileiraoLineup([pub]),'RN').length,1);
 assert.equal(filterBrasileirao(brasileiraoLineup([pub]),'RS').length,0);
 assert.equal(productSchema.safeParse(product({brasileiraoState:'XX'})).success,false);
 assert.equal(brasileiraoTeam(product({brasileiraoState:''})).stateCode,'RS');
 assert.equal(brasileiraoTeam(product({id:'new',slug:'new',brasileiraoCity:'Unknown'})).stateCode,'');
});

test('selected state combines with text and series and can be cleared',()=>{
 const lineup=brasileiraoLineup([product({id:'noel-csa',slug:'noel-csa',name:'CSA',brasileiraoSeries:'D'}),product({id:'noel-crb',slug:'noel-crb',name:'CRB',brasileiraoSeries:'B'}),product()]);
 assert.equal(filterBrasileirao(lineup,'','','AL').length,2);
 assert.equal(filterBrasileirao(lineup,'','B','AL')[0].product.slug,'noel-crb');
 assert.equal(filterBrasileirao(lineup,'csa','','AL')[0].product.slug,'noel-csa');
 assert.equal(filterBrasileirao(lineup,'gremio','','AL').length,0);
 assert.equal(filterBrasileirao(lineup,'','','').length,3);
});
