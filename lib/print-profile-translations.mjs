import templates from '../data/print-profile-translations.json' with {type:'json'};

// Exact editorial templates only: arbitrary new admin text is never partially
// translated. Numeric values always come from the current profile, not a copy.
const numbers=/\d+(?:[,.]\d+)?/g;
const names=[
 ['Perfil original','Original profile','Perfil original','Profil original'],
 ['Acabamento fino · # mm','Fine finish · # mm','Acabado fino · # mm','Finition fine · # mm'],
 ['Econômico · # mm','Economy · # mm','Económico · # mm','Économique · # mm'],
 ['Mais detalhes — # mm','More detail — # mm','Más detalle — # mm','Plus de détails — # mm'],
 ['Mais rápido — # mm','Faster — # mm','Más rápido — # mm','Plus rapide — # mm'],
 ['Projeto completo v# · # mm','Complete project v# · # mm','Proyecto completo v# · # mm','Projet complet v# · # mm'],
 ['Revisão # — mangas corrigidas','Revision # — corrected sleeves','Revisión # — mangas corregidas','Révision # — manches corrigées'],
 ['Agro Noel v# · Bambu Lab A#','Agro Santa v# · Bambu Lab A#','Agro Papá Noel v# · Bambu Lab A#','Père Noël des Champs v# · Bambu Lab A#'],
 ['Projeto completo v# · A# · # mm','Complete project v# · A# · # mm','Proyecto completo v# · A# · # mm','Projet complet v# · A# · # mm']
].map(([pt,en,es,fr])=>({pt,en,es,fr}));
const translations=new Map([...templates,...names].map(row=>[row.pt,row]));
export function translatePrintProfileText(value,lang){
 if(!value||!['en','es','fr'].includes(lang)||value.includes('#'))return value;
 const template=value.replace(numbers,'#'),translated=translations.get(template)?.[lang];
 if(!translated)return value;
 const values=value.match(numbers)||[];
 if((translated.match(/#/g)||[]).length!==values.length)return value;
 let index=0;
 return translated.replace(/#/g,()=>{const n=values[index++];return lang==='en'?n.replace(',','.'):n;});
}
export function localizePrintProfile(profile,lang){
 return {...profile,name:translatePrintProfileText(profile.name,lang),notes:translatePrintProfileText(profile.notes,lang)};
}
