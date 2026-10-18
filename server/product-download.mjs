import {get} from '@vercel/blob';
import {Readable} from 'node:stream';
import {isPaidProduct,purchaseAccess,recordDownload} from './commerce.mjs';
import {resolveProductFile} from '../lib/print-profiles.mjs';
const fail=(message,status)=>{throw Object.assign(new Error(message),{status});};
export async function serveProductDownload({member,data,productId,profileId,res},{readBlob=get,hasAccess=purchaseAccess,record=recordDownload}={}){
 const product=data.products.find(p=>p.id===productId&&p.published);
 if(!product||!['site','paid'].includes(product.access)||product.exclusive||!data.collections.some(c=>c.id===product.collection&&c.published))fail('Arquivo não disponível para download direto.',404);
 if(isPaidProduct(product)&&!await hasAccess(member,product.id))fail('Compre esta peça para liberar o download.',403);
 const file=resolveProductFile(product,profileId);
 if(!file)fail('Perfil de impressão não disponível.',404);
 const blob=await readBlob(file.filePath,{access:'private',useCache:false});
 if(!blob?.stream)fail('Arquivo ainda não enviado.',404);
 await record(member,product);
 const suffix=file.id==='original'?'':`-${file.id}`;
 const name=`${product.slug}${suffix}.${file.filePath.split('.').pop()}`.replace(/[^a-zA-Z0-9._-]/g,'-');
 res.setHeader('Content-Type','application/octet-stream');
 res.setHeader('Content-Disposition',`attachment; filename="${name}"`);
 res.setHeader('Cache-Control','private, no-store');
 return Readable.fromWeb(blob.stream).pipe(res);
}
