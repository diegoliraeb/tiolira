import test from 'node:test';
import assert from 'node:assert/strict';
import {canAdvertiseLicense,licenseAnnouncementText} from '../lib/license-announcement.mjs';
test('ad text includes only commercial license code, excludes revoked and expired licenses',()=>{
 const license={code:'TL-TEST-123',partnerName:'Private name',email:'private@example.invalid',status:'active'};
 assert.equal(licenseAnnouncementText(license),'Licença comercial: TL-TEST-123');
 assert.equal(canAdvertiseLicense(license),true);
 assert.equal(canAdvertiseLicense({...license,status:'revoked'}),false);
 assert.equal(canAdvertiseLicense({...license,validUntil:'2020-01-01'}),false);
 assert.equal(canAdvertiseLicense({...license,validUntil:'invalid'}),false);
 assert.equal(canAdvertiseLicense({code:'TL-FREE'}),true);
 assert.equal(canAdvertiseLicense(null),false);
});
