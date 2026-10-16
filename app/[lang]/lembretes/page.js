import CartReminderPreferences from '../../../components/CartReminderPreferences';
export const metadata={title:'Lembretes de carrinho',robots:{index:false,follow:false}};
export default async function Page({params}){const {lang}=await params;return <CartReminderPreferences lang={lang}/>;}
