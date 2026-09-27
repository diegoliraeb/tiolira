import Studio from '../../components/Studio';
import {readPublicCatalog} from '../../lib/catalog';
import {localized} from '../../lib/i18n';
export const dynamic='force-dynamic';
export async function generateMetadata({params}){const {lang}=await params;const data=await readPublicCatalog();const s=localized(data.settings,lang);return {title:s.heroTitle,description:s.heroDescription};}
export default async function Page({params}){const {lang}=await params;return <Studio lang={lang} catalog={await readPublicCatalog()}/>}
