import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {createInstagramWebhook, instagramTestEvents, readInstagramFollowProfile} from '../server/instagram-webhook.mjs';

const accountId = '17841400549300615';
const accounts = new Map([[accountId, 'test-access-token']]);
const event = {sender: {id: '123456'}, recipient: {id: accountId}, timestamp: 1794350400000, message: {mid: 'test-message', text: 'TESTE CUPOM'}};
const payload = value => ({object: 'instagram', entry: [{id: accountId, messaging: [value]}]});
function request(body, secret = 'test-app-secret') {
  const raw = typeof body === 'string' ? body : JSON.stringify(body);
  return new Request('https://tiolira.example/api/instagram/webhook', {method: 'POST', body: raw, headers: {'x-hub-signature-256': `sha256=${createHmac('sha256', secret).update(raw).digest('hex')}`}});
}
const handlers = receive => createInstagramWebhook({appSecret: 'test-app-secret', verifyToken: 'test-verify-token', accounts, receive});

test('verificação da Meta exige o token correto e devolve o desafio sem cache', async () => {
  const api = handlers(async () => {});
  const response = await api.GET(new Request('https://tiolira.example/?hub.mode=subscribe&hub.verify_token=test-verify-token&hub.challenge=1234'));
  assert.equal(response.status, 200);
  assert.equal(await response.text(), '1234');
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal((await api.GET(new Request('https://tiolira.example/?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=1234'))).status, 403);
});

test('configuração ausente bloqueia o recebimento', async () => {
  const api = createInstagramWebhook({accounts: new Map(), receive: async () => {throw new Error('unexpected');}});
  assert.equal((await api.POST(request(payload(event)))).status, 503);
});

test('assinatura inválida ou mensagem adulterada não chama o processamento', async () => {
  let received = 0;
  const api = handlers(async () => received++);
  assert.equal((await api.POST(request(payload(event), 'wrong-secret'))).status, 403);
  const req = request(payload(event));
  const tampered = new Request(req.url, {method: 'POST', headers: req.headers, body: JSON.stringify(payload({...event, sender: {id: '999'}}))});
  assert.equal((await api.POST(tampered)).status, 403);
  assert.equal(received, 0);
});

test('evento assinado guarda apenas identificadores, sem conteúdo da mensagem', async () => {
  const received = [];
  const response = await handlers(async (...args) => received.push(args)).POST(request(payload(event)));
  assert.equal(response.status, 200);
  assert.deepEqual(received, [[{accountId, senderId: '123456', messageId: 'test-message', timestamp: event.timestamp}, 'test-access-token']]);
});

test('ignora mensagens comuns, ecos, destinatários inesperados e contas não autorizadas', () => {
  for (const altered of [
    {...event, message: {...event.message, text: 'mensagem privada'}},
    {...event, message: {...event.message, text: {unexpected: true}}},
    {...event, message: {...event.message, is_echo: true}},
    {...event, recipient: {id: '999'}},
    {...event, sender: {id: '../../record'}},
  ]) assert.deepEqual(instagramTestEvents(payload(altered), accounts), []);
  assert.deepEqual(instagramTestEvents(payload(event), new Map()), []);
});

test('erro de persistência retorna falha para a Meta tentar novamente', async () => {
  const response = await handlers(async () => {throw new Error('database unavailable');}).POST(request(payload(event)));
  assert.equal(response.status, 503);
  assert.equal(await response.text(), 'Temporary failure');
});

test('limita tamanho mesmo sem Content-Length e rejeita JSON inválido assinado', async () => {
  const api = handlers(async () => {throw new Error('unexpected');});
  assert.equal((await api.POST(request('x'.repeat(262145)))).status, 413);
  assert.equal((await api.POST(request('{broken'))).status, 400);
});

test('consulta seguidor preserva false e mantém falta de consentimento como desconhecido', async () => {
  const fetcher = async (url, options) => {
    assert.equal(url.hostname, 'graph.facebook.com');
    assert.equal(url.pathname, '/v27.0/123456');
    assert.equal(options.headers.Authorization, 'Bearer test-token');
    assert.equal(url.searchParams.has('access_token'), false);
    return Response.json({username: 'test-profile', is_user_follow_business: false});
  };
  assert.deepEqual(await readInstagramFollowProfile('123456', 'test-token', fetcher), {username: 'test-profile', follows: false, errorCode: null});
  assert.deepEqual(await readInstagramFollowProfile('123456', 'test-token', async () => Response.json({error: {code: 230, message: 'private details'}}, {status: 400})), {username: null, follows: null, errorCode: 230});
});
