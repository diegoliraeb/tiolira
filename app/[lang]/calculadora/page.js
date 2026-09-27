import Calculator from '../../../components/Calculator';
export default async function Page({params}){const {lang}=await params;return <Calculator lang={lang}/>}
