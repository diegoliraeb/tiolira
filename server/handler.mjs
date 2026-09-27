import {readClickCounts,recordProductClick} from './product-clicks.mjs';
import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import { get, put } from '@vercel/blob';
import { configured, getCatalog, readRecord, writeRecord, updateRecord, Conflict } from './store.mjs';
import { assertOrigin, requireAdmin, passwordHash, verifyPassword, makeSession, sessionCookie, safeEqual, rateLimit, setupReady, verifySetupToken } from './auth.mjs';
import { productSchema,collectionSchema,planSchema,storeSchema,applicationSchema,settingsSchema,publicCatalog } from './schema.mjs';
import {encodeLogo,saveLogo,logoPath} from './store-logo.mjs';
import {geographyOptions,normalizeStoreLocation} from './geography.mjs';
const schemas={products:productSchema,collections:collectionSchema,plans:planSchema,stores:storeSchema};
function fail(message,status=400){throw Object.assign(new Error(message),{status});}
async function body(req){if(req.body!==undefined)return typeof req.body==='string'?JSON.parse(req.body):req.body;let data='',bytes=0;for await(const part of req){bytes+=part.length;if(bytes>4_000_000)fail('Conteúdo muito grande.',413);data+=part;}return data?JSON.parse(data):{};}
function json(res,status,data){res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.end(JSON.stringify(data));}
export default async function handler(req,res){
 res.setHeader('Cache-Control','private, no-store');res.setHeader('X-Content-Type-Options','nosniff');
 try{
  const url=new URL(req.url,'https://'+(req.headers.host||'localhost'));
  const route=String((Array.isArray(req.query?.route)?req.query.route.join('/'):req.query?.route)||url.searchParams.get('route')||url.pathname.replace(/^\/api\/?/,'')).replace(/^\/+|\/+$/g,'');
  const method=req.method;
  if(method==='GET'&&route==='locations'){const options=await geographyOptions(url.searchParams.get('country'),url.searchParams.get('state'));res.setHeader('Cache-Control','public, max-age=86400');return json(res,200,options);}
  if(method==='GET'&&route==='catalog'){const {data}=await getCatalog();res.setHeader('Cache-Control','public, max-age=0, s-maxage=30, stale-while-revalidate=60');return json(res,200,publicCatalog(data,new Date(),await readClickCounts()));}
  if(method==='GET'&&route==='admin/status'){const auth=await readRecord('admin.json');let loggedIn=false;try{await requireAdmin(req);loggedIn=true;}catch{}return json(res,200,{configured:configured(),initialized:Boolean(auth),loggedIn,setupReady:await setupReady()});}
  if(method==='GET'&&route==='admin/catalog'){await requireAdmin(req);const {data,etag}=await getCatalog();return json(res,200,{...data,revision:etag});}
  if(method==='GET'&&route==='store-logo'){
   const id=url.searchParams.get('id');if(!/^[a-f0-9-]{36}$/.test(id||''))fail('Logo não encontrada.',404);
   const {data}=await getCatalog();const approved=publicCatalog(data).stores.some(s=>s.logo===logoPath(id));
   if(!approved){try{await requireAdmin(req)}catch{fail('Logo não encontrada.',404)}}
   const record=await readRecord(`logos/${id}.json`);if(!record)fail('Logo não encontrada.',404);
   res.setHeader('Content-Type','image/webp');res.setHeader('Cache-Control',approved?'public, max-age=60':'private, no-store');return res.end(Buffer.from(record.data.base64,'base64'));
  }
  if(method==='GET'&&route==='media'){const path=url.searchParams.get('path');if(!/^images\/[a-zA-Z0-9._-]+\.(png|jpg|jpeg|webp)$/.test(path||''))fail('Imagem não encontrada.',404);const blob=await get(path,{access:'private'});if(!blob)fail('Imagem não encontrada.',404);res.setHeader('Content-Type',blob.blob.contentType);res.setHeader('Cache-Control','public, max-age=86400');return Readable.fromWeb(blob.stream).pipe(res);}
  if(method==='GET'&&route==='download'){const {data}=await getCatalog();const p=data.products.find(p=>p.id===url.searchParams.get('id')&&p.published);if(!p||p.access!=='site'||p.exclusive||!p.filePath)fail('Arquivo não disponível para download direto.',404);const blob=await get(p.filePath,{access:'private',useCache:false});if(!blob)fail('Arquivo ainda não enviado.',404);res.setHeader('Content-Type','application/octet-stream');res.setHeader('Content-Disposition',`attachment; filename="${p.slug}.${p.filePath.split('.').pop()}"`);return Readable.fromWeb(blob.stream).pipe(res);}
  if(!['POST','PUT','DELETE'].includes(method))fail('Rota não encontrada.',404);
  assertOrigin(req);
  const input=await body(req);
  if(method==='POST'&&route==='products/click'){
   if(!configured())return json(res,200,{ok:true});
   if(typeof input.id!=='string'||!/^[a-z0-9][a-z0-9-]{0,99}$/.test(input.id))fail('Obra inválida.');
   const {data}=await getCatalog();if(!publicCatalog(data).products.some(p=>p.id===input.id))fail('Obra não encontrada.',404);
   await recordProductClick(req,input.id);return json(res,200,{ok:true});
  }
  if(method==='POST'&&route==='admin/setup'){
   if(!configured()||!await setupReady())fail('A administração ainda não foi configurada.',503);
   await rateLimit(req,'setup',5,15*60_000);
   if(await readRecord('admin.json'))fail('A administração já foi configurada.',409);
   if(!await verifySetupToken(input.token))fail('Código de configuração inválido.',403);
   if(typeof input.password!=='string'||input.password.length<12||input.password.length>200)fail('Use uma senha de 12 a 200 caracteres.');
   if(typeof input.email!=='string'||!/^\S+@\S+\.\S+$/.test(input.email))fail('Informe seu e-mail.');
   const admin={email:input.email.trim().toLowerCase(),hash:await passwordHash(input.password),version:randomUUID(),createdAt:new Date().toISOString()};await writeRecord('admin.json',admin,null);res.setHeader('Set-Cookie',sessionCookie(await makeSession(admin.version)));return json(res,201,{ok:true});
  }
  if(method==='POST'&&route==='admin/login'){await rateLimit(req,'login',8,15*60_000);const auth=await readRecord('admin.json');if(typeof input.password!=='string'||input.password.length>200||!auth||!safeEqual(input.email?.trim().toLowerCase(),auth.data.email)||!await verifyPassword(input.password,auth.data.hash))fail('E-mail ou senha incorretos.',401);res.setHeader('Set-Cookie',sessionCookie(await makeSession(auth.data.version)));return json(res,200,{ok:true});}
  if(method==='POST'&&route==='admin/logout'){res.setHeader('Set-Cookie',sessionCookie('',true));return json(res,200,{ok:true});}
  if(method==='POST'&&route==='stores/apply'){
   if(input.honeypot)return json(res,201,{ok:true});await rateLimit(req,'store-application',3,3600_000);
   const parsed=await normalizeStoreLocation(applicationSchema.parse(input));const {data}=await getCatalog();if(!data.settings.storesOpen)fail('Os cadastros estão temporariamente fechados.',409);
   if(parsed.productIds.some(id=>!data.products.some(p=>p.id===id&&p.published)))fail('Selecione obras válidas.');
   const {logoData,...details}=parsed;const logo=logoData?await encodeLogo(logoData):null;
   const entry={...details,id:randomUUID(),status:'pending',licenseProof:'',licenseUntil:'',createdAt:new Date().toISOString()};delete entry.honeypot;entry.logo=logo?await saveLogo(randomUUID(),logo):'';
   for(let attempt=0;attempt<5;attempt++){const current=await getCatalog();try{current.data.stores.push(entry);await writeRecord('catalog.json',current.data,current.etag);return json(res,201,{ok:true});}catch(e){if(!(e instanceof Conflict)||attempt===4)throw e;}}
  }
  await requireAdmin(req);
  if(method==='POST'&&route==='admin/upload'){
   if(!process.env.BLOB_READ_WRITE_TOKEN)fail('Uploads exigem o armazenamento Vercel Blob conectado.',503);
   const kind=input.kind;const extension=String(input.name||'').split('.').pop().toLowerCase();const allowed=kind==='image'?['jpg','jpeg','png','webp']:['stl','3mf','zip','pdf'];if(!allowed.includes(extension))fail('Formato não permitido.');
   if(typeof input.base64!=='string'||input.base64.length>3_800_000)fail('Envie arquivos de até 2,8 MB. Para arquivos maiores, use um link de download protegido.',413);
   const bytes=Buffer.from(input.base64,'base64');if(!bytes.length||bytes.length>2_800_000)fail('Arquivo vazio ou maior que 2,8 MB.',413);
   const path=`${kind==='image'?'images':'models'}/${randomUUID()}.${extension}`;
   const mime={jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',pdf:'application/pdf'}[extension]||'application/octet-stream';
   await put(path,bytes,{access:'private',addRandomSuffix:false,contentType:mime});return json(res,201,{path,url:kind==='image'?`/api/media?path=${encodeURIComponent(path)}`:null});
  }
  if(route==='admin/settings'&&method==='PUT'){const parsed=settingsSchema.parse(input.settings);const current=await getCatalog();if(current.etag!==input.revision)throw new Conflict();current.data.settings=parsed;current.data.updatedAt=new Date().toISOString();const revision=await writeRecord('catalog.json',current.data,current.etag);return json(res,200,{ok:true,revision});}
  const kind=route.replace('admin/','');if(!schemas[kind]||!['PUT','DELETE'].includes(method))fail('Rota não encontrada.',404);
  const current=await getCatalog();if(current.etag!==input.revision)throw new Conflict();
  if(method==='DELETE'){
   if(kind==='collections'&&current.data.products.some(p=>p.collection===input.id))fail('Mova as obras antes de excluir esta coleção.');
   current.data[kind]=current.data[kind].filter(item=>item.id!==input.id);
  }else{let parsed=schemas[kind].parse(input.item);if(kind==='stores'){parsed=await normalizeStoreLocation(parsed);if(input.logoData)parsed.logo=await saveLogo(randomUUID(),await encodeLogo(input.logoData));}if(kind==='stores'&&parsed.status==='approved'){const paid=parsed.productIds.some(id=>!current.data.products.some(p=>p.id===id&&p.collection==='presepio'));if(paid&&(!parsed.licenseProof||!parsed.licenseUntil))fail('Para obras fora do presépio, registre a autorização e sua validade.');}if(kind==='products'){
   if(!current.data.collections.some(c=>c.id===parsed.collection))fail('Coleção não encontrada.');
   if(parsed.collection==='presepio'&&parsed.access==='members')fail('O presépio é gratuito e não pode exigir assinatura.');
   if(current.data.products.some(p=>p.id!==parsed.id&&p.slug===parsed.slug))fail('Já existe uma obra com este endereço.');
  }const index=current.data[kind].findIndex(item=>item.id===parsed.id);if(index<0)current.data[kind].push(parsed);else current.data[kind][index]=parsed;}
  current.data.updatedAt=new Date().toISOString();const revision=await writeRecord('catalog.json',current.data,current.etag);return json(res,200,{ok:true,revision});
 }catch(error){const status=error.status|| (error.name==='ZodError'||error instanceof SyntaxError?400:500);if(status===500)console.error('API failure',error.name,error.code||'internal');return json(res,status,{...(error.code==='INVALID_LOGO'?{code:'INVALID_LOGO'}:{}),error:status===500?'Não foi possível concluir. Tente novamente.':error.issues?.map(i=>i.message).join(' ')||error.message});}
}
