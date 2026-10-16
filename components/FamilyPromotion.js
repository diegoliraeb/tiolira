import {discountPercent} from '../lib/family-discount.mjs';
import {familyCopy} from '../lib/family-discount-copy.mjs';
import {formatMoney} from '../lib/international-pricing.mjs';
export function FamilySavings({promotion,lang='pt',currency='BRL'}){
 if(!promotion)return null;
 const c=familyCopy(lang),money=value=>formatMoney(value,currency,lang);
 return <section className="family-savings" aria-live="polite" aria-atomic="true"><strong>{promotion.quantity} {c.count}</strong><dl><div><dt>{c.subtotal}</dt><dd>{money(promotion.subtotalCents)}</dd></div><div><dt>{c.progressive}</dt><dd>{promotion.percent}%</dd></div><div className="family-saving-highlight"><dt>{c.saving}</dt><dd>{money(promotion.discountCents)}</dd></div><div><dt>{c.eligibleTotal}</dt><dd>{money(promotion.totalCents)}</dd></div></dl></section>;
}
export default function FamilyPromotion({quantity=0,lang='pt',href}){
 const c=familyCopy(lang),percent=discountPercent(quantity);
 return <section className="family-promotion" aria-label={c.title}><div className="family-promotion-heading"><div><p className="eyebrow">SAGRADA FAMÍLIA</p><h2>{c.title}</h2><p>{c.subtitle}</p></div><strong className="family-max">{c.max}</strong></div><div className="family-progress" role="progressbar" aria-label={c.progressive} aria-valuemin={0} aria-valuemax={40} aria-valuenow={percent}><span style={{width:`${percent/40*100}%`}}/></div><div className="family-steps">{[1,3,5,7,9].map(n=><span key={n} className={quantity>=n?'reached':''}>{n===9?'9+':n} · {discountPercent(n)}%</span>)}</div><p className="family-next" role="status">{quantity>=9?c.done:quantity?c.next:c.start}</p><details><summary>{c.table}</summary><p>{c.reference}</p><div className="family-table-wrap"><table><thead><tr><th>{c.quantity}</th><th>{c.discount}</th><th>{c.total}</th></tr></thead><tbody>{Array.from({length:10},(_,i)=>i+1).map(n=><tr key={n} className={quantity===n?'current':''}><td>{n}</td><td>{discountPercent(n)}%</td><td>{formatMoney(n*1290-Math.round(n*1290*discountPercent(n)/100),'BRL',lang)}</td></tr>)}</tbody></table></div></details><small>{c.rules}</small>{href&&<a className="button primary" href={href}>{c.browse} →</a>}</section>;
}
