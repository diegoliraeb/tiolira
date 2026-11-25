import {subscriptionLanguage} from '../../lib/subscription-language.mjs';

export const dynamic = 'force-dynamic';

export function GET(request) {
  const lang = subscriptionLanguage(request.headers.get('accept-language'));
  const {search} = new URL(request.url);
  return new Response(null, {
    status: 307,
    headers: {
      Location: `/${lang}/assinatura${search}`,
      'Cache-Control': 'private, no-store',
      Vary: 'Accept-Language',
    },
  });
}
