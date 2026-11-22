const migration='nflFixedBrl20261122';
// Owner requested BRL 19.90 per NFL design. Apply once, then respect admin edits.
export function migrateNflFixedPrices(data){
 if(data.migrations?.[migration]||!data.products.some(p=>p.collection==='nfl-santas'))return data;
 const eligible=data.products.filter(p=>p.collection==='nfl-santas'&&p.access==='paid'&&p.published&&!p.exclusive&&p.priceCents>0);
 const oldSum=eligible.reduce((sum,p)=>sum+p.priceCents,0),newSum=eligible.length*1990,collection=data.collections.find(c=>c.id==='nfl-santas');
 const oldBundle=collection?.priceCents||0;
 const newBundle=oldSum>0&&oldBundle>0&&oldBundle<oldSum?Math.round(oldBundle*newSum/oldSum):oldBundle;
 const audit={at:new Date().toISOString(),count:eligible.length,previousSumCents:oldSum,previousBundleCents:oldBundle,newSumCents:newSum,newBundleCents:newBundle};
 return {...data,products:data.products.map(p=>p.collection==='nfl-santas'&&p.access==='paid'?{...p,priceCents:1990}:p),
  collections:data.collections.map(c=>c.id==='nfl-santas'&&c.priceCents>0?{...c,priceCents:newBundle}:c),
  migrations:{...data.migrations,[migration]:audit},updatedAt:audit.at};
}
