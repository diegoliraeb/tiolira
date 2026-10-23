import {notFound} from 'next/navigation';
import Studio from '../../components/Studio';
import StructuredData from '../../components/StructuredData';
import {readPublicCatalog} from '../../lib/catalog';
import {seoCopy,homeMetadata,homeSchema} from '../../lib/seo.mjs';
export const dynamic='force-dynamic';
export async function generateMetadata({params}){const {lang}=await params;if(!seoCopy[lang])notFound();return homeMetadata(lang);}
export default async function Page({params}){const {lang}=await params;if(!seoCopy[lang])notFound();return <><StructuredData data={homeSchema(lang)}/><Studio lang={lang} catalog={await readPublicCatalog()}/></>}
