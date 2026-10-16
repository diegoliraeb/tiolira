import {notFound} from 'next/navigation';
import Link from 'next/link';
import Header from '../../../components/Header';
import Footer from '../../../components/Footer';
import StructuredData from '../../../components/StructuredData';
import {readPublicCatalog} from '../../../lib/catalog';
import {localized} from '../../../lib/i18n';
import {collectionCover} from '../../../lib/collection-covers.mjs';
import {seoCopy,pageMetadata,collectionPath,absoluteUrl,breadcrumbs} from '../../../lib/seo.mjs';
export const dynamic='force-dynamic';
export async function generateMetadata({params}){const {lang}=await params;if(!seoCopy[lang])notFound();return pageMetadata({lang,path:'/colecoes',title:seoCopy[lang].collections,description:seoCopy[lang].collectionIntro});}
export default async function Page({params}){const {lang}=await params;if(!seoCopy[lang])notFound();const copy=seoCopy[lang],catalog=await readPublicCatalog(),collections=catalog.collections.filter(c=>catalog.products.some(p=>p.collection===c.id));const crumbs=[{name:copy.home,path:`/${lang}`},{name:copy.collections,path:`/${lang}/colecoes`}];const list={'@context':'https://schema.org','@type':'ItemList',itemListElement:collections.map((c,i)=>({'@type':'ListItem',position:i+1,name:localized(c,lang).name,url:absoluteUrl(collectionPath(lang,c))}))};return <><StructuredData data={list}/><StructuredData data={breadcrumbs(crumbs)}/><Header lang={lang}/><main className="wrap section seo-collection"><nav className="seo-breadcrumb" aria-label="Breadcrumb"><Link href={`/${lang}`}>{copy.home}</Link> / {copy.collections}</nav><h1>{copy.collections}</h1><p className="seo-directory-intro">{copy.collectionIntro}</p><div className="seo-collection-grid">{collections.map(raw=>{const c=localized(raw,lang);return <article className="product-card" key={c.id}><Link className="product-image" href={collectionPath(lang,raw)}><img src={collectionCover(raw)} alt={c.name} width="600" height="600" loading="lazy"/></Link><div className="product-info"><h2><Link href={collectionPath(lang,raw)}>{c.name}</Link></h2><p>{c.description}</p><Link className="text-link" href={collectionPath(lang,raw)}>{copy.viewCollection} →</Link></div></article>})}</div></main><Footer lang={lang}/></>}
