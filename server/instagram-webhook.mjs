import {createHmac, timingSafeEqual} from 'node:crypto';

const MAX_BODY_BYTES = 262144;
const numericId = value => typeof value === 'string' && /^\d{1,30}$/.test(value);
const reply = (text, status = 200) => new Response(text, {status, headers: {'Cache-Control': 'no-store', 'Content-Type': 'text/plain; charset=utf-8'}});
const equal = (left, right) => {
  const a = Buffer.from(left), b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
};

export function validInstagramSignature(body, signature, secret) {
  if (!secret || !/^sha256=[a-f0-9]{64}$/.test(signature || '')) return false;
  return equal(signature, `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`);
}

// A pilot only: receive TESTE CUPOM, verify the relationship, and retain no message text.
export function instagramTestEvents(payload, allowedAccounts) {
  if (payload?.object !== 'instagram' || !Array.isArray(payload.entry)) return [];
  const events = [];
  for (const entry of payload.entry) {
    if (!allowedAccounts.has(entry?.id) || !Array.isArray(entry.messaging)) continue;
    for (const event of entry.messaging) {
      if (event?.message?.is_echo || event?.message?.is_deleted ||
          typeof event?.message?.text !== 'string' || event.message.text.trim().toUpperCase() !== 'TESTE CUPOM' ||
          !numericId(event?.sender?.id) || event.sender.id === entry.id ||
          event?.recipient?.id !== entry.id ||
          typeof event.message.mid !== 'string' || event.message.mid.length > 512 ||
          !Number.isSafeInteger(event.timestamp) || event.timestamp <= 0) continue;
      events.push({accountId: entry.id, senderId: event.sender.id, messageId: event.message.mid, timestamp: event.timestamp});
    }
  }
  return events;
}

export async function readInstagramFollowProfile(senderId, accessToken, fetcher = fetch) {
  const url = new URL(`https://graph.facebook.com/v27.0/${senderId}`);
  url.searchParams.set('fields', 'username,is_user_follow_business');
  const response = await fetcher(url, {headers: {Authorization: `Bearer ${accessToken}`}, signal: AbortSignal.timeout(8000), cache: 'no-store'});
  const data = await response.json();
  if (!response.ok || data.error) {
    // API error messages can contain private details; persist only the numeric code.
    return {username: null, follows: null, errorCode: Number.isInteger(data.error?.code) ? data.error.code : response.status};
  }
  return {
    username: typeof data.username === 'string' ? data.username : null,
    follows: typeof data.is_user_follow_business === 'boolean' ? data.is_user_follow_business : null,
    errorCode: null,
  };
}

export function createInstagramWebhook({appSecret, verifyToken, accounts, receive, receivePayload, reportError = () => {}}) {
  const ready = () => Boolean(appSecret && verifyToken && accounts?.size);
  return {
    async GET(request) {
      if (!ready()) return reply('Not configured', 503);
      const params = new URL(request.url).searchParams;
      if (params.get('hub.mode') !== 'subscribe' || !equal(params.get('hub.verify_token') || '', verifyToken)) return reply('Forbidden', 403);
      const challenge = params.get('hub.challenge');
      return challenge && challenge.length <= 2000 ? reply(challenge) : reply('Invalid challenge', 400);
    },
    async POST(request) {
      if (!ready()) return reply('Not configured', 503);
      if (Number(request.headers.get('content-length')) > MAX_BODY_BYTES) return reply('Payload too large', 413);
      const chunks = [];
      let size = 0;
      const reader = request.body?.getReader();
      if (!reader) return reply('Invalid payload', 400);
      try {
        for (;;) {
          const {done, value} = await reader.read();
          if (done) break;
          size += value.length;
          if (size > MAX_BODY_BYTES) {await reader.cancel(); return reply('Payload too large', 413);}
          chunks.push(value);
        }
      } catch {return reply('Invalid payload', 400);}
      const raw = Buffer.concat(chunks);
      if (!validInstagramSignature(raw, request.headers.get('x-hub-signature-256'), appSecret)) return reply('Forbidden', 403);
      let payload;
      try {payload = JSON.parse(raw.toString('utf8'));} catch {return reply('Invalid JSON', 400);}
      const events = instagramTestEvents(payload, accounts);
      try {
        // Await persistence so Meta can retry failed delivery; do not acknowledge lost events.
        for (const event of events) await receive(event, accounts.get(event.accountId));
        if (receivePayload) await receivePayload(payload);
      } catch {
        reportError('instagram_webhook_processing_failed');
        return reply('Temporary failure', 503);
      }
      return reply('EVENT_RECEIVED');
    },
  };
}
