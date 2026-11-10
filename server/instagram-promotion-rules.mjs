import {instagramUrl} from '../lib/instagram.mjs';

export const PROMOTION_ID = 'instagram-noeis-2026-11';
export const PROMOTION_KEY = 'instagram-promotion.json';
export const PROMOTION_ACCOUNTS = [
  {id: '17841400549300615', username: 'tiolira', env: 'META_TIOLIRA_ACCESS_TOKEN'},
  {id: '17841433509773548', username: 'tiolira3d', env: 'META_TIOLIRA3D_ACCESS_TOKEN'},
];
export const PROMOTION_VERIFICATION_ACCOUNT = PROMOTION_ACCOUNTS[1];
export const PROMOTION_REQUIRED_ACCOUNTS = [PROMOTION_VERIFICATION_ACCOUNT];
export const PROMOTION_COLLECTIONS = ['noeis-brasileirao', '35b06e0a-ada0-4df9-93e5-4ce39766915a'];
export const defaultPromotion = () => ({id: PROMOTION_ID, active: false, version: 'draft', startsAt: '2026-11-10T03:00:00.000Z', endsAt: '2026-12-01T02:59:59.999Z', postUrl: '', mediaId: '', accountId: PROMOTION_VERIFICATION_ACCOUNT.id});
export const instagramHandle = value => {const url = instagramUrl(value); return url ? new URL(url).pathname.split('/')[1] : '';};
export function instagramPostUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || !['www.instagram.com', 'instagram.com'].includes(url.hostname) || url.username || url.password || url.port) return '';
    const match = /^\/(p|reel)\/([A-Za-z0-9_-]+)\/?$/.exec(url.pathname);
    return match ? `https://www.instagram.com/${match[1]}/${match[2]}/` : '';
  } catch {return '';}
}
export function distinctFriendMentions(text, participant) {
  if (typeof text !== 'string' || text.length > 10_000) return [];
  const excluded = new Set([participant?.toLowerCase(), ...PROMOTION_ACCOUNTS.map(a => a.username)]);
  const matches = [...text.matchAll(/(?:^|[^a-z0-9._@])@([a-z0-9_][a-z0-9._]{0,29})(?![a-z0-9._])/gi)];
  return [...new Set(matches.map(m => m[1].toLowerCase().replace(/\.+$/, '')).filter(x => !x.endsWith('.') && !x.includes('..') && !excluded.has(x)))];
}
export function validPromotionComment(comment, binding, config) {
  const stamp = Date.parse(comment?.timestamp);
  return Boolean(comment?.id && !comment.hidden && !comment.is_hidden &&
    String(comment.from?.id || '') === binding.accounts[config.accountId]?.senderId &&
    instagramHandle(comment.from?.username) === binding.username &&
    Number.isFinite(stamp) && stamp >= Date.parse(config.startsAt) && stamp <= Date.parse(config.endsAt) &&
    distinctFriendMentions(comment.text, binding.username).length >= 2);
}
export function promotionOpen(config, now = Date.now()) {
  return Boolean(config.active && config.mediaId && config.postUrl && now >= Date.parse(config.startsAt) && now <= Date.parse(config.endsAt));
}
export function promotionLinkEvents(payload) {
  if (payload?.object !== 'instagram' || !Array.isArray(payload.entry)) return [];
  const events = [];
  for (const entry of payload.entry) {
    if (!PROMOTION_ACCOUNTS.some(a => a.id === entry?.id) || !Array.isArray(entry.messaging)) continue;
    for (const event of entry.messaging) {
      const text = typeof event?.message?.text === 'string' ? event.message.text.trim().toUpperCase() : '';
      const match = /^CUPOM ([A-F0-9]{24})$/.exec(text);
      if (!match || event.message.is_echo || event.message.is_deleted || event.recipient?.id !== entry.id ||
        !/^\d{1,30}$/.test(event.sender?.id || '') || event.sender.id === entry.id ||
        !Number.isSafeInteger(event.timestamp) || typeof event.message.mid !== 'string') continue;
      events.push({accountId: entry.id, senderId: event.sender.id, timestamp: event.timestamp, code: match[1]});
    }
  }
  return events;
}
