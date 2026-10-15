import test from 'node:test';
import assert from 'node:assert/strict';
import {partnerRoute} from '../lib/partner-navigation.mjs';
test('partner navigation preserves Asaas and collection deep links',()=>{
 assert.deepEqual(partnerRoute('','?pedido=example&retorno=asaas'),{section:'compras',collection:'all'});
 assert.equal(partnerRoute('#compras','?pedido=example&retorno=asaas').section,'compras');
 assert.equal(partnerRoute('#licencas','?pedido=example&retorno=asaas').section,'licencas');
 assert.equal(partnerRoute('#colecao=presepio').collection,'presepio');
 assert.equal(partnerRoute('#colecao=cole%C3%A7%C3%A3o').collection,'coleção');
 assert.equal(partnerRoute('#colecoes').section,'colecoes');
 assert.equal(partnerRoute('#colecao=%broken').section,'inicio');
 assert.equal(partnerRoute().section,'inicio');
});
