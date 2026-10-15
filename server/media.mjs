import {get} from '@vercel/blob';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';

// Published image copies keep the catalog independent of private download quotas.
const catalogCopies={
 'images/e656fe5f-c279-4c91-ad21-982a53346e89.png':'/assets/catalog/nazare.webp',
 'images/15209811-5e1f-48c3-abd0-89f4de58b7db.png':'/assets/643c6e11015bd4b0.jpg',
 'images/49992931-24fc-4812-a0f4-f105035bf577.png':'/assets/catalog/saci.webp',
 'images/139f92e3-605d-4d0f-8e60-1ce64d27e828.png':'/assets/catalog/curupira.webp',
 'images/49b3db80-4f81-4cc0-8624-5292f043b16e.png':'/assets/catalog/boitata.webp',
 'images/dcccce7d-7290-4ce9-8019-ecd2fab129ec.png':'/assets/catalog/cuca.webp',
 'images/ac5a3430-75d8-4adc-9bd1-264bae0e4319.png':'/assets/catalog/mula.webp',
};

export async function serveCatalogImage(path,res,readBlob=get){
 if(!/^images\/[a-zA-Z0-9._-]+\.(png|jpg|jpeg|webp)$/.test(path||''))throw Object.assign(new Error('Imagem não encontrada.'),{status:404});
 if(catalogCopies[path]){res.statusCode=307;res.setHeader('Location',catalogCopies[path]);res.setHeader('Cache-Control','public, max-age=3600, s-maxage=86400');res.end();return;}
 let blob;
 try{blob=await readBlob(path,{access:'private'});}
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
