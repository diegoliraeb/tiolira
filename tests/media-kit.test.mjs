import test from 'node:test';
import assert from 'node:assert/strict';
import {deriveMediaKitKey,matchesMediaKitKey,mediaKitHeaders,mediaKitAssetNames} from '../server/media-kit-access.mjs';
import {renderMediaKit} from '../server/media-kit-render.mjs';
import {validateKitContent} from '../server/media-kit-storage.mjs';
const fixture={role:'Example',credentials:['Example'],edition:'Example',title:'Example',intro:'Example',bio:'<script>alert(1)</script>',bio2:'Example',email:'example@example.com',closing:'Example',sourceNote:'Example',instagram:{followers:'1',stats:[['1','Example']],mix:[['Stories',50]],note:'Example',period:'Example'},maker:{followers:'1',models:1,stats:[['1','Example']],period:'Example',note:'Example'},case:{title:'Example',subtitle:'Example',body:'Example',body2:'Example',stats:[['1','Example']],note:'Example'},click:{title:'Example',subtitle:'Example',body:'Example',status:'Example',opportunity:'Example'},easter:{title:'Example',body:'Example',status:'Example',opportunity:'Example'},nativity:[{image:'mini.jpg',title:'Example',text:'Example'}],partnerships:[{n:'01',title:'Example',text:'Example',deliverables:'Example'}],roadmap:[['Example','Example','Example']],projection:{title:'Example',body:'Example',rows:[['Example','0%','1']],note:'Example'}};
test('media-kit keys are stable, scoped and reject malformed or altered bearers',()=>{
 const k=deriveMediaKitKey('test-media-kit-only-secret-not-real-123456');
 assert.equal(k.length,43);assert.equal(k,deriveMediaKitKey('test-media-kit-only-secret-not-real-123456'));
 assert.ok(matchesMediaKitKey(k,k));
 for(const bad of ['',null,k+'a',k.slice(1),'<script>',deriveMediaKitKey('another-test-only-secret-not-real-12345')])assert.equal(matchesMediaKitKey(bad,k),false);
 assert.throws(()=>deriveMediaKitKey('short'));
 assert.equal(mediaKitAssetNames.has('../../security.json'),false);
 assert.match(mediaKitHeaders['Cache-Control'],/no-store/);assert.match(mediaKitHeaders['X-Robots-Tag'],/noindex/);assert.equal(mediaKitHeaders['Referrer-Policy'],'no-referrer');
});
test('all kit images and PDF links stay protected and page has no trackers',()=>{
 const key=deriveMediaKitKey('test-media-kit-only-secret-not-real-123456'),html=renderMediaKit(key,fixture);
 const images=[...html.matchAll(/<img[^>]+src="([^"]+)"/g)].map(x=>x[1]);assert.ok(images.length>5);
 for(const url of images){assert.ok(url.startsWith('/midia-kit/imagem/'));assert.ok(url.endsWith('?key='+key));}
 assert.ok(html.includes('/midia-kit/arquivo?key='+key));assert.doesNotMatch(html,/<script|googletagmanager|ActivityTracker/);assert.match(html,/noindex,nofollow/);
});
test('private content imports reject invalid asset references and unsafe email fields',()=>{
 assert.equal(validateKitContent(fixture),fixture);
 assert.throws(()=>validateKitContent({...fixture,email:'bad@example.com\" onclick=\"alert(1)'}));
 assert.throws(()=>validateKitContent({...fixture,nativity:[{image:'../../security.json'}]}));
 const html=renderMediaKit('example',fixture);assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
});

import {Script} from 'node:vm';
import {renderMediaKitEditor} from '../app/midia-kit/gerenciar/route.js';
test('editor upload script parses and the form never defaults to GET',()=>{
 const html=renderMediaKitEditor('00000000-0000-0000-0000-000000000000','test',null);
 const script=html.match(/<script[^>]*>([\s\S]*?)<\/script>/)[1];assert.doesNotThrow(()=>new Script(script));
 assert.match(html,/<form[^>]+method=\"post\"/);
});
