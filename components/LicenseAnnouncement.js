'use client';
import {useState} from 'react';
import {licenseAnnouncementText,canAdvertiseLicense} from '../lib/license-announcement.mjs';

const translations={
 pt:{title:'Vai vender as peças impressas?',notice:'Inclua o código da sua licença comercial na descrição dos anúncios em marketplaces, lojas e redes sociais. Isso também vale para as peças Tio Lira do MakerWorld que exigem licença comercial: baixar gratuitamente não autoriza a venda das impressões. O código ajuda a identificar os parceiros licenciados no sistema de rastreabilidade. Use uma licença válida para a obra anunciada; não publique dados pessoais nem o PDF completo.',copy:'Copiar texto para anúncio',annual:'Copiar texto da licença anual',loading:'Preparando texto…',copied:'Texto copiado!',manual:'Não foi possível copiar automaticamente. Selecione e copie o texto abaixo.',error:'Não foi possível obter a licença. Tente novamente.'},
 en:{title:'Selling your printed pieces?',notice:'Include your commercial license code in marketplace listings, shops and social media ads. This also applies to Tio Lira models on MakerWorld that require a commercial license: a free download does not authorize selling prints. The code helps identify licensed partners in our traceability system. Use a valid license covering the advertised model; do not publish personal details or the full PDF.',copy:'Copy listing text',annual:'Copy annual license text',loading:'Preparing text…',copied:'Text copied!',manual:'Automatic copying failed. Select and copy the text below.',error:'Could not retrieve the license. Please try again.'},
 es:{title:'¿Vas a vender las piezas impresas?',notice:'Incluye el código de tu licencia comercial en los anuncios de marketplaces, tiendas y redes sociales. También se aplica a las piezas Tio Lira de MakerWorld que requieren licencia comercial: la descarga gratuita no autoriza la venta de impresiones. El código permite identificar a los socios licenciados en el sistema de trazabilidad. Usa una licencia vigente para la obra anunciada; no publiques datos personales ni el PDF completo.',copy:'Copiar texto para anuncio',annual:'Copiar texto de licencia anual',loading:'Preparando texto…',copied:'¡Texto copiado!',manual:'No se pudo copiar automáticamente. Selecciona y copia el texto de abajo.',error:'No se pudo obtener la licencia. Inténtalo de nuevo.'},
 fr:{title:'Vous vendez vos pièces imprimées ?',notice:'Indiquez le code de votre licence commerciale dans vos annonces sur les marketplaces, boutiques et réseaux sociaux. Cela concerne aussi les modèles Tio Lira sur MakerWorld nécessitant une licence commerciale : un téléchargement gratuit ne permet pas de vendre les impressions. Ce code identifie les partenaires licenciés dans le système de traçabilité. Utilisez une licence valide couvrant le modèle annoncé ; ne publiez ni données personnelles ni le PDF complet.',copy:'Copier le texte de l’annonce',annual:'Copier le texte de la licence annuelle',loading:'Préparation…',copied:'Texte copié !',manual:'La copie automatique a échoué. Sélectionnez et copiez le texte ci-dessous.',error:'Impossible de récupérer la licence. Réessayez.'}
};
export function LicenseAnnouncementNotice({lang='pt'}){const c=translations[lang]||translations.pt;return <aside className="license-announcement-notice"><strong>{c.title}</strong><p>{c.notice}</p></aside>}
export default function LicenseAnnouncement({license,annual=false,lang='pt'}){
 const c=translations[lang]||translations.pt;
 const [text,setText]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 if(!annual&&!canAdvertiseLicense(license))return null;
 async function copy(){
  setBusy(true);setMessage('');
  try{
   let current=license;
   if(annual){const response=await fetch('/api/club/maker-subscription/license?format=json',{cache:'no-store'});const result=await response.json();if(!response.ok)throw Error(c.error);current=result.license;}
   if(!canAdvertiseLicense(current))throw Error(c.error);
   const value=licenseAnnouncementText(current);setText(value);
   try{await navigator.clipboard.writeText(value);setMessage(c.copied)}catch{setMessage(c.manual)}
  }catch{setMessage(c.error)}finally{setBusy(false)}
 }
 return <div className="license-announcement-copy"><button type="button" className="button outline" disabled={busy} onClick={copy}>{busy?c.loading:annual?c.annual:c.copy}</button>{text&&<code tabIndex={0}>{text}</code>}{message&&<p role="status">{message}</p>}</div>;
}
