import InstagramPromotionLanding from '../../../components/InstagramPromotionLanding';
import {readPublicCatalog} from '../../../lib/catalog';
import {pageMetadata} from '../../../lib/seo.mjs';
import {instagramPromotion} from '../../../server/instagram-promotion-runtime.mjs';
import {PROMOTION_COLLECTIONS} from '../../../server/instagram-promotion-rules.mjs';
export const dynamic='force-dynamic';
export async function generateMetadata({params}){const {lang}=await params;return pageMetadata({lang,path:'/promocao',title:'Ganhe um Noel do Brasileirão ou da Champions',description:'Participe da promoção Tio Lira, acompanhe os passos na sua conta e resgate um modelo digital para impressão 3D.'});}
export default async function Page({params}){
  const {lang}=await params;
  const [campaign,catalog]=await Promise.all([instagramPromotion.publicCampaign(),readPublicCatalog()]);
  const examples=PROMOTION_COLLECTIONS.map(id=>catalog.products.find(p=>p.collection===id&&p.image)).filter(Boolean).map(({id,name,image})=>({id,name,image}));
  return <InstagramPromotionLanding lang={lang} campaign={campaign} examples={examples}/>;
}
