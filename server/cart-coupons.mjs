import {z} from 'zod';
import {readRecord,writeRecord,Conflict} from './store.mjs';
const KEY='cart-coupons.json';
export const couponCodeSchema=z.string().trim().max(40).transform(s=>s.toUpperCase()).pipe(z.string().regex(/^[A-Z0-9_-]*$/,'Use apenas letras, números, hífen e sublinhado no código.'));
export const cartCouponSchema=z.object({id:z.string().uuid(),code:couponCodeSchema.pipe(z.string().min(3)),type:z.enum(['percent','fixed']),value:z.number().int().min(1).max(1_000_000),minimumCents:z.number().int().min(0).max(10_000_000).default(0),expiresAt:z.iso.datetime().or(z.literal('')).default(''),active:z.boolean()}).refine(c=>c.type!=='percent'||c.value<=99,'O percentual deve ficar entre 1% e 99%.');
export async function cartCoupons(){const r=await readRecord(KEY);return {coupons:r?.data?.coupons||[],revision:r?.etag||null};}
export async function saveCartCoupon(input){
 const current=await cartCoupons();if(current.revision!==input.revision)throw new Conflict();
 const coupon=cartCouponSchema.parse(input.item);
 if(current.coupons.some(c=>c.id!==coupon.id&&c.code===coupon.code))throw Object.assign(new Error('Já existe um cupom com esse código.'),{status:409});
 const coupons=[...current.coupons.filter(c=>c.id!==coupon.id),coupon];
 return {coupons,revision:await writeRecord(KEY,{coupons},current.revision)};
}
export function discountQuote(quote,code,coupons,now=Date.now()){
 code=couponCodeSchema.parse(code||'');
 const subtotalCents=quote.totalCents;
 if(!code)return {...quote,subtotalCents,discountCents:0,coupon:null};
 const coupon=coupons.find(c=>c.code===code);
 const fail=message=>{throw Object.assign(new Error(message),{status:400});};
 if(!coupon||!coupon.active)fail('Cupom inválido ou inativo.');
 if(coupon.expiresAt&&Date.parse(coupon.expiresAt)<=now)fail('Este cupom expirou.');
 if(subtotalCents<coupon.minimumCents)fail(`Este cupom exige uma compra mínima de ${(coupon.minimumCents/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}.`);
 const discountCents=coupon.type==='percent'?Math.round(subtotalCents*coupon.value/100):coupon.value;
 if(discountCents<=0||discountCents>=subtotalCents)fail('Este cupom não se aplica ao valor do carrinho. O total deve ser maior que zero.');
 // Allocate cents deterministically so product revenue sums to the amount actually charged.
 const allocations=quote.items.map((item,index)=>({index,cents:Math.floor(discountCents*item.priceCents/subtotalCents),remainder:(discountCents*item.priceCents)%subtotalCents}));
 let remaining=discountCents-allocations.reduce((n,x)=>n+x.cents,0);
 for(const allocation of [...allocations].sort((a,b)=>b.remainder-a.remainder||a.index-b.index)){if(!remaining)break;allocation.cents++;remaining--;}
 const items=quote.items.map((item,index)=>({...item,discountCents:allocations[index].cents,totalCents:item.priceCents-allocations[index].cents}));
 return {...quote,items,subtotalCents,discountCents,totalCents:subtotalCents-discountCents,coupon:{id:coupon.id,code:coupon.code,type:coupon.type,value:coupon.value}};
}
