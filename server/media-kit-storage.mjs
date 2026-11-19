import {get,put} from '@vercel/blob';
import {readRecord,updateRecord} from './store.mjs';
import {mediaKitAssetNames} from './media-kit-access.mjs';
const EDITION=/^[a-f0-9-]{36}$/;
export const kitNames=new Set(['content.json','Tio-Lira-Midia-Kit.pdf',...mediaKitAssetNames]);
export async function activeMediaKit(){return (await readRecord('media-kit/active.json'))?.data||null;}
export async function mediaKitFile(name){
 const active=await activeMediaKit();
 if(!active?.edition||!kitNames.has(name)||!EDITION.test(active.edition))return null;
 return get(`studio/media-kit/editions/${active.edition}/${name}`,{access:'private',useCache:false});
}
export function validateKitContent(c){
 if(!c||typeof c!=='object'||Array.isArray(c))throw new Error('Conteúdo inválido.');
 for(const k of ['role','edition','title','intro','bio','bio2','email','closing','sourceNote'])if(typeof c[k]!=='string'||c[k].length>5000)throw new Error('Campo inválido: '+k);
 if(!Array.isArray(c.credentials)||c.credentials.some(v=>typeof v!=='string'))throw new Error('Credenciais inválidas.');
 if(!/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(c.email))throw new Error('E-mail inválido.');
 for(const k of ['instagram','maker','case','click','easter','projection'])if(!c[k]||typeof c[k]!=='object')throw new Error('Seção inválida: '+k);
 for(const k of ['instagram','maker','case'])if(!Array.isArray(c[k].stats)||c[k].stats.some(r=>!Array.isArray(r)||r.length!==2||r.some(v=>typeof v!=='string')))throw new Error('Indicadores inválidos.');
 if(!Array.isArray(c.nativity)||c.nativity.some(p=>!mediaKitAssetNames.has(p.image)))throw new Error('Imagem inválida.');
 for(const k of ['partnerships','roadmap'])if(!Array.isArray(c[k])||c[k].length>12)throw new Error('Lista inválida.');
 if(!Array.isArray(c.projection.rows)||!Array.isArray(c.instagram.mix)||c.instagram.mix.some(r=>!Array.isArray(r)||typeof r[0]!=='string'||typeof r[1]!=='number'||r[1]<0||r[1]>100))throw new Error('Gráfico inválido.');
 // Keep editor imports data-only; markup is escaped again by the renderer.
 if(JSON.stringify(c).length>100000)throw new Error('Conteúdo muito grande.');
 return c;
}
export async function stageMediaKit(edition,file){
 if(!EDITION.test(edition)||!kitNames.has(file.name)||file.size>4000000)throw new Error('Arquivo ou edição inválidos (máximo 4 MB por arquivo).');
 const bytes=Buffer.from(await file.arrayBuffer());let content;
 const name=file.name;
 if(name==='content.json'){content=validateKitContent(JSON.parse(bytes.toString('utf8')));}
 else if(name.endsWith('.pdf')){if(bytes.subarray(0,5).toString()!=='%PDF-')throw new Error('PDF inválido.');}
 else if(name.endsWith('.jpg')){if(bytes[0]!==255||bytes[1]!==216)throw new Error('JPEG inválido.');}
 else if(!bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))throw new Error('PNG inválido.');
 await put(`studio/media-kit/editions/${edition}/${name}`,bytes,{access:'private',addRandomSuffix:false,allowOverwrite:true,contentType:name.endsWith('.pdf')?'application/pdf':name.endsWith('.json')?'application/json':name.endsWith('.png')?'image/png':'image/jpeg',cacheControlMaxAge:0});
 await updateRecord(`media-kit/editions/${edition}.json`,old=>({edition,files:[...new Set([...(old?.files||[]),name])],content:content||old?.content,updatedAt:new Date().toISOString()}));
}
export async function publishMediaKit(edition){
 if(!EDITION.test(edition))throw new Error('Edição inválida.');
 const staged=(await readRecord(`media-kit/editions/${edition}.json`))?.data;
 if(!staged?.content||[...kitNames].some(name=>!staged.files?.includes(name)))throw new Error('Envie todos os arquivos antes de publicar.');
 validateKitContent(staged.content);
 await updateRecord('media-kit/active.json',()=>({edition,content:staged.content,publishedAt:new Date().toISOString()}));
}
