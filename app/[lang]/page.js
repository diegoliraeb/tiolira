import {notFound} from 'next/navigation';
import Studio from '../../components/Studio';
import StructuredData from '../../components/StructuredData';
import {readPublicCatalog} from '../../lib/catalog';
import {collectionCover} from '../../lib/collection-covers.mjs';
import {seoCopy,pageMetadata,homeSchema} from '../../lib/seo.mjs';
export const dynamic='force-dynamic';
export async function generateMetadata({params}){const {lang}=await params;if(!seoCopy[lang])notFound();const data=await readPublicCatalog(),cover=data.collections.find(c=>c.id==='presepio')||data.collections[0];return pageMetadata({lang,title:seoCopy[lang].homeTitle,description:seoCopy[lang].homeDescription,image:cover?collectionCover(cover):undefined});}
export default async function Page({params}){const {lang}=await params;if(!seoCopy[lang])notFound();return <><StructuredData data={homeSchema(lang)}/><Studio lang={lang} catalog={await readPublicCatalog()}/></>}
