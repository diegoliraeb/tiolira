import test from 'node:test';
import assert from 'node:assert/strict';
import {geography,normalizeStoreLocation,geographyOptions} from '../server/geography.mjs';
import {storeCountry,brazilState,matchesAdminStore} from '../lib/geography.mjs';
import {servesLocation} from '../lib/store-search.mjs';
import {applicationSchema} from '../server/schema.mjs';
const maceio={countryCode:'BR',stateId:'AL',state:'Alagoas',cityId:'2704302',city:'Maceió'};
const recife={countryCode:'BR',stateId:'PE',state:'Pernambuco',cityId:'2611606',city:'Recife'};
const sp={countryCode:'BR',stateId:'SP',state:'São Paulo',cityId:'3550308',city:'São Paulo'};
const areaCity=l=>({id:l.cityId,name:l.city,stateId:l.stateId,state:l.state});

test('IBGE snapshot contains all states and validates municipalities and international lookups',async()=>{
 const br=await geography('BR');assert.equal(Object.keys(br.states).length,27);assert.equal(Object.values(br.states).reduce((n,s)=>n+s.cities.length,0),5571);
 assert.ok((await geographyOptions('BR','AL')).cities.some(c=>c.id===maceio.cityId));
 assert.ok((await geographyOptions('PT')).states.length);await assert.rejects(geography('../'),{status:400});
 const canonical=await normalizeStoreLocation({...maceio,country:'Wrong',city:'Wrong',state:'Wrong',serviceArea:{scope:'cities',countryCode:'BR',cities:[areaCity(maceio),areaCity(recife)]}});
 assert.equal(canonical.city,'Maceió');assert.equal(canonical.state,'AL');assert.equal(canonical.region,'Nordeste');assert.equal(canonical.serviceArea.cities[1].name,'Recife');
 await assert.rejects(normalizeStoreLocation({...maceio,cityId:recife.cityId}),{status:400});
 await assert.rejects(normalizeStoreLocation({...maceio,serviceArea:{scope:'cities',countryCode:'BR',cities:[{...areaCity(recife),stateId:'AL'}]}}),{status:400});
 await assert.rejects(normalizeStoreLocation({...maceio,serviceArea:{scope:'city',countryCode:'BR',cities:[areaCity(maceio),areaCity(recife)]}}),{status:400});
});
test('public directory considers country, state and multiple delivery cities without crossing countries',()=>{
 const store={...maceio,country:'Brasil',serviceArea:{scope:'country',countryCode:'BR',cities:[]}};
 assert.equal(servesLocation(store,recife),true);assert.equal(servesLocation(store,{countryCode:'PT'}),false);
 store.serviceArea={scope:'state',countryCode:'BR',stateId:'PE',cities:[]};assert.equal(servesLocation(store,recife),true);assert.equal(servesLocation(store,maceio),false);
 store.serviceArea={scope:'cities',countryCode:'BR',cities:[areaCity(maceio),areaCity(recife)]};assert.equal(servesLocation(store,maceio),true);assert.equal(servesLocation(store,recife),true);assert.equal(servesLocation(store,sp),false);
 assert.equal(servesLocation({city:'Maceió',state:'Alagoas',country:'Brasil'},maceio),true);
});
test('admin filters combine approval and region, state, city and accent-insensitive text',()=>{
 const store={name:'Oficina',city:'Maceió',state:'Alagoas',country:'Brasil',status:'pending'};
 assert.equal(storeCountry(store),'BR');assert.equal(brazilState(store).region,'Nordeste');
 assert.equal(matchesAdminStore(store,{status:'pending',region:'Nordeste',state:'BR:AL',city:'maceio',query:'oficina'}),true);
 for(const filters of [{status:'approved'},{region:'Sul'},{state:'BR:PE'},{city:'Recife'},{query:'inexistente'}])assert.equal(matchesAdminStore(store,filters),false);
});
test('service area requires cities and validates empty scopes',()=>{
 const input={name:'Loja',...maceio,country:'Brasil',whatsapp:'5582000000000',email:'test@example.invalid',description:'Teste',delivery:'',consent:true,serviceArea:{scope:'cities',countryCode:'BR',cities:[]}};
 assert.equal(applicationSchema.safeParse(input).success,false);
 input.serviceArea.cities=[areaCity(maceio),areaCity(recife)];assert.equal(applicationSchema.safeParse(input).success,true);
});
