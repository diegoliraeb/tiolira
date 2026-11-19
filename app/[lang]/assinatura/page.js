import {annualAsaasTerms} from '../../../lib/maker-annual-copy.mjs';
import {subscriberCopy,isSubscriptionProduct} from '../../../lib/subscriber-access.mjs';
import Link from 'next/link';
import {notFound} from 'next/navigation';
import Header from '../../../components/Header';
import Footer from '../../../components/Footer';
import CatalogProductGrid from '../../../components/CatalogProductGrid';
import {readPublicCatalog} from '../../../lib/catalog';
import {localized} from '../../../lib/i18n';
import {pageMetadata,productPath} from '../../../lib/seo.mjs';
import {commercialPolicy,MAKER_PRICE,makerTerms} from '../../../lib/maker-license.mjs';
import {subscriptionPageCopy} from '../../../lib/subscription-page.mjs';
export const dynamic='force-dynamic';
export async function generateMetadata({params}){const {lang}=await params,c=subscriptionPageCopy[lang];if(!c)notFound();return pageMetadata({lang,path:'/assinatura',title:c.nav+' · MakerWorld',description:c.description});}
export default async function Page({params}){
 const {lang}=await params,c=subscriptionPageCopy[lang];if(!c)notFound();
 const catalog=await readPublicCatalog(),allAnnual=catalog.products.filter(p=>p.published!==false&&commercialPolicy(p,catalog.collections)==='annual'),products=allAnnual.filter(p=>p.access==='maker'),exclusives=allAnnual.filter(isSubscriptionProduct),price=new Intl.NumberFormat(lang==='pt'?'pt-BR':lang,{style:'currency',currency:'BRL'}).format(MAKER_PRICE/100),subscribe=`/${lang}/clube#assinatura`;
 return <><Header lang={lang}/><main className="subscription-public wrap">
 <section className="subscription-hero"><div><p className="eyebrow">{c.eyebrow}</p><h1>{c.title}</h1><p className="subscription-lead">{c.subtitle}</p><div className="subscription-price"><strong>{price}</strong><span>{c.period}</span></div><div className="subscription-actions"><Link className="button primary" href={subscribe}>{c.cta} ↗</Link><a href="#incluidas" className="text-link">{c.browse} ↓</a></div><p className="subscription-payment">{c.payment}</p></div><div className="subscription-art"><img className="subscription-mark" src="/assets/tl-monogram-3d.webp" alt="Tio Lira" width="80" height="80"/><div className="subscription-preview">{products.slice(0,3).map(p=><Link href={productPath(lang,p)} key={p.id}><img src={p.image} alt={localized(p,lang).name} width="400" height="500"/></Link>)}</div><span>TIO LIRA · MAKERWORLD</span></div></section>
 <section className="subscription-section"><h2>{c.stepsTitle}</h2><ol className="subscription-steps">{c.steps.map(([title,text],i)=><li key={title}><span className="subscription-number">0{i+1}</span><h3>{title}</h3><p>{text}</p></li>)}</ol></section>
 <section className="subscription-section"><h2>{c.scopeTitle}</h2><div className="subscription-scope">{c.scope.map(([title,text])=><article key={title}><h3>{title}</h3><p>{text}</p></article>)}</div></section>
 <section className="subscription-section" id="incluidas"><h2>{c.catalogTitle} <small>({products.length})</small></h2><p>{c.catalogIntro}</p>{products.length?<CatalogProductGrid products={products} lang={lang}/>:<p>{c.empty}</p>}</section>
 <section className="subscription-section" id="exclusivas"><h2>{subscriberCopy[lang].title} <small>({exclusives.length})</small></h2><p>{subscriberCopy[lang].description}</p>{exclusives.length?<CatalogProductGrid products={exclusives} lang={lang}/>:<p>{subscriberCopy[lang].empty}</p>}</section><section className="subscription-section subscription-faq"><h2>{c.faqTitle}</h2>{c.faq.map(([q,a])=><details key={q}><summary>{q}</summary><p>{a}</p></details>)}<details><summary>{c.terms}</summary><h3>Brasil · Asaas</h3><p>{annualAsaasTerms[lang]}</p><h3>PayPal</h3><p>{makerTerms[lang]}</p></details></section>
 <section className="subscription-closing"><h2>{c.finalTitle}</h2><p>{price} · {c.period}</p><Link className="button primary" href={subscribe}>{c.cta} ↗</Link><Link className="text-link" href={subscribe}>{c.account}</Link></section>
 </main><Footer lang={lang}/></>;
}
