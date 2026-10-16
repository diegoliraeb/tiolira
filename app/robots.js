import {SITE_ORIGIN} from '../lib/seo.mjs';
export default function robots(){return {rules:{userAgent:'*',allow:['/','/api/media?path=images','/api/store-logo'],disallow:['/api/']},sitemap:`${SITE_ORIGIN}/sitemap.xml`};}
