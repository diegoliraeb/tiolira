import {createHash, randomBytes, randomUUID} from 'node:crypto';
import {hasProductFiles} from '../lib/print-profiles.mjs';
import {emailIsVerified, normalizedEmail} from './partner-email-verification.mjs';
import {PROMOTION_KEY, PROMOTION_ID, PROMOTION_ACCOUNTS, PROMOTION_REQUIRED_ACCOUNTS, PROMOTION_VERIFICATION_ACCOUNT, PROMOTION_COLLECTIONS, defaultPromotion, instagramHandle, instagramPostUrl, promotionOpen, promotionLinkEvents, distinctFriendMentions} from './instagram-promotion-rules.mjs';

const digest = value => createHash('sha256').update(value).digest('hex');
const fail = (message, status = 400) => {throw Object.assign(Error(message), {status});};
const state = old => old || {config: defaultPromotion(), challenges: {}, bindings: {}, identityOwners: {}, claims: [], comments: {}};
const identityKeys = binding => PROMOTION_ACCOUNTS.filter(a => binding.accounts[a.id]?.senderId).map(a => `${a.id}:${binding.accounts[a.id].senderId}`);
const publicClaim = claim => claim ? {id: claim.id, code: claim.code, username: claim.username, issuedAt: claim.issuedAt, expiresAt: claim.expiresAt} : null;
const privateClaim = (s, member) => s.claims.find(c => c.memberId === member.id);
const assertOpen = (s, now) => {if (!promotionOpen(s.config, now)) fail('A promoção ainda não está disponível ou já encerrou.', 409);};
const assertEmail = member => {if (!emailIsVerified(member)) fail('Confirme seu e-mail antes de participar.', 403);};

export function createInstagramPromotion({readRecord, updateRecord, getMember, getCatalog, readProfile, api, redeemOrder, now = Date.now}) {
  const read = async () => state((await readRecord(PROMOTION_KEY))?.data);
  async function currentMember(member) {
    const fresh = await getMember(member.id);
    if (!fresh || fresh.version !== member.version || normalizedEmail(fresh.email) !== normalizedEmail(member.email)) fail('Entre novamente na sua conta.', 401);
    return fresh;
  }
  async function status(member) {
    member = await currentMember(member);
    const s = await read(), binding = s.bindings[member.id], pending = Object.values(s.challenges).find(c => c.memberId === member.id && c.expiresAt > now());
    const claim = privateClaim(s, member), commerce = claim ? (await readRecord('commerce.json'))?.data : null;
    const order = commerce?.orders?.find(o => o.instagramPromotion?.claimId === claim?.id && o.memberId === member.id);
    const {data} = await getCatalog();
    const products = claim && !order ? data.products.filter(p => PROMOTION_COLLECTIONS.includes(p.collection) && p.published && !p.exclusive && p.access === 'paid' &&
      data.collections.some(c => c.id === p.collection && c.published && !c.comingSoon) &&
      hasProductFiles(p)).map(p => ({id: p.id, name: p.name, image: p.image, collection: p.collection})) : [];
    return {
      campaign: {...s.config, collectionIds: PROMOTION_COLLECTIONS, open: promotionOpen(s.config, now())},
      email: member.email, emailVerified: emailIsVerified(member),
      instagram: binding ? {username: binding.username, verifiedAt: binding.verifiedAt} : null,
      pending: pending ? {username: pending.username, expiresAt: new Date(pending.expiresAt).toISOString(), delivery: pending.delivery || 'manual', received: PROMOTION_REQUIRED_ACCOUNTS.filter(a => pending.accounts[a.id]).map(a => a.username), error: pending.error || null} : null,
      coupon: publicClaim(claim), products,
      redemption: order ? {orderId: order.id, productId: order.productIds?.[0], productName: order.items?.[0]?.name, status: order.status} : null,
      accounts: PROMOTION_REQUIRED_ACCOUNTS.map(({id, username}) => ({id, username})),
    };
  }
  return {
    status,
    async publicCampaign() {
      const {config} = await read();
      return {active:config.active, open:promotionOpen(config, now()), startsAt:config.startsAt, endsAt:config.endsAt, postUrl:config.postUrl};
    },
    async check(member) {
      member = await currentMember(member);
      const s = await read(), binding = s.bindings[member.id];
      const checks = {email:emailIsVerified(member), instagram:Boolean(binding), follows:PROMOTION_REQUIRED_ACCOUNTS.map(a => ({username:a.username, status:'pending'})), comment:'pending', checkedAt:new Date(now()).toISOString()};
      if (!checks.email || !binding) return {checks};
      const profiles = await Promise.allSettled(PROMOTION_REQUIRED_ACCOUNTS.map(a => readProfile(a.id, binding.accounts[a.id].senderId)));
      for (let i=0;i<profiles.length;i++) {
        const result=profiles[i], p=result.status==='fulfilled'?result.value:null;
        checks.follows[i].status=!p || p.errorCode || !p.username || p.follows == null ? 'unavailable' : instagramHandle(p.username)!==binding.username ? 'relink' : p.follows===true ? 'complete' : 'missing';
      }
      if (s.config.mediaId && s.config.postUrl) {
        try {
          const cached=s.comments[`${s.config.mediaId}:${binding.accounts[s.config.accountId].senderId}`] || [];
          checks.comment=await api.findComment(s.config,binding,cached)?'complete':'missing';
        } catch { checks.comment='unavailable'; }
      }
      return {checks};
    },
    async admin() {const s = await read(); return {config: s.config, accounts: PROMOTION_REQUIRED_ACCOUNTS.map(({id, username}) => ({id, username})), issued: s.claims.length, connected: api.ready()};},
    async configure(input) {
      if (typeof input?.active !== 'boolean' || !PROMOTION_ACCOUNTS.some(a => a.id === input.accountId)) fail('Configuração inválida.');
      const start = Date.parse(input.startsAt), end = Date.parse(input.endsAt);
      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) fail('Confira as datas da campanha.');
      const postUrl = input.postUrl ? instagramPostUrl(input.postUrl) : '';
      if (input.postUrl && !postUrl) fail('Informe o link de uma publicação ou reel do Instagram.');
      if (postUrl && input.accountId !== PROMOTION_VERIFICATION_ACCOUNT.id) fail('Publique o post da promoção em @tiolira3d para confirmar o Instagram pelo Direct.');
      if (input.active && (!postUrl || !api.ready() || end < now())) fail('Configure um post válido, as conexões do Instagram e uma data futura antes de ativar.');
      const before = await read();
      if (before.config.version !== input.version) fail('A campanha mudou. Recarregue antes de salvar.', 409);
      const mediaId = postUrl ? await api.resolvePost(input.accountId, postUrl) : '';
      const config = {id: PROMOTION_ID, active: input.active, version: randomUUID(), startsAt: new Date(start).toISOString(), endsAt: new Date(end).toISOString(), postUrl, mediaId, accountId: input.accountId};
      await updateRecord(PROMOTION_KEY, old => {
        const s = state(old);
        if (s.config.version !== input.version) fail('A campanha mudou. Recarregue antes de salvar.', 409);
        s.config = config; return s;
      });
      return this.admin();
    },
    async startLink(member, input) {
      member = await currentMember(member); assertEmail(member);
      const username = instagramHandle(input?.username);
      if (!username || PROMOTION_ACCOUNTS.some(a => a.username === username)) fail('Informe o Instagram pessoal que participará da promoção.');
      if (!api.ready()) fail('A conexão com o Instagram está temporariamente indisponível.', 503);
      const before=await read(), accountId=PROMOTION_VERIFICATION_ACCOUNT.id;
      const candidate=before.config.mediaId && before.config.accountId===accountId ? await api.findLinkComment(before.config,username) : null;
      const code=randomBytes(12).toString('hex').toUpperCase(), hash=digest(code), createdAt=now();
      const eligible=candidate && now()-Date.parse(candidate.timestamp)<7*24*60*60_000;
      let reused, sendPrivate=false;
      await updateRecord(PROMOTION_KEY, old => {
        const s=state(old);
        const previous=Object.values(s.challenges).find(c=>c.memberId===member.id && c.username===username && c.version===member.version && c.emailHash===digest(normalizedEmail(member.email)) && c.expiresAt>now() && ['sending','private_reply'].includes(c.delivery));
        if(previous){reused=previous;return s;}
        if(s.config.version!==before.config.version)fail('A campanha mudou. Tente confirmar novamente.',409);
        const identity=candidate && `${accountId}:${candidate.from.id}`;
        if(identity && s.identityOwners[identity] && s.identityOwners[identity]!==member.id)fail('Este Instagram já está vinculado a outro cadastro.',409);
        for(const [key,c] of Object.entries(s.challenges))if(c.memberId===member.id || c.expiresAt<=now())delete s.challenges[key];
        s.privateReplies ||= {};
        sendPrivate=Boolean(eligible && !s.privateReplies[candidate.id]);
        if(sendPrivate)s.privateReplies[candidate.id]={status:'reserved',challengeHash:hash,createdAt};
        s.challenges[hash]={memberId:member.id,version:member.version,emailHash:digest(normalizedEmail(member.email)),username,createdAt,expiresAt:createdAt+30*60_000,accounts:{},delivery:sendPrivate?'sending':'manual',expectedSenderId:candidate?String(candidate.from.id):null};
        return s;
      });
      if(reused)return {delivery:reused.delivery,expiresAt:new Date(reused.expiresAt).toISOString()};
      if(sendPrivate){
        try {
          await api.sendPrivateReply(candidate.id,`Você solicitou a confirmação do seu Instagram no site Tio Lira? Para vincular este Instagram ao cadastro que fez a solicitação, responda esta mensagem copiando a linha abaixo:\n\nCUPOM ${code}\n\nO código vale por 30 minutos. Confirme somente se você iniciou o pedido em tiolira.com.br. Caso contrário, ignore esta mensagem.`);
        } catch {
          // The delivery may have succeeded despite a timeout. Never send a second private reply.
          await updateRecord(PROMOTION_KEY,old=>{const s=state(old);if(s.challenges[hash])s.challenges[hash].delivery='manual';if(s.privateReplies[candidate.id]?.challengeHash===hash)s.privateReplies[candidate.id].status='uncertain';return s;});
          return {delivery:'manual',message:`CUPOM ${code}`,expiresAt:new Date(createdAt+30*60_000).toISOString()};
        }
        await updateRecord(PROMOTION_KEY,old=>{const s=state(old);if(s.challenges[hash])s.challenges[hash].delivery='private_reply';if(s.privateReplies[candidate.id]?.challengeHash===hash)s.privateReplies[candidate.id].status='sent';return s;});
        return {delivery:'private_reply',expiresAt:new Date(createdAt+30*60_000).toISOString()};
      }
      return {delivery:'manual',message:`CUPOM ${code}`,expiresAt:new Date(createdAt+30*60_000).toISOString()};
    },
    async receive(payload) {
      for (const event of promotionLinkEvents(payload)) {
        if(event.accountId!==PROMOTION_VERIFICATION_ACCOUNT.id)continue;
        const hash = digest(event.code), initial = (await read()).challenges[hash];
        if (initial?.expectedSenderId && initial.expectedSenderId!==event.senderId) continue;
        if (!initial || initial.expiresAt <= now() || event.timestamp < initial.createdAt - 5000 || event.timestamp > now() + 60_000) continue;
        const member = await getMember(initial.memberId);
        if (!member || member.version !== initial.version || !emailIsVerified(member) || digest(normalizedEmail(member.email)) !== initial.emailHash) continue;
        const profile = await readProfile(event.accountId, event.senderId);
        if (profile.errorCode || !profile.username) fail('Consulta de perfil indisponível.', 503);
        await updateRecord(PROMOTION_KEY, old => {
          const s = state(old), challenge = s.challenges[hash];
          if (!challenge || challenge.expiresAt <= now() || challenge.createdAt !== initial.createdAt) return s;
          if (instagramHandle(profile.username) !== challenge.username) {challenge.error = 'A mensagem deve sair do Instagram informado no site.'; return s;}
          const identity = `${event.accountId}:${event.senderId}`, owner = s.identityOwners[identity];
          if (owner && owner !== member.id) {challenge.error = 'Este Instagram já está vinculado a outro cadastro.'; return s;}
          challenge.accounts[event.accountId] = {senderId: event.senderId}; delete challenge.error;
          if (PROMOTION_REQUIRED_ACCOUNTS.every(a => challenge.accounts[a.id])) {
            const keys = identityKeys(challenge);
            if (keys.some(key => s.identityOwners[key] && s.identityOwners[key] !== member.id)) {challenge.error = 'Este Instagram já está vinculado a outro cadastro.'; return s;}
            const binding = {id: randomUUID(), username: challenge.username, accounts: challenge.accounts, verifiedAt: new Date(now()).toISOString()};
            for (const key of keys) s.identityOwners[key] = member.id;
            s.bindings[member.id] = binding; delete s.challenges[hash];
          }
          return s;
        });
      }
      // Only keep comment IDs for the configured post. The text and friends' handles are not stored.
      const current = await read();
      if (!current.config.mediaId || payload?.object !== 'instagram') return;
      const candidates = [];
      for (const entry of Array.isArray(payload.entry) ? payload.entry : []) {
        if (entry.id !== current.config.accountId) continue;
        for (const change of Array.isArray(entry.changes) ? entry.changes : []) {
          const c = change?.value;
          if (change.field !== 'comments' || String(c?.media?.id || c?.media_id || '') !== current.config.mediaId || !/^\d{1,30}$/.test(String(c?.id || '')) ||
            !/^\d{1,30}$/.test(String(c?.from?.id || '')) || distinctFriendMentions(c.text, c.from?.username).length < 2) continue;
          candidates.push({id: String(c.id), senderId: String(c.from.id)});
        }
      }
      if (candidates.length) await updateRecord(PROMOTION_KEY, old => {
        const s = state(old); if (s.config.mediaId !== current.config.mediaId) return s;
        for (const c of candidates) {
          const key = `${s.config.mediaId}:${c.senderId}`;
          s.comments[key] = [...new Set([...(s.comments[key] || []), c.id])].slice(-3);
        }
        return s;
      });
    },
    async claim(member) {
      member = await currentMember(member); assertEmail(member);
      const before = await read(), existing = privateClaim(before, member);
      if (existing) return {coupon: publicClaim(existing)};
      assertOpen(before, now());
      const binding = before.bindings[member.id];
      if (!binding || !PROMOTION_REQUIRED_ACCOUNTS.every(a => binding.accounts[a.id]?.senderId)) fail('Confirme seu Instagram no Direct de @tiolira3d.', 409);
      const profiles = await Promise.all(PROMOTION_REQUIRED_ACCOUNTS.map(a => readProfile(a.id, binding.accounts[a.id].senderId)));
      if (profiles.some(p => p.errorCode || p.follows === null || !p.username)) fail('Não foi possível consultar seus seguidores agora. Tente novamente em instantes.', 503);
      if (profiles.some(p => instagramHandle(p.username) !== binding.username)) fail('Seu @ mudou. Vincule novamente o Instagram antes de continuar.', 409);
      if (profiles.some(p => p.follows !== true)) fail('Siga @tiolira3d para participar.', 409);
      const cached = before.comments[`${before.config.mediaId}:${binding.accounts[before.config.accountId].senderId}`] || [];
      const comment = await api.findComment(before.config, binding, cached);
      if (!comment) fail('Comente no post da promoção com dois @ diferentes. Não conte seu próprio perfil, @tiolira ou @tiolira3d.', 409);
      member = await currentMember(member); assertEmail(member);
      let claimed;
      await updateRecord(PROMOTION_KEY, old => {
        const s = state(old), prior = privateClaim(s, member);
        if (prior) {claimed = prior; return s;}
        assertOpen(s, now());
        if (s.config.version !== before.config.version || s.bindings[member.id]?.id !== binding.id) fail('Seus dados mudaram. Confira novamente as regras.', 409);
        const emailHash = digest(normalizedEmail(member.email)), identities = identityKeys(binding);
        if (s.claims.some(c => c.emailHash === emailHash || c.identities.some(id => identities.includes(id)))) fail('Este e-mail ou Instagram já recebeu o cupom desta promoção.', 409);
        claimed = {id: randomUUID(), campaignId: PROMOTION_ID, code: `TLIG-${randomBytes(12).toString('hex').toUpperCase()}`, memberId: member.id, emailHash, username: binding.username, identities, issuedAt: new Date(now()).toISOString(), expiresAt: s.config.endsAt, commentId: String(comment.id), mediaId: s.config.mediaId, collectionIds: [...PROMOTION_COLLECTIONS]};
        s.claims.push(claimed); return s;
      });
      return {coupon: publicClaim(claimed)};
    },
    async redeem(member, input) {
      member = await currentMember(member); assertEmail(member);
      const s = await read(), claim = privateClaim(s, member);
      if (!claim || claim.code !== input?.code || claim.emailHash !== digest(normalizedEmail(member.email))) fail('Cupom não encontrado para esta conta.', 403);
      if (typeof input.productId !== 'string' || input.productId.length > 100) fail('Escolha um modelo.');
      return {order: await redeemOrder(member, claim, input, {enabled: s.config.active, now: now()})};
    },
  };
}
