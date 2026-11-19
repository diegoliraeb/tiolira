import {canReadMediaKit,isMediaKitAdmin,mediaKitKey,mediaKitDenied,mediaKitHeaders} from '../../server/media-kit-access.mjs';
import {activeMediaKit} from '../../server/media-kit-storage.mjs';
import {renderMediaKit} from '../../server/media-kit-render.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request){
 const url=new URL(request.url),key=url.searchParams.get('key');
 try{
  if(!await canReadMediaKit(key)){
   if(!key&&await isMediaKitAdmin(request))return new Response(null,{status:303,headers:{...mediaKitHeaders,Location:`/midia-kit?key=${await mediaKitKey()}`}});
   return mediaKitDenied();
  }
  const active=await activeMediaKit();
  if(!active?.content)return new Response('Apresentação em preparação.',{status:503,headers:mediaKitHeaders});
  return new Response(renderMediaKit(key,active.content),{headers:{...mediaKitHeaders,'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':"default-src 'none'; img-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"}});
 }catch{return new Response('Mídia kit temporariamente indisponível.',{status:503,headers:mediaKitHeaders});}
}
