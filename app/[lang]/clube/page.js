import Club from '../../../components/Club';
export const dynamic='force-dynamic';
export default async function Page({params}){const {lang}=await params;return <Club lang={lang}/>;}
