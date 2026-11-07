import {getCatalog,writeRecord,Conflict} from './store.mjs';

const collection='nfl-santas';
export async function closingRate(now=new Date()){
 const format=date=>date.toLocaleDateString('en-US',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).replaceAll('/','-');
 const periodStart=new Date(now.getTime()-14*86400000);
 const url=new URL('https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoDolarPeriodo(dataInicial=@inicio,dataFinalCotacao=@fim)');
 url.search=new URLSearchParams({'@inicio':"'"+format(periodStart)+"'",'@fim':"'"+format(now)+"'",'$orderby':'dataHoraCotacao desc','$top':'1','$format':'json'}).toString().replaceAll('+','%20');
 const res=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(14000)});
 if(!res.ok)throw Error('Banco Central unavailable');
 const row=(await res.json()).value?.[0];
 if(!Number.isFinite(row?.cotacaoVenda)||row.cotacaoVenda<=0)throw Error('Invalid closing rate');
 return {rate:row.cotacaoVenda,date:row.dataHoraCotacao.slice(0,10)};
}

export async function refreshGamedayPrices(){
 const quote=await closingRate();
 for(let attempt=0;attempt<4;attempt++){
  const {data,etag}=await getCatalog();
  let changed=0;
  const products=data.products.map(p=>{
   if(p.collection!==collection||p.access!=='paid'||!(p.priceUsdCents>0))return p;
   const priceCents=Math.round(p.priceUsdCents*quote.rate);
   if(priceCents===p.priceCents)return p;
   changed++;return {...p,priceCents};
  });
  if(!changed)return {...quote,changed};
  try{await writeRecord('catalog.json',{...data,products,updatedAt:new Date().toISOString()},etag);return {...quote,changed};}
  catch(error){if(!(error instanceof Conflict)||attempt===3)throw error;}
 }
}
