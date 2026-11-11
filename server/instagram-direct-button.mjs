import {createHash, randomBytes} from 'node:crypto';
import {PROMOTION_KEY, PROMOTION_VERIFICATION_ACCOUNT, instagramHandle} from './instagram-promotion-rules.mjs';

export const DIRECT_PAYLOAD = 'TIOLIRA_PROMOCAO_2026';
export const directDigest = value => createHash('sha256').update(value).digest('hex');
const fail = (message, status = 409) => {throw Object.assign(Error(message), {status});};
export function directButtonEvents(payload) {
  if (payload?.object !== 'instagram' || !Array.isArray(payload.entry)) return [];
  return payload.entry.flatMap(entry => entry?.id !== PROMOTION_VERIFICATION_ACCOUNT.id || !Array.isArray(entry.messaging) ? [] : entry.messaging.flatMap(e => {
    const value = e?.postback?.payload || e?.message?.quick_reply?.payload;
    const mid = e?.postback?.mid || e?.message?.mid;
    if (value !== DIRECT_PAYLOAD || e?.message?.is_echo || e?.message?.is_deleted ||
      e?.recipient?.id !== entry.id || typeof e?.sender?.id !== 'string' || !/^\d{1,30}$/.test(e.sender.id) || e.sender.id === entry.id ||
      typeof mid !== 'string' || !mid || mid.length > 512 || !Number.isSafeInteger(e.timestamp) || e.timestamp <= 0) return [];
    return [{senderId:e.sender.id, mid, timestamp:e.timestamp}];
  }));
}

// Only a signed Meta interaction creates a bearer ticket. The ticket is delivered
// to that Instagram's inbox, never to a site account merely claiming its @.
export function createDirectButton({read, updateRecord, api, readProfile, now}) {
  return {
    async receive(payload) {
      for (const event of directButtonEvents(payload)) {
        if (event.timestamp < now() - 10*60_000 || event.timestamp > now()+60_000) continue;
        const profile = await readProfile(PROMOTION_VERIFICATION_ACCOUNT.id, event.senderId);
        const username = instagramHandle(profile.username);
        if (profile.errorCode || !username) fail('Consulta do Instagram indisponível.',503);
        const ticket = randomBytes(32).toString('hex'), hash = directDigest(ticket), eventHash = directDigest(event.mid);
        let reserved = false;
        await updateRecord(PROMOTION_KEY, old => {
          const s = old; s.directTickets ||= {}; s.directEvents ||= {};
          for (const [key,t] of Object.entries(s.directTickets)) if(t.expiresAt <= now()) delete s.directTickets[key];
          for (const [key,e] of Object.entries(s.directEvents)) if(e.createdAt < now()-24*60*60_000) delete s.directEvents[key];
          if(s.directEvents[eventHash] || Object.values(s.directEvents).some(e=>e.senderId===event.senderId && e.createdAt>now()-60_000)) return s;
          s.directEvents[eventHash]={senderId:event.senderId,createdAt:now(),status:'sending'};
          s.directTickets[hash]={senderId:event.senderId,username,createdAt:now(),expiresAt:now()+30*60_000};
          reserved=true; return s;
        });
        if(!reserved) continue;
        let sent = false;
        try {
          await api.sendDirectLink(event.senderId, `https://www.tiolira.com.br/pt/clube#promocao/instagram/${ticket}`);
          sent=true;
        } finally {
          await updateRecord(PROMOTION_KEY, old => {
            old.directEvents[eventHash].status=sent?'sent':'uncertain';
            old.directLastInteraction={username,at:new Date(now()).toISOString(),follows:profile.follows===true?true:profile.follows===false?false:null,status:sent?'sent':'uncertain'};
            return old;
          });
        }
      }
    },
    async ticket(value, memberId) {
      if(typeof value!=='string' || !/^[a-f0-9]{64}$/.test(value)) fail('Abra o link recebido no Direct de @tiolira3d.',400);
      const hash=directDigest(value), ticket=(await read()).directTickets?.[hash];
      if(!ticket || ticket.expiresAt<=now()) fail('Este link expirou. Toque novamente em Participar da promoção no Direct.');
      if(ticket.memberId && ticket.memberId!==memberId) fail('Este link já foi usado em outro cadastro.');
      return {hash,ticket};
    },
    async configure() {
      const result=await api.configureDirectButton();
      await updateRecord(PROMOTION_KEY,old=>({...old,directButton:{configuredAt:new Date(now()).toISOString()}}));
      return result;
    },
  };
}
