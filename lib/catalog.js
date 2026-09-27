import {readClickCounts} from '../server/product-clicks.mjs';
import {securityReady} from '../server/auth.mjs';
import {getCatalog,configured} from '../server/store.mjs';
import {publicCatalog} from '../server/schema.mjs';
export async function readPublicCatalog(){const [{data},counts]=await Promise.all([getCatalog(),readClickCounts()]);return {...publicCatalog(data,new Date(),counts),registrationReady:configured()&&await securityReady()&&data.settings.storesOpen};}
