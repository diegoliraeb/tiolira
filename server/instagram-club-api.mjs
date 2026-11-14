import {instagramPostUrl} from './instagram-promotion-rules.mjs';
import {CLUB_ACCOUNT} from './instagram-club.mjs';
export function instagramClubApi({fetcher=fetch,env=process.env}={}){
 const token=()=>env.META_TIOLIRA_ACCESS_TOKEN;
 async function request(path,options={}){
  if(!token())throw Object.assign(Error('Conexão de @tiolira indisponível.'),{status:503});
  const response=await fetcher(`https://graph.facebook.com/v27.0/${path}`,{...options,headers:{Authorization:`Bearer ${token()}`,'Content-Type':'application/json'},cache:'no-store',signal:AbortSignal.timeout(8000)});
  const result=await response.json();if(!response.ok||result.error)throw Object.assign(Error('A Meta não confirmou a operação. Confira a conexão de @tiolira.'),{status:503});return result;
 }
 return {ready:()=>Boolean(token()),async resolvePost(accountId,link){
   if(accountId!==CLUB_ACCOUNT)throw Error('Perfil inválido.');
   const shortcode=instagramPostUrl(link)?.split('/')[4];
   let after='';
   for(let page=0;page<5;page++){
    const data=await request(`${CLUB_ACCOUNT}/media?fields=id,permalink&limit=100${after?'&after='+encodeURIComponent(after):''}`);
    const media=data.data?.find(m=>shortcode&&instagramPostUrl(m.permalink)?.split('/')[4]===shortcode);
    if(media)return String(media.id);
    after=data.paging?.cursors?.after;if(!data.paging?.next||!after)break;
   }
   throw Object.assign(Error('Não encontrei esse Reels entre as publicações de @tiolira. Confira o link.'),{status:400});
  },
  readComment:commentId=>request(`${commentId}?fields=id,text,from,timestamp,hidden`),
  async sendPrivateReply(commentId,text){const result=await request(`${CLUB_ACCOUNT}/messages`,{method:'POST',body:JSON.stringify({recipient:{comment_id:commentId},message:{text}})});if(!result.message_id)throw Error('Envio não confirmado.');return {messageId:String(result.message_id)};}
 };
}
