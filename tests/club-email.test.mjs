import test from 'node:test';
import assert from 'node:assert/strict';
import {passwordResetEmail} from '../server/club-email.mjs';

test('branded recovery email escapes profile data and keeps the same single-use link in both formats',()=>{
 for(const lang of ['pt','en','es']){
  const origin='https://www.tiolira.com.br',link=`${origin}/${lang}/clube#reset=${'a'.repeat(64)}`;
  const email=passwordResetEmail({name:'<img src=x onerror=alert(1)> & "Parceiro"',lang,origin,link});
  assert.ok(email.html.includes('&lt;img src=x onerror=alert(1)&gt; &amp; &quot;Parceiro&quot;'));
  assert.ok(!email.html.includes('<img src=x'));assert.ok(email.html.includes('tl-monogram-3d-icon.png'));
  assert.equal(email.html.match(new RegExp(`href="${link}"`,'g')).length,2);assert.ok(email.text.includes(link));
  assert.ok(email.html.includes(`lang="${lang}"`));assert.ok(email.html.includes('#404934'));assert.ok(email.html.includes('30'));
  assert.ok(email.html.includes('Diego Lira'));assert.ok(!email.html.includes('<script'));
 }
 assert.throws(()=>passwordResetEmail({origin:'https://www.tiolira.com.br',link:`https://evil.invalid/pt/clube#reset=${'a'.repeat(64)}`}));
});
