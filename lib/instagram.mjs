// Accept a handle or a direct profile link, and only emit canonical Instagram URLs.
export function instagramUrl(input){
 if(typeof input!=='string'||!input.trim())return '';
 let value=input.trim(),handle;
 if(value.startsWith('@'))handle=value.slice(1);
 else if(/^[a-z0-9._]{1,30}$/i.test(value)&&!value.includes('instagram.com'))handle=value;
 else{
  if(/^(www\.)?instagram\.com\//i.test(value))value=`https://${value}`;
  try{
   const url=new URL(value);
   if(url.protocol!=='https:'||!['instagram.com','www.instagram.com'].includes(url.hostname)||url.username||url.password||url.port)return '';
   const match=url.pathname.match(/^\/([a-z0-9._]{1,30})\/?$/i);if(!match)return '';handle=match[1];
  }catch{return '';}
 }
 if(!/^[a-z0-9_][a-z0-9._]{0,29}$/i.test(handle)||['p','reel','reels','stories','explore','accounts','direct'].includes(handle.toLowerCase()))return '';
 return `https://www.instagram.com/${handle.toLowerCase()}/`;
}
export function partnerInstagram(profile){
 return instagramUrl(profile.instagram===undefined?profile.website:profile.instagram);
}
