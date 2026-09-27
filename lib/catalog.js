import {securityReady} from '../server/auth.mjs';
import {getCatalog,configured} from '../server/store.mjs';
import {publicCatalog} from '../server/schema.mjs';
export async function readPublicCatalog(){const {data}=await getCatalog();return {...publicCatalog(data),registrationReady:configured()&&await securityReady()&&data.settings.storesOpen};}
