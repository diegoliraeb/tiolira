import {randomUUID} from 'node:crypto';
import {updateRecord, getCatalog} from './store.mjs';
import {quoteCart, ownedIds, purchaseLicenseTerms, safeOrder} from './commerce.mjs';
import {collectionAccess} from './collection-access.mjs';
import {asaasConfig} from './asaas.mjs';
import {marketCatalog, internationalBuyer} from '../lib/international-pricing.mjs';
import {PROMOTION_ID, PROMOTION_COLLECTIONS} from './instagram-promotion-rules.mjs';

const fail = (message, status = 409) => {throw Object.assign(Error(message), {status});};
export async function redeemInstagramOrder(member, claim, input, {enabled, now = Date.now()}) {
  const {data: catalog} = await getCatalog(), currency = internationalBuyer(member) ? 'USD' : 'BRL';
  const data = marketCatalog(catalog, currency), granted = await collectionAccess(member, catalog);
  const environment = asaasConfig().environment;
  let orderId;
  const updated = await updateRecord('commerce.json', old => {
    const state = old || {orders: [], downloads: {}, recentDownloads: []};
    const previous = state.orders.find(o => o.instagramPromotion?.claimId === claim.id || o.memberId === member.id && o.instagramPromotion?.campaignId === PROMOTION_ID);
    if (previous) {
      if (previous.memberId !== member.id || previous.status !== 'paid' || previous.environment !== environment || previous.productIds?.[0] !== input.productId) fail('O cupom já foi utilizado. Consulte o modelo em Meus pedidos.');
      orderId = previous.id; return state;
    }
    if (!enabled || Date.parse(claim.expiresAt) < now) fail('O prazo de uso deste cupom encerrou ou a campanha está pausada.');
    const product = data.products.find(p => p.id === input.productId);
    if (!product || !PROMOTION_COLLECTIONS.includes(product.collection) || !claim.collectionIds.includes(product.collection)) fail('Escolha um modelo individual do Brasileirão ou da Champions.', 400);
    const quote = quoteCart(data, [{kind: 'product', id: product.id, quantity: 1}], new Set([...ownedIds(state.orders, member.id), ...granted.productIds]));
    const issuedAt = new Date(now).toISOString(); orderId = randomUUID();
    const order = {
      ...quote, id: orderId, requestId: claim.id, memberId: member.id, memberName: member.name, memberEmail: member.email,
      createdAt: issuedAt, paidAt: issuedAt, status: 'paid', provider: 'promotion', currency, environment, billingType: 'PROMOTION',
      lang: ['pt','en','es','fr'].includes(input.lang) ? input.lang : 'pt',
      subtotalCents: quote.totalCents, totalCents: 0, discountCents: quote.totalCents, couponDiscountCents: quote.totalCents,
      coupon: {id: claim.id, code: claim.code, type: 'instagram', value: 100},
      instagramPromotion: {campaignId: PROMOTION_ID, claimId: claim.id},
      items: quote.items.map(i => ({...i, totalCents: 0, discountCents: i.priceCents})),
      licenses: [{code: `TL-COMPRA-${randomUUID().toUpperCase()}`, orderId, memberId: member.id, partnerName: member.name, productId: product.id, productName: product.name, issuedAt, terms: purchaseLicenseTerms, source: 'purchase'}],
    };
    // Coupon consumption, the order, download entitlement and license commit together.
    state.orders.push(order); return state;
  });
  return safeOrder(updated.orders.find(o => o.id === orderId), updated.orders);
}
