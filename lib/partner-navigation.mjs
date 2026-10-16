// Payment links must open the existing checkout, even without a hash.
export function partnerRoute(hash='',search=''){
 const value=hash.replace(/^#/,'');
 if(value.startsWith('recuperar='))return {section:'compras',collection:'all'};
 if(!value&&new URLSearchParams(search).has('pedido'))return {section:'compras',collection:'all'};
 if(['inicio','colecoes','cadastro','cupons','licencas','compras','contato','calculadora','fichas'].includes(value))return {section:value,collection:'all'};
 if(value.startsWith('colecao='))try{return {section:'colecoes',collection:decodeURIComponent(value.slice(8))};}catch{}
 return {section:'inicio',collection:'all'};
}
