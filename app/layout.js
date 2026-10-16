import ActivityTracker from '../components/ActivityTracker';
import {headers} from 'next/headers';
import Script from 'next/script';
import '../public/styles.css';
import './site.css';
import './seo.css';
import './feedback.css';
import './analytics.css';
import './movement.css';
import './partner-movement.css';
import './admin-movement.css';
export const metadata={metadataBase:new URL('https://www.tiolira.com.br'),title:{default:'Tio Lira — Ideias que ganham forma',template:'%s · Tio Lira'},description:'Presépio gratuito, coleções autorais para impressão 3D e uma rede de quem imprime. Free nativity and original 3D models.',icons:{icon:'/assets/tl-monogram-3d-icon.png'}};
export default async function Layout({children}){
  const lang=(await headers()).get('x-tiolira-language')||'pt';
  return (
    <html lang={lang==='en'?'en':lang==='es'?'es':lang==='fr'?'fr':'pt-BR'}>
      <body>
        {children}
        <ActivityTracker/>
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-QYWJ8F1HT9"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-QYWJ8F1HT9', {page_location: window.location.origin + window.location.pathname});
          `}
        </Script>
      </body>
    </html>
  );
}
