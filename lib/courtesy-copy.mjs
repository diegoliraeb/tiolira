const copies={
 pt:{badge:'Sem custo para você',title:'Coleção liberada para você',description:'O Tio Lira liberou esta coleção sem custo para a sua conta. Baixe as peças e suas licenças de venda.',license:'Licença ativa · liberação gratuita do Tio Lira'},
 en:{badge:'Free for you',title:'This collection is unlocked for you',description:'Tio Lira has granted your account free access to this collection. Download the models and your commercial licenses.',license:'Active license · complimentary access from Tio Lira'},
 es:{badge:'Sin costo para ti',title:'Colección habilitada para ti',description:'Tio Lira te ha concedido acceso gratuito a esta colección. Descarga las piezas y tus licencias comerciales.',license:'Licencia activa · acceso gratuito de Tio Lira'},
 fr:{badge:'Gratuit pour vous',title:'Cette collection est disponible pour vous',description:'Tio Lira vous offre l’accès à cette collection. Téléchargez les modèles et vos licences commerciales.',license:'Licence active · accès offert par Tio Lira'}
};
export const courtesyCopy=lang=>copies[lang]||copies.pt;
