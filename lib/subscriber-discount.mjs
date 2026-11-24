import {allocateDiscount} from './family-discount.mjs';
export const SUBSCRIBER_DISCOUNT_PERCENT=10;
export function applySubscriberDiscount(quote,active=false){
 if(active!==true||quote.subscriberDiscount||quote.courtesy||quote.totalCents<=0)return quote;
 const bases=quote.items.map(item=>({...item,priceCents:Math.max(0,item.totalCents??item.priceCents)}));
 const eligible=item=>['product','collection'].includes(item.kind)&&item.priceCents>0;
 const baseCents=bases.filter(eligible).reduce((n,item)=>n+item.priceCents,0);
 const discountCents=Math.round(baseCents*SUBSCRIBER_DISCOUNT_PERCENT/100);
 if(!discountCents)return quote;
 const allocation=allocateDiscount(bases,discountCents,eligible);
 return {...quote,items:quote.items.map((item,i)=>({...item,subscriberDiscountCents:allocation[i],discountCents:(item.discountCents||0)+allocation[i],totalCents:bases[i].priceCents-allocation[i]})),discountCents:(quote.discountCents||0)+discountCents,totalCents:quote.totalCents-discountCents,subscriberDiscount:{id:'active-subscriber-10-v1',percent:SUBSCRIBER_DISCOUNT_PERCENT,baseCents,discountCents}};
}
export const subscriberDiscountCopy={
 pt:{title:'10% de desconto para assinantes',description:'Assinantes ativos têm 10% de desconto automático em todas as obras pagas e coleções pagas do site. O benefício é aplicado no carrinho sobre o valor restante após ofertas e cupons. Não se aplica à assinatura anual.',label:'Desconto de assinante · 10%'},
 en:{title:'10% off for subscribers',description:'Active subscribers receive an automatic 10% discount on all paid designs and paid collections on the website. Applied in the cart to the remaining amount after offers and coupons. Excludes the annual subscription.',label:'Subscriber discount · 10%'},
 es:{title:'10% de descuento para suscriptores',description:'Los suscriptores activos tienen un 10% de descuento automático en todas las obras y colecciones de pago del sitio. Se aplica en el carrito sobre el importe restante después de ofertas y cupones. No se aplica a la suscripción anual.',label:'Descuento de suscriptor · 10%'},
 fr:{title:'10 % de réduction pour les abonnés',description:'Les abonnés actifs bénéficient automatiquement de 10 % de réduction sur toutes les créations et collections payantes du site. La remise s’applique au panier sur le montant restant après les offres et les codes promotionnels. Hors abonnement annuel.',label:'Réduction abonné · 10 %'}
};
