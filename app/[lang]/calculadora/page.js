import {dictionaries} from '../../../lib/i18n';
import Calculator from '../../../components/Calculator';
export default async function Page({params}){const {lang}=await params;return <Calculator lang={lang}/>}

export async function generateMetadata({params}){const {lang}=await params;return {title:dictionaries[lang]?.calculator};}
