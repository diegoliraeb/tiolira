import {subscriptionPresentation} from '../../../../lib/subscription-presentation.mjs';
import {subscriberDiscountCopy} from '../../../../lib/subscriber-discount.mjs';
import Link from 'next/link';
import {notFound} from 'next/navigation';
import Header from '../../../../components/Header';
import Footer from '../../../../components/Footer';
import {readPublicCatalog} from '../../../../lib/catalog';
import {localized} from '../../../../lib/i18n';
import {pageMetadata,productPath} from '../../../../lib/seo.mjs';
import {isSubscriptionProduct} from '../../../../lib/subscriber-access.mjs';
import {isAvailable} from '../../../../lib/product-order.mjs';
import {commercialPolicy} from '../../../../lib/maker-license.mjs';
import {subscriberExclusive} from '../../../../lib/club-library.mjs';
import {clubInterfaceCopy} from '../../../../lib/club-interface-copy.mjs';
import {subscriptionGuide} from '../../../../lib/subscription-guide.mjs';
export const dynamic='force-dynamic';
export async function generateMetadata({params}){const {lang}=await params;if(!['pt','en','es','fr'].includes(lang))notFound();const c=subscriptionGuide(lang);return pageMetadata({lang,path:'/assinatura/sobre',title:c.title,description:c.intro});}
export default async function Page({params}){const {lang}=await params;if(!['pt','en','es','fr'].includes(lang))notFound();const c=Object.fromEntries(Object.entries(subscriptionGuide(lang)).map(([k,v])=>[k,typeof v==='string'?subscriptionPresentation(v,lang):v])),ui=clubInterfaceCopy(lang),catalog=await readPublicCatalog(),groups=new Set(catalog.collections.filter(g=>g.published!==false&&!g.comingSoon).map(g=>g.id)),included=catalog.products.filter(p=>p.published!==false&&groups.has(p.collection)&&isAvailable(p)&&isSubscriptionProduct(p)&&commercialPolicy(p,catalog.collections)!=='noncommercial'),exclusive=included.filter(subscriberExclusive),shared=included.filter(p=>!subscriberExclusive(p));
 const gallery=list=>list.length?<div className="subscription-guide-gallery">{list.map(p=><Link key={p.id} href={productPath(lang,p)}><img src={p.image} alt="" loading="lazy" width="100" height="120"/><span><strong>{localized(p,lang).name}</strong><small>{commercialPolicy(p,catalog.collections)==='noncommercial'?ui.personal:subscriberExclusive(p)?ui.exclusive:ui.included}</small></span></Link>)}</div>:<p>{c.empty}</p>;
 return <><Header lang={lang}/><main className="subscription-guide wrap"><header><p className="eyebrow">TIO LIRA · SITE / MAKERWORLD</p><h1>{c.title}</h1><p>{c.intro}</p><strong className="subscription-guide-price">{c.price}</strong><div className="subscription-guide-actions"><Link className="button primary" href={`/${lang}/clube#assinatura`}>{ui.manage}</Link><a className="button outline" href="#obras-incluidas">{ui.included}</a><a className="text-link" href="#licenca-comercial">{c.commercial}</a></div></header>
 <section className="subscription-guide-key"><h2>{subscriberDiscountCopy[lang].title}</h2><p>{subscriberDiscountCopy[lang].description}</p></section><section><h2>{c.how}</h2><ol className="subscription-guide-steps">{c.steps.map(step=><li key={step}>{step}</li>)}</ol></section><section className="subscription-guide-key"><h2>{c.downloads}</h2><p>{c.downloadText}</p></section>
 <section id="obras-incluidas"><h2>{c.exclusive} <small>({exclusive.length})</small></h2><p>{c.catalogNote}</p>{gallery(exclusive)}<h2>{c.included} <small>({shared.length})</small></h2>{gallery(shared)}</section>
 <section id="licenca-comercial"><h2>{c.commercial}</h2><p>{c.commercialText}</p><h3>{c.purchase}</h3><p>{c.purchaseText}</p><h3>{c.exceptions}</h3><p>{c.exceptionsText}</p><h3>{c.digital}</h3><p>{c.digitalText}</p></section>
 <section><h2>{c.renew}</h2><p>{c.renewText}</p><h3>{c.expires}</h3><p>{c.expiresText}</p></section><section><h2>{c.group}</h2><p>{c.groupText}</p><Link className="text-link" href={`/${lang}/clube`}>{ui.home}</Link></section><section><h2>{c.paidNotActive}</h2><p>{c.paidNotActiveText}</p><Link className="button primary" href={`/${lang}/clube#assinatura`}>{ui.manage}</Link></section></main><Footer lang={lang}/></>;
}
