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
  const showcase=[['afb042fa-0f87-4d9e-9111-d3be10717a26','Flamengo','Brasileirão'],['noel-sao-paulo','São Paulo','Brasileirão'],['2164ca36-f697-4e0f-98a8-1dd8d60015b7','Barcelona','Champions'],['2a734b63-3c33-4529-a007-c4d7aed451ab','Arsenal','Champions']];
  const examples=showcase.map(([id,team,league])=>{const p=catalog.products.find(p=>p.id===id&&p.image&&PROMOTION_COLLECTIONS.includes(p.collection));return p?{id:p.id,name:p.name,image:p.image,team,league}:null;}).filter(Boolean);
  return <InstagramPromotionLanding lang={lang} campaign={campaign} examples={examples}/>;
}
