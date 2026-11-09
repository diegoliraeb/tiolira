export const BRASILEIRAO_ID='noeis-brasileirao';
// Edition represented by the published collection; not a live league table.
const clubs=[
 ['noel-mengao','Flamengo','Rio de Janeiro','#b3222b','Mengão Mengo'],
 ['noel-palmeiras','Palmeiras','São Paulo','#176642','Verdão'],
 ['noel-vasco','Vasco','Rio de Janeiro','#242424','Vasco da Gama'],
 ['noel-corinthians','Corinthians','São Paulo','#333333','Timão'],
 ['noel-gremio','Grêmio','Porto Alegre','#228cc0','Gremio'],
 ['noel-bahia','Bahia','Salvador','#2163b1','Tricolor'],
 ['noel-sao-paulo','São Paulo','São Paulo','#be2831','Tricolor'],
 ['noel-santos','Santos','Santos','#333333','Peixe'],
 ['noel-botafogo','Botafogo','Rio de Janeiro','#272727','Fogão'],
 ['noel-fluminense','Fluminense','Rio de Janeiro','#6f2539','Flu'],
 ['noel-athletico-pr','Athletico-PR','Curitiba','#bd2632','Furacão Atletico Paranaense'],
 ['noel-atletico-mg','Atlético-MG','Belo Horizonte','#333333','Galo Atletico Mineiro'],
 ['noel-bragantino','Bragantino','Bragança Paulista','#b51b30','Red Bull'],
 ['noel-chapecoense','Chapecoense','Chapecó','#21733b','Chape'],
 ['noel-coritiba','Coritiba','Curitiba','#267149','Coxa'],
 ['noel-cruzeiro','Cruzeiro','Belo Horizonte','#2454a2','Raposa'],
 ['noel-internacional','Internacional','Porto Alegre','#c1232c','Inter Colorado'],
 ['noel-mirassol','Mirassol','Mirassol','#a17c19','Leão'],
 ['noel-remo','Remo','Belém','#253c6b','Leão'],
 ['noel-vitoria','Vitória','Salvador','#b12b30','Vitoria']
];
const byKey=new Map(clubs.map(([key,name,city,color,aliases])=>[key,{name,city,color,aliases,series:'A'}]));
// Home cities, independent of where a particular match is hosted or the club's division.
const clubCities={
 'noel-figueirense':'Florianópolis','noel-inter-de-limeira':'Limeira',
 'noel-america-mg':'Belo Horizonte','noel-guarani':'Campinas',
 'noel-sao-bernardo':'São Bernardo do Campo','noel-goias':'Goiânia',
 'noel-operario-pr':'Ponta Grossa','noel-juventude':'Caxias do Sul',
 'noel-ponte-preta':'Campinas','noel-paysandu':'Belém',
 'noel-vila-nova':'Goiânia','noel-csa':'Maceió',
 'noel-itabaiana':'Itabaiana','noel-maringa':'Maringá',
 'noel-atletico-go':'Goiânia','noel-floresta':'Fortaleza',
 'noel-avai':'Florianópolis','noel-caxias':'Caxias do Sul',
 'noel-anapolis':'Anápolis','noel-fortaleza':'Fortaleza',
 'noel-ypiranga-rs':'Erechim','noel-nautico':'Recife',
 'noel-botafogo-pb':'João Pessoa','noel-ituano':'Itu',
 'noel-sport':'Recife','noel-cuiaba':'Cuiabá',
 'noel-barra-sc':'Balneário Camboriú','noel-ceara':'Fortaleza',
 'noel-botafogo-sp':'Ribeirão Preto','noel-maranhao':'São Luís',
 'noel-amazonas':'Manaus','noel-santa-cruz':'Recife',
 'noel-ferroviaria':'Araraquara','noel-volta-redonda':'Volta Redonda',
 'noel-novorizontino':'Novo Horizonte','noel-crb':'Maceió',
 'noel-athletic':'São João del Rei','noel-confianca':'Aracaju',
 'noel-londrina':'Londrina','noel-brusque':'Brusque','noel-criciuma':'Criciúma'
};
const aliases={'afb042fa-0f87-4d9e-9111-d3be10717a26':'noel-mengao'};
export const searchText=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim().replace(/\s+/g,' ');
export function brasileiraoTeam(product){
 const known=byKey.get(aliases[product.id]||product.id)||byKey.get(product.slug);
 const category=/\bserie\s+([abcd])\b/.exec(searchText(product.category));
 const series=product.brasileiraoSeries||category?.[1]?.toUpperCase()||known?.series||'extras';
 const city=product.brasileiraoCity?.trim()||known?.city||clubCities[product.slug]||clubCities[product.id]||'';
 return {product,name:known?.name||product.name,city,color:known?.color||'#45634d',series,search:searchText([product.name,known?.name,city,known?.aliases].filter(Boolean).join(' '))};
}
export function brasileiraoLineup(products){return products.filter(p=>p.collection===BRASILEIRAO_ID).map(brasileiraoTeam);}
export function filterBrasileirao(lineup,query='',series=''){const term=searchText(query);return lineup.filter(t=>(!series||t.series===series)&&t.search.includes(term));}
