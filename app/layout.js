import Script from 'next/script';
import '../public/styles.css';
import './site.css';
export const metadata={title:{default:'Tio Lira — Ideias que ganham forma',template:'%s · Tio Lira'},description:'Presépio gratuito, coleções autorais para impressão 3D e uma rede de quem imprime. Free nativity and original 3D models.',icons:{icon:'/assets/tl-monogram-3d-icon.png'}};
export default async function Layout({children,params}){
  const {lang}=await params;
  return (
    <html lang={lang==='en'?'en':lang==='es'?'es':'pt-BR'}>
      <body>
        {children}
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-QYWJ8F1HT9"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-QYWJ8F1HT9');
          `}
        </Script>
      </body>
    </html>
  );
}
