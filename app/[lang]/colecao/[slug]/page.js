import PublicFamilyPromotion from '../../../../components/PublicFamilyPromotion';
import {FAMILY_COLLECTION_ID} from '../../../../lib/family-discount.mjs';
import {notFound} from 'next/navigation';
import Link from 'next/link';
import Header from '../../../../components/Header';
import Footer from '../../../../components/Footer';
import StructuredData from '../../../../components/StructuredData';
import CatalogProductGrid from '../../../../components/CatalogProductGrid';
import {readPublicCatalog} from '../../../../lib/catalog';
import {localized,dictionaries} from '../../../../lib/i18n';
import {collectionCover} from '../../../../lib/collection-covers.mjs';
import {seoCopy,collectionSlug,collectionPath,collectionMetadata,collectionSchema,breadcrumbs} from '../../../../lib/seo.mjs';
export const dynamic='force-dynamic';
async function content(params){const {lang,slug}=await params;if(!seoCopy[lang])notFound();const catalog=await readPublicCatalog(),raw=catalog.collections.find(c=>collectionSlug(c)===slug);if(!raw)notFound();return {lang,raw,products:catalog.products.filter(p=>p.collection===raw.id)};}
export async function generateMetadata({params}){const {lang,raw,products}=await content(params);return collectionMetadata(raw,lang,products.length);}
export default async function Page({params}){
 const {lang,raw,products}=await content(params),c=localized(raw,lang),copy=seoCopy[lang],t=dictionaries[lang],metadata=collectionMetadata(raw,lang,products.length);
 const crumbs=[{name:copy.home,path:`/${lang}`},{name:copy.collections,path:`/${lang}/colecoes`},{name:c.name,path:collectionPath(lang,raw)}];
 return <><StructuredData data={collectionSchema(raw,products,lang)}/><StructuredData data={breadcrumbs(crumbs)}/><Header lang={lang}/><main className="wrap section seo-collection"><nav className="seo-breadcrumb" aria-label="Breadcrumb">{crumbs.map((item,i)=><span key={item.path}>{i>0&&' / '}{i===crumbs.length-1?item.name:<Link href={item.path}>{item.name}</Link>}</span>)}</nav><section className="seo-collection-hero"><div><p className="eyebrow">TIO LIRA · {t.collections}</p><h1>{metadata.title}</h1><p>{c.description}</p><p className="seo-digital-note">{copy.collectionNote}</p><Link className="button primary" href={`/${lang}/clube#colecao=${encodeURIComponent(c.id)}`}>{t.clubArea} ↗</Link></div><img src={collectionCover(raw)} alt={c.name} width="600" height="600" fetchPriority="high"/></section>{raw.id===FAMILY_COLLECTION_ID&&<PublicFamilyPromotion lang={lang}/>}<p className="seo-catalog-count">{products.length} {t.results}</p><CatalogProductGrid lang={lang} products={products}/>{!products.length&&<p className="notice">{t.notReleased}</p>}<p className="seo-collection-back"><Link className="text-link" href={`/${lang}/colecoes`}>{copy.allCollections} →</Link></p></main><Footer lang={lang}/></>;
}
