import {hasProductFiles} from '../lib/print-profiles.mjs';
// Approved on 2026-11-19: nine designs plus three other existing subscriber designs.
// These fallback prices restore prices explicitly verified before subscriber-only mode.
export const subscriptionLaunchPrices={
  "c8bea304-db73-449a-a3eb-edb047fec507": 1290,
  "gameday-santa-cowboys": 8709,
  "noel-atletico-mg": 1990,
  "975c7193-f01a-48ff-a802-d447fef57446": 1990,
  "494d6019-550e-4a8b-8450-3ecebd4b0316": 1290,
  "86db109f-ea13-4218-a3c3-eb9da8109eb4": 1990,
  "b94c90f0-8d89-406a-8d00-5151587ba880": 1290,
  "c9c0a582-b550-4add-8427-f7ac62fa735c": 1990,
  "gameday-santa-packers": 8709,
  "gameday-santa-chiefs": 8709,
  "noel-cruzeiro": 1990,
  "noel-gremio": 1990
};
const migration='includedSubscription20261119';
export function migrateSubscriptionCatalog(data){
 if(data.migrations?.[migration])return data;
 const products=data.products.map(p=>{
  const previousPrice=subscriptionLaunchPrices[p.id];
  if(!previousPrice||!['paid','subscribers'].includes(p.access)||p.exclusive||p.url||!hasProductFiles(p))return p;
  return {...p,access:'paid',includedInSubscription:true,priceCents:p.priceCents>0?p.priceCents:previousPrice,allowPhysicalSales:false};
 });
 if(products.every((p,i)=>p===data.products[i]))return data;
 return {...data,products,migrations:{...data.migrations,[migration]:true}};
}
