import {mediaKitFile} from '../../../../server/media-kit-storage.mjs';
import {canReadMediaKit,mediaKitDenied,mediaKitHeaders,mediaKitAssetNames} from '../../../../server/media-kit-access.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request,{params}){
 try{
  const {name}=await params;
  if(!mediaKitAssetNames.has(name)||!await canReadMediaKit(new URL(request.url).searchParams.get('key')))return mediaKitDenied();
  const file=await mediaKitFile(name);if(!file||file.statusCode!==200)return mediaKitDenied();
  return new Response(file.stream,{headers:{...mediaKitHeaders,'Content-Type':name.endsWith('.png')?'image/png':'image/jpeg'}});
 }catch{return mediaKitDenied();}
}
