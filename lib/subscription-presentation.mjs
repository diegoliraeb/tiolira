// Public marketing copy keeps the personal-use restriction without naming a tribute.
// Entitlement rules and issued license terms remain unchanged.
const personal={pt:'Obras destinadas exclusivamente ao uso pessoal não permitem a venda das impressões.',en:'Personal-use-only designs do not allow sales of physical prints.',es:'Las obras destinadas exclusivamente al uso personal no permiten vender las impresiones.',fr:'Les créations réservées à un usage personnel ne permettent pas la vente des impressions.'};
export function subscriptionPresentation(text,lang='pt'){
 return String(text).replace(/[^.!?]*\bSenna\b[^.!?]*[.!?]?/g,match=>(match.startsWith(' ')?' ':'')+(personal[lang]||personal.pt));
}
