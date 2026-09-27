import {isAvailable} from '../../../../lib/product-order.mjs';
import {notFound} from 'next/navigation';
import Link from 'next/link';
import Header from '../../../../components/Header';
import Footer from '../../../../components/Footer';
import Gallery from '../../../../components/Gallery';
import {readPublicCatalog} from '../../../../lib/catalog';
import {dictionaries,localized} from '../../../../lib/i18n';
export const dynamic='force-dynamic';
export async function generateMetadata({params}){const {lang,slug}=await params;const c=await readPublicCatalog();const p=c.products.find(p=>p.slug===slug);return p?{title:localized(p,lang).name,description:localized(p,lang).description.slice(0,160)}:{};}
export default async function Page({params}){const {lang,slug}=await params,t=dictionaries[lang],c=await readPublicCatalog(),raw=c.products.find(p=>p.slug===slug);if(!raw)notFound();const p=localized(raw,lang);const url=isAvailable(p)?(p.access==='site'&&p.hasFile?`/api/download?id=${p.id}`:p.url):'';return <><Header lang={lang}/><main className="wrap section"><Link className="text-link" href={`/${lang}#obras`}>← {t.back}</Link><div className="product-page"><Gallery images={[p.image,...p.gallery]} name={p.name} lang={lang}/><div className="product-copy"><p className="eyebrow">{localized(c.collections.find(x=>x.id===p.collection)||{},lang).name}</p><h1>{p.name}</h1><span className={`badge inline-badge ${!isAvailable(p)?'coming':''}`}>{!isAvailable(p)?t.soon:t[p.access==='site'?'free':p.access]}</span>{p.size&&<p>{t.size}: <strong>{p.size}</strong></p>}{url?<a className="button primary" href={url} target="_blank" rel="noreferrer">{p.access==='maker'?t.makerDownload:p.access==='site'&&!p.hasFile?t.originalPage:t.download} ↗</a>:<p className="notice">{t.notReleased}</p>}<div className="notice"><strong>{t.license}</strong><p>{p.collection==='presepio'?t.physicalLicense:t.otherLicense}</p></div><h3>{t.instructions}</h3><div className="long-description">{p.description.split('\n\n').map((text,i)=><p key={i}>{text}</p>)}</div></div></div></main><Footer lang={lang}/></>}
