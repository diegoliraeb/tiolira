import test from 'node:test';
import assert from 'node:assert/strict';
import {instagramUrl,partnerInstagram} from '../lib/instagram.mjs';
import {instagramSchema,publicCatalog} from '../server/schema.mjs';
import seed from '../data/catalog.json' with {type:'json'};

test('partner Instagram accepts handles and profile URLs without allowing unrelated or unsafe destinations',()=>{
 for(const value of ['@Atelie.Teste','atelie.teste','instagram.com/atelie.teste','https://www.instagram.com/atelie.teste/?igsh=example'])assert.equal(instagramSchema.parse(value),'https://www.instagram.com/atelie.teste/');
 for(const value of ['javascript:alert(1)','https://evil.invalid/profile','https://instagram.com.evil.invalid/teste','https://user:pass@instagram.com/teste','https://instagram.com:8443/teste','https://instagram.com/p/post','https://instagram.com/accounts/','@']){assert.equal(instagramUrl(value),'');assert.equal(instagramSchema.safeParse(value).success,false);}
 assert.equal(instagramSchema.parse(''),'');
});
test('directory exposes Instagram only for published partners, supports old website links and respects removal',()=>{
 const data=structuredClone(seed);const base={id:'test',name:'Teste',status:'approved',consent:true,email:'private@example.invalid',website:'https://www.instagram.com/legacy.partner/',productIds:[]};
 data.stores=[base,{...base,id:'new',instagram:'@novo.parceiro'},{...base,id:'removed',instagram:''},{...base,id:'pending',status:'pending'}];
 const stores=publicCatalog(data).stores;
 assert.equal(stores.length,3);assert.equal(stores[0].instagram,'https://www.instagram.com/legacy.partner/');assert.equal(stores[1].instagram,'https://www.instagram.com/novo.parceiro/');assert.equal(stores[2].instagram,'');assert.ok(stores.every(s=>!('email' in s)));
 assert.equal(partnerInstagram({website:'https://example.invalid'}),'');
});
