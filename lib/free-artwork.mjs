import {courtesyCopy} from './courtesy-copy.mjs';
const labels={
 pt:{partner:'Gratuita',site:'Gratuita na Área do Parceiro',maker:'MakerWorld'},
 en:{partner:'Free',site:'Free in the Partner Area',maker:'MakerWorld'},
 es:{partner:'Gratuita',site:'Gratuita en el Área del Socio',maker:'MakerWorld'},
 fr:{partner:'Gratuite',site:'Gratuite dans l’espace partenaire',maker:'MakerWorld'}
};
export function freeArtworkLabel(product,lang='pt',partner=false){
 if(product?.access==='maker'&&product.published!==false&&!product.collectionComingSoon&&(product.url||product.downloadUrl))return 'MakerWorld';
 if(partner&&product?.complimentary&&product.published!==false&&!product.exclusive&&product.downloadUrl)return courtesyCopy(lang).badge;
 if(!product||product.published===false||product.exclusive||Number(product.priceCents||0)>0||!['site','maker'].includes(product.access))return '';
 const available=product.access==='maker'?Boolean(product.url||product.downloadUrl):Boolean(product.hasFile||product.filePath||product.printProfiles?.length||product.downloadUrl||product.url);
 if(!available)return '';
 const copy=labels[lang]||labels.pt;
 return copy[partner?'partner':product.access];
}
