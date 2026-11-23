import {isSubscriptionProduct} from './subscriber-access.mjs';
export const normalizeLibrary=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export const subscriberExclusive=product=>isSubscriptionProduct(product)&&product.access==='subscribers';
export const hasLibraryDownload=product=>Boolean(product.downloadUrl||product.printProfiles?.some(p=>p.downloadUrl));
export function filterLibrary(items,groups,{query='',collection='all',filter='all',purchasedIds=new Set(),availableOnly=false}={}){
 const names=new Map(groups.map(g=>[g.id,g.name]));const q=normalizeLibrary(query);
 return items.filter(p=>(!availableOnly||hasLibraryDownload(p))&&(collection==='all'||p.collection===collection)&&normalizeLibrary(`${p.name} ${names.get(p.collection)||''}`).includes(q)&&(filter==='all'||filter==='purchased'&&purchasedIds.has(p.id)||filter==='included'&&isSubscriptionProduct(p)||filter==='exclusive'&&subscriberExclusive(p)||filter==='maker'&&p.access==='maker'));
}
export function membershipSummary(subscription){return {active:subscription.active===true,validUntil:subscription.validUntil||null,status:subscription.status||'none',pending:!subscription.active&&(subscription.legacyPending||['creating','pending','review','overdue'].includes(subscription.status))===true};}
