import {dictionaries} from '../../../lib/i18n';
import Club from '../../../components/Club';
export const dynamic='force-dynamic';
export default async function Page({params}){const {lang}=await params;return <Club lang={lang}/>;}

export async function generateMetadata({params}){const {lang}=await params;return {title:dictionaries[lang]?.clubArea,robots:{index:false,follow:true}};}
