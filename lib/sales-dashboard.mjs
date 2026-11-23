const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export function salesDashboardRows(products,{query='',collection='all',activity='all',sort='downloads',direction='desc'}={}){
 const term=normalize(query).trim(),keys=['downloads','totalSales','revenueCents','revenueUsdCents','uniquePartners','lastDownloadAt','name'];
 const key=keys.includes(sort)?sort:'downloads',sign=direction==='asc'?1:-1;
 return products.filter(p=>(collection==='all'||p.collection===collection)&&normalize(p.name+' '+p.collectionName).includes(term)&&(activity==='all'||activity==='downloads'&&p.downloads>0||activity==='no-downloads'&&!p.downloads||activity==='sales'&&p.totalSales>0||activity==='no-sales'&&!p.totalSales)).sort((a,b)=>{
  const delta=key==='name'?a.name.localeCompare(b.name,'pt-BR'):key==='lastDownloadAt'?(Date.parse(a[key])||0)-(Date.parse(b[key])||0):(a[key]||0)-(b[key]||0);
  return sign*delta||a.name.localeCompare(b.name,'pt-BR')||a.id.localeCompare(b.id);
 });
}
export function salesDashboardTotals(rows){return rows.reduce((a,p)=>({downloads:a.downloads+p.downloads,totalSales:a.totalSales+p.totalSales,revenueCents:a.revenueCents+p.revenueCents,revenueUsdCents:a.revenueUsdCents+p.revenueUsdCents,downloadedWorks:a.downloadedWorks+(p.downloads>0?1:0)}),{downloads:0,totalSales:0,revenueCents:0,revenueUsdCents:0,downloadedWorks:0});}
