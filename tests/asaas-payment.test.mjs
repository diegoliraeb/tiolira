import test from 'node:test';
import assert from 'node:assert/strict';
import {invoiceUrl,cardPaymentUrl} from '../lib/asaas-payment.mjs';
import {paymentReturnUrl} from '../server/asaas.mjs';

test('hosted card links accept only provider HTTPS URLs and payable orders',()=>{
 const paymentUrl='https://www.asaas.com/i/test-invoice';
 for(const status of ['pending','overdue'])assert.equal(cardPaymentUrl({billingType:'CREDIT_CARD',status,paymentUrl}),paymentUrl);
 for(const status of ['creating','review','paid','failed','revoked','cancelled'])assert.equal(cardPaymentUrl({billingType:'CREDIT_CARD',status,paymentUrl}),'');
 assert.equal(cardPaymentUrl({billingType:'PIX',status:'pending',paymentUrl}),'');
 assert.equal(cardPaymentUrl(null),'');
 for(const url of ['javascript:alert(1)','http://www.asaas.com/i/test','https://asaas.com.evil.invalid/i/test','https://user:secret@asaas.com/i/test','https://evil.invalid/i/test',null,'']){
  assert.equal(invoiceUrl(url),'');assert.equal(cardPaymentUrl({billingType:'CREDIT_CARD',status:'pending',paymentUrl:url}),'');
 }
 assert.equal(invoiceUrl('https://sandbox.asaas.com/i/test'),'https://sandbox.asaas.com/i/test');
});

test('payment return uses the configured HTTPS origin and a supported language',()=>{
 const previous=process.env.SITE_URL,previousEnabled=process.env.ASAAS_PAYMENT_REDIRECT_ENABLED;
 try{
  process.env.SITE_URL='https://www.tiolira.com.br/some-path?old=1';
  delete process.env.ASAAS_PAYMENT_REDIRECT_ENABLED;
  assert.equal(paymentReturnUrl('order-123','en'),'');
  process.env.ASAAS_PAYMENT_REDIRECT_ENABLED='true';
  assert.equal(paymentReturnUrl('order-123','en'),'https://www.tiolira.com.br/en/clube?pedido=order-123#compras');
  assert.equal(paymentReturnUrl('order-123','../../evil'),'https://www.tiolira.com.br/pt/clube?pedido=order-123#compras');
  for(const invalid of ['http://www.tiolira.com.br','https://user:secret@www.tiolira.com.br','invalid']){process.env.SITE_URL=invalid;assert.equal(paymentReturnUrl('order-123'),'');}
  delete process.env.SITE_URL;assert.equal(paymentReturnUrl('order-123'),'');
 }finally{if(previousEnabled===undefined)delete process.env.ASAAS_PAYMENT_REDIRECT_ENABLED;else process.env.ASAAS_PAYMENT_REDIRECT_ENABLED=previousEnabled;if(previous===undefined)delete process.env.SITE_URL;else process.env.SITE_URL=previous;}
});
