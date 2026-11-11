import {instagramDirectApi} from './instagram-direct-api.mjs';
import {PROMOTION_ACCOUNTS, PROMOTION_VERIFICATION_ACCOUNT, instagramHandle, instagramPostUrl, validPromotionComment} from './instagram-promotion-rules.mjs';

const fail = (message, status = 503) => {throw Object.assign(Error(message), {status});};
export function instagramPromotionApi({fetcher = fetch, env = process.env} = {}) {
  async function graph(accountId, path, fields, after) {
    const account = PROMOTION_ACCOUNTS.find(a => a.id === accountId), token = account && env[account.env];
    if (!token) fail('A conexão com o Instagram está temporariamente indisponível.');
    const url = new URL(`https://graph.facebook.com/v27.0/${path}`);
    url.searchParams.set('fields', fields);
    if (path.includes('/')) url.searchParams.set('limit', '100');
    if (after) url.searchParams.set('after', after);
    const response = await fetcher(url, {headers: {Authorization: `Bearer ${token}`}, cache: 'no-store', signal: AbortSignal.timeout(8000)});
    const data = await response.json();
    if (!response.ok || data.error) fail('Não foi possível confirmar os dados no Instagram agora. Tente novamente em instantes.');
    return data;
  }
  return {
    ...instagramDirectApi({fetcher,env}),
    ready: () => Boolean(env[PROMOTION_VERIFICATION_ACCOUNT.env]),
    async findLinkComment(config, username) {
      let after;
      for(let page=0;page<5;page++){
        const data=await graph(config.accountId,`${config.mediaId}/comments`,'id,text,from,timestamp,hidden',after);
        const comment=data.data?.find(c=>/^\d{1,30}$/.test(String(c.from?.id||'')) && instagramHandle(c.from?.username)===username && validPromotionComment(c,{username,accounts:{[config.accountId]:{senderId:String(c.from.id)}}},config));
        if(comment)return comment;
        after=data.paging?.cursors?.after;
        if(!data.paging?.next || !after)return null;
      }
      fail('Não consegui localizar seu comentário agora. Tente novamente em instantes.',409);
    },
    async sendPrivateReply(commentId, text) {
      if(!/^\d{1,30}$/.test(String(commentId)))fail('Comentário inválido.',400);
      const account=PROMOTION_VERIFICATION_ACCOUNT,token=env[account.env];
      if(!token)fail('Conexão indisponível.');
      const response=await fetcher(`https://graph.facebook.com/v27.0/${account.id}/messages`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({recipient:{comment_id:String(commentId)},message:{text}}),signal:AbortSignal.timeout(8000)});
      const result=await response.json();
      if(!response.ok || result.error || !result.message_id)fail('Não foi possível enviar a confirmação pelo Direct.');
      return {messageId:String(result.message_id)};
    },
    async resolvePost(accountId, link) {
      let after;
      for (let page = 0; page < 5; page++) {
        const data = await graph(accountId, `${accountId}/media`, 'id,permalink', after);
        const media = data.data?.find(m => instagramPostUrl(m.permalink) === link);
        if (media) return String(media.id);
        after = data.paging?.cursors?.after;
        if (!data.paging?.next || !after) break;
      }
      fail('Não encontrei esse post entre as publicações recentes do perfil escolhido. Confira o link e o perfil.', 400);
    },
    async findComment(config, binding, cachedIds = []) {
      const fields = 'id,text,from,timestamp,hidden';
      // A fresh read also rejects a cached comment that was deleted, edited or hidden.
      for (const id of cachedIds.slice(-3).reverse()) {
        try {const comment = await graph(config.accountId, id, fields); if (validPromotionComment(comment, binding, config)) return comment;}
        catch { /* Fall back to the media edge; never grant from cached text. */ }
      }
      let after;
      for (let page = 0; page < 5; page++) {
        const data = await graph(config.accountId, `${config.mediaId}/comments`, fields, after);
        const comment = data.data?.find(c => validPromotionComment(c, binding, config));
        if (comment) return comment;
        after = data.paging?.cursors?.after;
        if (!data.paging?.next || !after) return null;
      }
      fail('Seu comentário ainda não foi localizado. Aguarde a atualização e tente novamente.', 409);
    },
  };
}
