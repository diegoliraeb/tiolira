export const subscriberCopy={
 pt:{badge:'Exclusiva para assinantes',title:'Peças exclusivas no site',description:'Obras marcadas como exclusivas ficam disponíveis no Clube durante a validade da assinatura anual, com licença para vender as impressões físicas. Compras avulsas anteriores mantêm seu acesso e licença próprios.',access:'Acessar no Clube',locked:'Ative sua assinatura para baixar esta obra e seus perfis de impressão.',browse:'Ver peças exclusivas',empty:'Novas peças serão adicionadas aqui. Acompanhe as próximas liberações.'},
 en:{badge:'Subscriber exclusive',title:'Exclusive website designs',description:'Designs marked as exclusive are available in the Club during your annual subscription, with a license to sell physical prints. Previous individual purchases keep their own access and license.',access:'Access in the Club',locked:'Activate your subscription to download this design and its print profiles.',browse:'View exclusive designs',empty:'New designs will be added here. Stay tuned for upcoming releases.'},
 es:{badge:'Exclusiva para suscriptores',title:'Obras exclusivas en el sitio',description:'Las obras marcadas como exclusivas están disponibles en el Club durante la vigencia de la suscripción anual, con licencia para vender impresiones físicas. Las compras individuales anteriores conservan su acceso y licencia.',access:'Acceder al Club',locked:'Activa tu suscripción para descargar esta obra y sus perfiles de impresión.',browse:'Ver obras exclusivas',empty:'Pronto añadiremos nuevas obras aquí. Sigue los próximos lanzamientos.'},
 fr:{badge:'Exclusivité abonnés',title:'Créations exclusives du site',description:'Les créations marquées exclusives sont disponibles dans le Club pendant la validité de l’abonnement annuel, avec une licence de vente des impressions physiques. Les achats à l’unité antérieurs conservent leur accès et leur licence.',access:'Accéder au Club',locked:'Activez votre abonnement pour télécharger cette création et ses profils d’impression.',browse:'Voir les créations exclusives',empty:'De nouvelles créations seront ajoutées ici. Suivez les prochaines sorties.'}
};
export function canDownloadProduct(product,{owned=false,annual=false}={}){
 if(product.exclusive)return false;
 if(product.access==='subscribers')return owned||annual;
 if(product.access==='paid'||product.priceCents>0)return owned;
 return product.access==='site';
}
