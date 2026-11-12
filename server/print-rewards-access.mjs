import {collectionAccess} from './collection-access.mjs';
import {readRecord} from './store.mjs';
export const PRINT_REWARDS_KEY='print-rewards.json';
export const emptyPrintRewards=()=>({config:{enabled:false,collectionIds:[],version:null},claims:[]});
// A redeemed model remains available after photo review or campaign suspension.
export async function printRewardsAccess(member){
 const claims=((await readRecord(PRINT_REWARDS_KEY))?.data?.claims||[]).filter(c=>c.memberId===member.id);
 return {productIds:new Set(claims.map(c=>c.productId)),licenses:claims.map(c=>c.license)};
}

export async function complimentaryAccess(member,catalog){
 const [collections,rewards]=await Promise.all([collectionAccess(member,catalog),printRewardsAccess(member)]);
 const existing=new Set(collections.licenses.map(l=>l.productId));
 return {collectionIds:collections.collectionIds,productIds:new Set([...collections.productIds,...rewards.productIds]),licenses:[...collections.licenses,...rewards.licenses.filter(l=>!existing.has(l.productId))]};
}
