import {safelyRecordPromotion} from './promotion-analytics.mjs';
import {partnerVerificationEmail} from './partner-verification-email.mjs';
import {readRecord, updateRecord, getCatalog} from './store.mjs';
import {createEmailVerification} from './partner-email-verification.mjs';
import {createInstagramPromotion} from './instagram-promotion.mjs';
import {instagramPromotionApi} from './instagram-promotion-api.mjs';
import {PROMOTION_ACCOUNTS} from './instagram-promotion-rules.mjs';
import {readInstagramFollowProfile} from './instagram-webhook.mjs';
import {redeemInstagramOrder} from './instagram-promotion-order.mjs';

const fail = (message, status = 503) => {throw Object.assign(Error(message), {status});};
export const partnerEmailVerification = createEmailVerification({
  updateRecord,
  async send({email, code, name}) {
    const {RESEND_API_KEY, EMAIL_FROM} = process.env;
    if (!RESEND_API_KEY || !EMAIL_FROM) fail('A confirmação por e-mail está temporariamente indisponível.');
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST', headers: {Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json'},
      body: JSON.stringify({from: EMAIL_FROM, to: [email], ...partnerVerificationEmail({code,name,origin:process.env.SITE_URL || 'https://www.tiolira.com.br'})}),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) fail('Falha no envio.');
  },
});
export const instagramPromotion = createInstagramPromotion({
  readRecord, updateRecord, getCatalog,
  onCheck:(member,checks,context)=>safelyRecordPromotion(member,'check',{checks,context}),
  getMember: async id => (await readRecord('club-members.json'))?.data?.members?.find(m => m.id === id),
  api: instagramPromotionApi(),
  async readProfile(accountId, senderId) {
    const account = PROMOTION_ACCOUNTS.find(a => a.id === accountId), token = account && process.env[account.env];
    if (!token) fail('A conexão com o Instagram está temporariamente indisponível.');
    return readInstagramFollowProfile(senderId, token);
  },
  redeemOrder: redeemInstagramOrder,
});
