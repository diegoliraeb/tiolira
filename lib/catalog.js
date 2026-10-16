import {cache} from 'react';
import {readClickCounts} from '../server/product-clicks.mjs';
import {securityReady} from '../server/auth.mjs';
import {getCatalog,configured} from '../server/store.mjs';
import {publicCatalog} from '../server/schema.mjs';
export const readPublicCatalog=cache(async function readPublicCatalog(){const [{data},counts]=await Promise.all([getCatalog(),readClickCounts()]);return {...publicCatalog(data,new Date(),counts),registrationReady:configured()&&await securityReady()&&data.settings.storesOpen};});
