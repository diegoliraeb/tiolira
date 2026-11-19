import {mediaKitFile} from '../../../server/media-kit-storage.mjs';
import {canReadMediaKit,mediaKitDenied,mediaKitHeaders} from '../../../server/media-kit-access.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request){
 try{
  if(!await canReadMediaKit(new URL(request.url).searchParams.get('key')))return mediaKitDenied();
  const file=await mediaKitFile('Tio-Lira-Midia-Kit.pdf');if(!file||file.statusCode!==200)return mediaKitDenied();
  return new Response(file.stream,{headers:{...mediaKitHeaders,'Content-Type':'application/pdf','Content-Disposition':'attachment; filename="Tio-Lira-Midia-Kit.pdf"'}});
 }catch{return mediaKitDenied();}
}
