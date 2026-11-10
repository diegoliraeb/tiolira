import {isCourtesyCode,courtesyQuote} from './brasileirao-courtesy.mjs';
import {applyFamilyDiscount,allocateDiscount,familyEligible} from '../lib/family-discount.mjs';
import {applyNatalPromotion,natalEligible,promotionEntries} from '../lib/natal-promotion.mjs';
import {z} from 'zod';
import {readRecord,writeRecord,Conflict} from './store.mjs';
const KEY='cart-coupons.json';
export const couponCodeSchema=z.string().trim().max(40).transform(s=>s.toUpperCase()).pipe(z.string().regex(/^[A-Z0-9_-]*$/,'Use apenas letras, números, hífen e sublinhado no código.'));
export const cartCouponSchema=z.object({id:z.string().uuid(),code:couponCodeSchema.pipe(z.string().min(3)),type:z.enum(['percent','fixed']),value:z.number().int().min(1).max(1_000_000),minimumCents:z.number().int().min(0).max(10_000_000).default(0),expiresAt:z.iso.datetime().or(z.literal('')).default(''),active:z.boolean()}).refine(c=>c.type!=='percent'||c.value<=99,'O percentual deve ficar entre 1% e 99%.');
export async function cartCoupons(){const r=await readRecord(KEY);return {coupons:r?.data?.coupons||[],revision:r?.etag||null};}
export async function saveCartCoupon(input){
 const current=await cartCoupons();if(current.revision!==input.revision)throw new Conflict();
 const coupon=cartCouponSchema.parse(input.item);
 if(coupon.code.startsWith('TLIG-'))throw Object.assign(Error('Este prefixo é reservado aos cupons pessoais da promoção Instagram.'),{status:409});
 if(isCourtesyCode(coupon.code))throw Object.assign(Error('Este código é reservado à campanha Brasileirão.'),{status:409});
 if(current.coupons.some(c=>c.id!==coupon.id&&c.code===coupon.code))throw Object.assign(new Error('Já existe um cupom com esse código.'),{status:409});
 const coupons=[...current.coupons.filter(c=>c.id!==coupon.id),coupon];
 return {coupons,revision:await writeRecord(KEY,{coupons},current.revision)};
}
export function discountQuote(quote,code,coupons,now=Date.now(),natalContext,courtesyContext){
 code=couponCodeSchema.parse(code||'');
 if(code.startsWith('TLIG-'))throw Object.assign(Error('Use seu cupom pessoal na seção Promoção de Natal da área do parceiro.'),{status:400});
 if(isCourtesyCode(code))return courtesyQuote(quote,courtesyContext);
 quote=applyFamilyDiscount(quote);
 quote=applyNatalPromotion(quote,natalContext,now);
 const subtotalCents=quote.subtotalCents;
 if(!code)return quote;
 const coupon=coupons.find(c=>c.code===code);
 const fail=message=>{throw Object.assign(new Error(message),{status:400});};
 if(!coupon||!coupon.active)fail('Cupom inválido ou inativo.');
 if(coupon.expiresAt&&Date.parse(coupon.expiresAt)<=now)fail('Este cupom expirou.');
 const eligible=item=>(!quote.promotion?.percent||!familyEligible(item))&&(!promotionEntries(quote.natalPromotion).some(p=>natalEligible(item,p.collectionId)));
 const couponSubtotalCents=quote.items.filter(eligible).reduce((n,item)=>n+item.priceCents,0);
 if(!couponSubtotalCents)fail(quote.natalPromotion?'A oferta Black Friday não acumula com cupons nas mesmas peças. Remova o cupom para continuar.':'O desconto progressivo não acumula com cupons nas mesmas peças. Remova o cupom para continuar.');
 if(couponSubtotalCents<coupon.minimumCents)fail(`Este cupom exige uma compra mínima de ${(coupon.minimumCents/100).toLocaleString('pt-BR',{style:'currency',currency:quote.currency||'BRL'})}.`);
 const discountCents=coupon.type==='percent'?Math.round(couponSubtotalCents*coupon.value/100):coupon.value;
 if(discountCents<=0||discountCents>=couponSubtotalCents)fail('Este cupom não se aplica ao valor do carrinho. O total deve ser maior que zero.');
 const allocations=allocateDiscount(quote.items,discountCents,eligible);
 const items=quote.items.map((item,index)=>({...item,discountCents:item.discountCents+allocations[index],totalCents:item.totalCents-allocations[index]}));
 return {...quote,items,subtotalCents,discountCents:quote.discountCents+discountCents,couponDiscountCents:discountCents,totalCents:quote.totalCents-discountCents,coupon:{id:coupon.id,code:coupon.code,type:coupon.type,value:coupon.value}};
}
