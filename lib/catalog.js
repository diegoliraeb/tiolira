import {getCatalog,configured} from '../server/store.mjs';
import {publicCatalog} from '../server/schema.mjs';
export async function readPublicCatalog(){const {data}=await getCatalog();return {...publicCatalog(data),registrationReady:configured()&&Boolean(process.env.ADMIN_SESSION_SECRET?.length>=32)&&data.settings.storesOpen};}
