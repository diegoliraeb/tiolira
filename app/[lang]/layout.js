import {notFound} from 'next/navigation';
import {languages} from '../../lib/i18n';
export default async function Layout({children,params}){const {lang}=await params;if(!languages.includes(lang))notFound();return <div lang={lang==='pt'?'pt-BR':lang}>{children}</div>}
