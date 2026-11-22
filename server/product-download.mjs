import {subscriptionDashboard} from './maker-subscriptions.mjs';
import {canDownloadProduct,isSubscriptionProduct} from '../lib/subscriber-access.mjs';
import {get} from '@vercel/blob';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {prepareTracedCopy} from './three-mf-copy.mjs';
import {isPaidProduct,memberHasAccess,recordDownload} from './commerce.mjs';
import {resolveProductFile} from '../lib/print-profiles.mjs';
const fail=(message,status)=>{throw Object.assign(new Error(message),{status});};
export async function serveProductDownload({member,data,productId,profileId,res},{readBlob=get,hasAccess=memberHasAccess,record=recordDownload,subscription=subscriptionDashboard,prepare=prepareTracedCopy}={}){
 const product=data.products.find(p=>p.id===productId&&p.published);
 if(!product||!['site','paid','subscribers'].includes(product.access)||product.exclusive||!data.collections.some(c=>c.id===product.collection&&c.published))fail('Arquivo não disponível para download direto.',404);
 const owned=(isPaidProduct(product)||product.access==='subscribers')&&await hasAccess(member,product.id);
 const annual=isSubscriptionProduct(product)&&!owned&&(await subscription(member)).active===true;
 if(!canDownloadProduct(product,{owned,annual}))fail(isSubscriptionProduct(product)?'Assine ou compre esta obra para liberar o download.':'Compre esta peça para liberar o download.',403);
 const file=resolveProductFile(product,profileId);
 if(!file)fail('Perfil de impressão não disponível.',404);
 const blob=await readBlob(file.filePath,{access:'private',useCache:false});
 if(!blob?.stream)fail('Arquivo ainda não enviado.',404);
 const suffix=file.id==='original'?'':`-${file.id}`;
 const name=`${product.slug}${suffix}.${file.filePath.split('.').pop()}`.replace(/[^a-zA-Z0-9._-]/g,'-');
 let copy;
 try{
  // No fallback to an unmarked 3MF: recording must succeed before any bytes leave.
  if(/\.3mf$/i.test(file.filePath))copy=await prepare({stream:blob.stream,member,product,file});
  await record(member,product);
  res.setHeader('Content-Type','application/octet-stream');
  res.setHeader('Content-Disposition',`attachment; filename="${name}"`);
  res.setHeader('Cache-Control','private, no-store');
  if(copy)res.setHeader('X-TioLira-Download-Code',copy.id);
  // Streaming avoids the platform's buffered-response size limit.
  await pipeline(copy?copy.stream:Readable.fromWeb(blob.stream),res);
  if(copy)await copy.finish('streamed');
 }catch(error){
  if(copy)await copy.finish('interrupted').catch(()=>{});
  if(res.headersSent||res.destroyed){if(!res.destroyed)res.destroy(error);return;}
  throw error;
 }finally{await copy?.cleanup();}
}
