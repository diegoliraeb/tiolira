import sharp from 'sharp';
import {readRecord,writeRecord} from './store.mjs';
export const maxLogoBytes=2*1024*1024;
export const logoPath=id=>`/api/store-logo?id=${id}`;
const invalid=()=>Object.assign(new Error('Envie uma logo PNG, JPG ou WebP válida, de até 2 MB.'),{status:400,code:'INVALID_LOGO'});
export async function encodeLogo(dataUrl){
 if(typeof dataUrl!=='string'||dataUrl.length>2_800_000)throw invalid();
 const match=/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl);
 if(!match)throw invalid();
 const bytes=Buffer.from(match[2],'base64');if(!bytes.length||bytes.length>maxLogoBytes)throw invalid();
 try{
  const image=sharp(bytes,{limitInputPixels:16_000_000,failOn:'warning'}),meta=await image.metadata();
  if(!['png','jpeg','webp'].includes(meta.format)||(meta.pages||1)>1)throw invalid();
  const output=await image.rotate().resize({width:512,height:512,fit:'inside',withoutEnlargement:true}).webp({quality:85}).toBuffer();
  if(output.length>256*1024)throw invalid();
  return {contentType:'image/webp',base64:output.toString('base64')};
 }catch{throw invalid()}
}
export async function saveLogo(id,encoded){
 const key=`logos/${id}.json`,current=await readRecord(key);
 await writeRecord(key,encoded,current?.etag);return logoPath(id);
}
