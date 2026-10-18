const labels={
 pt:{partner:'Gratuita',site:'Gratuita na Área do Parceiro',maker:'Gratuita no MakerWorld'},
 en:{partner:'Free',site:'Free in the Partner Area',maker:'Free on MakerWorld'},
 es:{partner:'Gratuita',site:'Gratuita en el Área del Socio',maker:'Gratuita en MakerWorld'},
 fr:{partner:'Gratuite',site:'Gratuite dans l’espace partenaire',maker:'Gratuite sur MakerWorld'}
};
export function freeArtworkLabel(product,lang='pt',partner=false){
 if(!product||product.published===false||product.exclusive||Number(product.priceCents||0)>0||!['site','maker'].includes(product.access))return '';
 const available=product.access==='maker'?Boolean(product.url||product.downloadUrl):Boolean(product.hasFile||product.filePath||product.printProfiles?.length||product.downloadUrl||product.url);
 if(!available)return '';
 const copy=labels[lang]||labels.pt;
 return copy[partner?'partner':product.access];
}
