import test from 'node:test';
import assert from 'node:assert/strict';
import {updateEmail,updateRecipients,sameUpdateFiles} from '../server/product-update-email.mjs';
test('update audience includes paid collection buyers and downloaders once per email',()=>{
 const before=process.env.ASAAS_ENVIRONMENT;process.env.ASAAS_ENVIRONMENT='sandbox';
 try{
 const product={id:'updated',access:'site'};const order={memberId:'paid',status:'paid',environment:'sandbox',productIds:['updated'],lang:'es'};
 const commerce={orders:[order,{...order,memberId:'other',productIds:['different']},{...order,memberId:'unpaid',status:'pending'}],downloadPartners:[{memberId:'download',productId:'updated'},{memberId:'paid',productId:'updated'},{memberId:'duplicate',productId:'updated'},{memberId:'other',productId:'other'}]};
 const members=[{id:'paid',email:'paid@example.invalid',countryCode:'CO'},{id:'download',email:'download@example.invalid',countryCode:'BR'},{id:'duplicate',email:'DOWNLOAD@example.invalid',countryCode:'BR'},{id:'unpaid',email:'unpaid@example.invalid'},{id:'other',email:'other@example.invalid'}];
 const recipients=updateRecipients(commerce,members,product);assert.equal(recipients.length,2);assert.equal(recipients[0].language,'es');assert.equal(recipients[1].language,'pt');
 assert.equal(updateRecipients(commerce,members,{...product,access:'paid'}).length,1);
 }finally{if(before===undefined)delete process.env.ASAAS_ENVIRONMENT;else process.env.ASAAS_ENVIRONMENT=before;}
});
test('approved update has logo, correct change, protected account link and translations',()=>{
 const pt=updateEmail('pt','https://www.tiolira.com.br');assert.match(pt.text,/rosto do Menino Jesus/);assert.match(pt.text,/baixe novamente/);assert.match(pt.html,/tl-monogram-3d-icon/);assert.match(pt.text,/https:\/\/www.tiolira.com.br\/pt\/clube/);assert.ok(!pt.html.includes('/api/download'));
 for(const lang of ['pt','en','es','fr'])assert.match(updateEmail(lang,'https://www.tiolira.com.br').html,new RegExp('lang="'+lang+'"'));
 assert.throws(()=>updateEmail('xx','https://www.tiolira.com.br'));assert.throws(()=>updateEmail('pt','http://unsafe.invalid'));
});

test('file identity survives JSONB object key reordering',()=>{assert.equal(sameUpdateFiles([{id:'original',name:'A',filePath:'models/a.3mf'}],[{filePath:'models/a.3mf',name:'A',id:'original'}]),true);assert.equal(sameUpdateFiles([{id:'original',filePath:'models/a.3mf'}],[{id:'original',filePath:'models/b.3mf'}]),false);});
