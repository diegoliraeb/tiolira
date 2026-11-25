import test from 'node:test';
import assert from 'node:assert/strict';
import {subscriptionLanguage} from '../lib/subscription-language.mjs';
import {GET} from '../app/assinatura/route.js';

test('selects supported browser languages, regional variants and quality preferences', () => {
  for (const [header, expected] of [
    ['pt-BR,pt;q=0.9,en;q=0.8', 'pt'],
    ['en-US,en;q=0.9', 'en'],
    ['es-AR,es;q=0.9,en;q=0.8', 'es'],
    ['fr-CA,fr;q=0.9', 'fr'],
    ['pt;q=0.5,fr;q=0.9,en;q=0.8', 'fr'],
    ['de-DE,de;q=0.9,es;q=0.7', 'es'],
    ['ES-mx,pt;q=0.8', 'es'],
    ['fr;q=0,pt;q=0.8', 'pt'],
    ['pt;q=invalid,es;q=2,fr;q=0.7', 'fr'],
    ['de-DE,ja;q=0.9', 'en'],
    ['', 'en'],
    [null, 'en'],
  ]) assert.equal(subscriptionLanguage(header), expected, String(header));
});

test('share link redirects per request without caching or losing campaign parameters', () => {
  for (const lang of ['pt', 'en', 'es', 'fr']) {
    const response = GET(new Request('https://www.tiolira.com.br/assinatura?utm_source=makerworld', {
      headers: {'Accept-Language': `${lang}-XX`},
    }));
    assert.equal(response.status, 307);
    assert.equal(response.headers.get('Location'), `/${lang}/assinatura?utm_source=makerworld`);
    assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
    assert.equal(response.headers.get('Vary'), 'Accept-Language');
  }
});

test('unrecognized preferences fall back to the existing English subscription page', () => {
  const response = GET(new Request('https://www.tiolira.com.br/assinatura', {headers: {'Accept-Language': 'it-IT'}}));
  assert.equal(response.headers.get('Location'), '/en/assinatura');
});
