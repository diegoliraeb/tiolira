import '../public/styles.css';
import './site.css';
export const metadata={title:{default:'Tio Lira — Ideias que ganham forma',template:'%s · Tio Lira'},description:'Presépio gratuito, coleções autorais para impressão 3D e uma rede de quem imprime. Free nativity and original 3D models.',icons:{icon:'/assets/tl-monogram.svg'}};
export default async function Layout({children,params}){const {lang}=await params;return <html lang={lang==='en'?'en':lang==='es'?'es':'pt-BR'}><body>{children}</body></html>}
