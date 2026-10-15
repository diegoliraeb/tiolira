import {get} from '@vercel/blob';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';

export async function serveCatalogImage(path,res,readBlob=get){
 if(!/^images\/[a-zA-Z0-9._-]+\.(png|jpg|jpeg|webp)$/.test(path||''))throw Object.assign(new Error('Imagem não encontrada.'),{status:404});
 let blob;
 try{blob=await readBlob(path,{access:'private',useCache:false});}
 catch(error){
  // Keep storage credentials and signed URLs out of operational logs.
  const message=String(error.message||'').replace(/https?:\/\/\S+/g,'[url]').replace(/(?:vercel_blob_rw_|Bearer )[\S]+/g,'[credential]').replace(/eyJ[A-Za-z0-9_.-]+/g,'[token]');
  console.error('Catalog image storage failure',message.slice(0,400));
  throw error;
 }
 if(!blob?.stream)throw Object.assign(new Error('Imagem não encontrada.'),{status:404});
 res.setHeader('Content-Type',blob.blob.contentType);
 res.setHeader('Cache-Control','public, max-age=86400, s-maxage=86400');
 await pipeline(Readable.fromWeb(blob.stream),res);
}
