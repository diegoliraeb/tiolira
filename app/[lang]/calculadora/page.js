import {seoCopy,pageMetadata} from '../../../lib/seo.mjs';
import {notFound} from 'next/navigation';
import {dictionaries} from '../../../lib/i18n';
import Calculator from '../../../components/Calculator';
export default async function Page({params}){const {lang}=await params;return <Calculator lang={lang}/>}

export async function generateMetadata({params}){const {lang}=await params;if(!seoCopy[lang])notFound();return pageMetadata({lang,path:'/calculadora',title:seoCopy[lang].calculatorTitle,description:seoCopy[lang].calculatorDescription});}
