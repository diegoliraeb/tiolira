import {createInstagramWebhook, readInstagramFollowProfile} from '../../../../server/instagram-webhook.mjs';
import {readRecord, updateRecord} from '../../../../server/store.mjs';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function handlers() {
  const accounts = new Map([
    ['17841400549300615', process.env.META_TIOLIRA_ACCESS_TOKEN],
    ['17841433509773548', process.env.META_TIOLIRA3D_ACCESS_TOKEN],
  ].filter(([, token]) => token));
  return createInstagramWebhook({
    appSecret: process.env.META_APP_SECRET,
    verifyToken: process.env.META_WEBHOOK_VERIFY_TOKEN,
    accounts,
    reportError: code => console.error(code),
    async receive(event, token) {
      const key = `instagram-tests/${event.accountId}/${event.senderId}.json`;
      const previous = await readRecord(key);
      if (previous?.data?.messageId === event.messageId || previous?.data?.timestamp > event.timestamp) return;
      const profile = await readInstagramFollowProfile(event.senderId, token);
      const result = {...event, ...profile, checkedAt: new Date().toISOString()};
      await updateRecord(key, current => current?.timestamp >= event.timestamp ? current : result);
    },
  });
}

export async function GET(request) {return handlers().GET(request);}
export async function POST(request) {return handlers().POST(request);}
