import {readPublicCatalog} from '../lib/catalog';
import {sitemapEntries} from '../lib/seo.mjs';
export const dynamic='force-dynamic';
export default async function sitemap(){return sitemapEntries(await readPublicCatalog());}
