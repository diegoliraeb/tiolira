const copies={
 pt:{title:'Perfis de impressão',included:'Todos os perfis desta obra estão incluídos na mesma compra e licença.',choose:'Escolha a configuração que deseja imprimir.',layer:'Camada',download:'Baixar perfil',original:'Perfil original',access:'Acesse os perfis na Área do Parceiro.'},
 en:{title:'Print profiles',included:'All profiles for this model are included in the same purchase and license.',choose:'Choose the configuration you want to print.',layer:'Layer',download:'Download profile',original:'Original profile',access:'Access profiles in the Partner area.'},
 es:{title:'Perfiles de impresión',included:'Todos los perfiles de esta obra están incluidos en la misma compra y licencia.',choose:'Elige la configuración que deseas imprimir.',layer:'Capa',download:'Descargar perfil',original:'Perfil original',access:'Accede a los perfiles en el Área del socio.'},
 fr:{title:'Profils d’impression',included:'Tous les profils de ce modèle sont inclus dans le même achat et la même licence.',choose:'Choisissez la configuration à imprimer.',layer:'Couche',download:'Télécharger le profil',original:'Profil original',access:'Accédez aux profils dans l’espace partenaire.'}
};
export const printProfileCopy=lang=>copies[lang]||copies.pt;
