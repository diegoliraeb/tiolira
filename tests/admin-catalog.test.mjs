import test from 'node:test';
import assert from 'node:assert/strict';
import {filterAdminProducts} from '../lib/admin-catalog.mjs';
const products=[{id:'1',name:'Caminho de Nazaré',slug:'caminho-nazare',collection:'familia',published:true},{id:'2',name:'São José',slug:'sao-jose',collection:'presepio',published:false},{id:'3',name:'José e Maria',slug:'jose-maria',collection:'familia',published:true}];
test('admin catalog search ignores accents and case and searches slugs',()=>{assert.deepEqual(filterAdminProducts(products,{query:'  NAZARE '}).map(p=>p.id),['1']);assert.deepEqual(filterAdminProducts(products,{query:'sao-jose'}).map(p=>p.id),['2']);});
test('admin catalog combines collection, publication and text without modifying data',()=>{const before=structuredClone(products);assert.deepEqual(filterAdminProducts(products,{query:'jose',collection:'familia',publication:'published'}).map(p=>p.id),['3']);assert.deepEqual(filterAdminProducts(products,{publication:'draft'}).map(p=>p.id),['2']);assert.deepEqual(filterAdminProducts(products,{collection:'presepio',publication:'published'}),[]);assert.deepEqual(products,before);assert.equal(filterAdminProducts(products).length,3)});
