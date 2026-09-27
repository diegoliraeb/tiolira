import {z} from 'zod';
const text=(n=200)=>z.string().trim().max(n);
const id=z.string().regex(/^[a-z0-9][a-z0-9-]{0,99}$/);
function validHttps(v){try{const u=new URL(v);return u.protocol==='https:'&&!u.username&&!u.password}catch{return false}}
export const httpsUrl=text(1800).refine(v=>!v||validHttps(v),'Use um endereço HTTPS válido.');
const imageUrl=text(1800).refine(v=>!v||/^\/assets\/[a-zA-Z0-9._/-]+$/.test(v)||/^\/api\/media\?path=images%2F[a-zA-Z0-9%._-]+$/.test(v)||validHttps(v),'Imagem inválida.');
const translation=z.object({name:text().optional(),description:text(16000).optional(),heroTitle:text(180).optional(),heroDescription:text(1200).optional(),announcement:text(200).optional(),clubDescription:text(1800).optional(),about:text(3000).optional()});
const translations=z.object({en:translation.optional(),es:translation.optional()}).default({});
export const productSchema=z.object({id,slug:id,name:text().min(1),collection:id,category:text(),description:text(16000),summary:text(1000).default(''),image:imageUrl,gallery:z.array(imageUrl).max(20).default([]),size:text(60).default(''),access:z.enum(['maker','site','soon','members']),url:httpsUrl.default(''),filePath:text(300).regex(/^(models\/[a-zA-Z0-9._-]+)?$/).default(''),exclusive:z.boolean().default(false),published:z.boolean().default(true),license:text(8000).default(''),planIds:z.array(id).max(20).default([]),order:z.number().int().min(0).max(9999).default(0),translations}).superRefine((p,ctx)=>{if(p.access==='maker'&&(!validHttps(p.url)||new URL(p.url).hostname!=='makerworld.com'))ctx.addIssue({code:'custom',message:'Informe o link oficial do MakerWorld.',path:['url']});if(p.exclusive&&(p.access!=='maker'&&p.access!=='soon'||p.filePath))ctx.addIssue({code:'custom',message:'Obras exclusivas devem permanecer no MakerWorld.',path:['exclusive']});if(p.access==='members'&&p.filePath)ctx.addIssue({code:'custom',message:'Use o link da biblioteca protegida da plataforma de assinatura.',path:['filePath']});if(p.collection==='presepio'&&p.access==='members')ctx.addIssue({code:'custom',message:'O presépio é gratuito, sem assinatura.'});});
export const collectionSchema=z.object({id,name:text().min(1),description:text(2000),image:imageUrl,free:z.boolean(),comingSoon:z.boolean().default(false),published:z.boolean().default(true),translations}).refine(c=>c.id!=='presepio'||c.free,'O presépio é gratuito.');
export const planSchema=z.object({id,name:text().min(1),description:text(3000),priceLabel:text(100),url:httpsUrl,status:z.enum(['soon','active']),collectionIds:z.array(id).max(100),license:text(8000),translations}).refine(p=>p.status!=='active'||Boolean(p.url),'Plano ativo precisa de um link de assinatura.');
const storeBase={id,name:text().min(1),city:text(120).min(1),state:text(120).min(1),country:text(100).min(1),whatsapp:z.string().regex(/^\d{10,15}$/),website:httpsUrl.default(''),email:z.email().max(254),description:text(2000),delivery:text(500),productIds:z.array(id).min(1,'Selecione pelo menos uma obra.').max(200),licenseProof:text(3000).default(''),licenseUntil:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal('')).default(''),status:z.enum(['pending','approved','paused','rejected']),consent:z.literal(true),partnershipConsent:z.boolean().default(false),createdAt:text(50)};
export const storeSchema=z.object(storeBase);
export const applicationSchema=storeSchema.omit({id:true,status:true,createdAt:true,licenseUntil:true,licenseProof:true}).extend({honeypot:text().optional()});
export const settingsSchema=z.object({heroTitle:text(180),heroDescription:text(1200),announcement:text(200),clubDescription:text(1800),about:text(3000),instagram:httpsUrl,contactEmail:z.email(),storesOpen:z.boolean().default(true),translations});
export const normalize=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
export function publicCatalog(data,now=new Date()){
 const collections=data.collections.filter(c=>c.published),collectionIds=new Set(collections.map(c=>c.id));
 const products=data.products.filter(p=>p.published&&collectionIds.has(p.collection)).sort((a,b)=>a.order-b.order).map(({filePath,...p})=>({...p,hasFile:Boolean(filePath)}));
 const validIds=new Set(products.map(p=>p.id));
 const freeIds=new Set(products.filter(p=>p.collection==='presepio').map(p=>p.id));
 const stores=data.stores.filter(s=>s.status==='approved'&&s.consent).map(({email,licenseProof,licenseUntil,status,consent,partnershipConsent,createdAt,...s})=>({...s,productIds:s.productIds.filter(id=>validIds.has(id)&&(freeIds.has(id)||(licenseProof&&licenseUntil>=now.toISOString().slice(0,10))))})).filter(s=>s.productIds.length);
 return {settings:data.settings,collections,products,plans:data.plans,stores};
}
