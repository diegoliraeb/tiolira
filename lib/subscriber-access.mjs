export function isSubscriptionProduct(product){
 return Boolean(product&&!product.exclusive&&product.id!=='96f7f843-b608-4a57-8f27-6ba12e2862da'&&(product.access==='subscribers'||product.access==='paid'&&product.includedInSubscription===true));
}
export const subscriberCopy={
 pt:{badge:'Incluído na assinatura',title:'Obras incluídas para baixar no site',description:'Assinantes ativos baixam estas obras e seus perfis diretamente no Clube, sem custo adicional, com licença comercial durante a validade da assinatura. A compra avulsa continua disponível e inclui acesso e licença próprios, sem depender da assinatura.',access:'Baixar com minha assinatura',locked:'Assine para baixar sem custo adicional ou compre a obra avulsa com sua própria licença.',browse:'Ver obras incluídas',empty:'Novas peças serão adicionadas aqui. Acompanhe as próximas liberações.'},
 en:{badge:'Included in your subscription',title:'Included designs to download on this website',description:'Active subscribers download these designs and print profiles directly in the Club at no extra cost, with commercial use during the subscription term. Individual purchases remain available with their own access and license, independent of the subscription.',access:'Download with my subscription',locked:'Subscribe to download at no extra cost, or buy the individual design with its own license.',browse:'View included designs',empty:'New designs will be added here. Stay tuned for upcoming releases.'},
 es:{badge:'Incluido en la suscripción',title:'Obras incluidas para descargar en el sitio',description:'Los suscriptores activos descargan estas obras y perfiles directamente en el Club sin coste adicional, con uso comercial durante la suscripción. La compra individual sigue disponible con acceso y licencia propios, independientes de la suscripción.',access:'Descargar con mi suscripción',locked:'Suscríbete para descargar sin coste adicional o compra la obra con su propia licencia.',browse:'Ver obras incluidas',empty:'Pronto añadiremos nuevas obras aquí.'},
 fr:{badge:'Inclus dans l’abonnement',title:'Créations incluses à télécharger sur le site',description:'Les abonnés actifs téléchargent ces créations et profils directement dans le Club sans supplément, avec usage commercial pendant l’abonnement. L’achat à l’unité reste disponible avec son propre accès et sa licence, indépendants de l’abonnement.',access:'Télécharger avec mon abonnement',locked:'Abonnez-vous pour télécharger sans supplément ou achetez la création avec sa propre licence.',browse:'Voir les créations incluses',empty:'De nouvelles créations seront ajoutées ici.'}
};
export function canDownloadProduct(product,{owned=false,annual=false}={}){
 if(product.exclusive)return false;
 if(isSubscriptionProduct(product))return owned||annual;
 if(product.access==='paid'||product.priceCents>0||product.access==='subscribers')return owned;
 return product.access==='site';
}
