// Only coarse source labels are sent. Never transmit referrer URLs, query strings or reset tokens.
export function trafficSource(referrer='',utm='',ownHost=''){
 const source=String(utm).toLowerCase();let host='';try{host=new URL(referrer).hostname.toLowerCase();}catch{}
 if(host&&host===ownHost||host==='www.tiolira.com.br'||host==='tiolira.com.br')return 'internal';
 for(const [label,pattern] of [['instagram',/instagram/],['facebook',/facebook|fb\.|^fb$|^meta$/],['google',/google/],['youtube',/youtube|youtu\.be/],['pinterest',/pinterest/],['tiktok',/tiktok/],['whatsapp',/whatsapp|wa\.me/],['bing',/bing/]])if(pattern.test(source)||pattern.test(host))return label;
 return host?'other':'direct';
}
export function activityPage(path){
 if(typeof path!=='string'||path.length>240)return null;
 const match=/^\/(pt|en|es|fr)(?:\/(clube|calculadora)|\/produto\/([a-z0-9-]+))?\/?$/.exec(path);
 return match?{lang:match[1],kind:match[3]?'product':match[2]||'home',slug:match[3]||null,path:path.replace(/\/$/,'')}:null;
}
export const sourceLabels={direct:'Direto / não informado',instagram:'Instagram',facebook:'Facebook',google:'Google',youtube:'YouTube',pinterest:'Pinterest',tiktok:'TikTok',whatsapp:'WhatsApp',bing:'Bing',other:'Outros sites',internal:'Navegação interna'};
