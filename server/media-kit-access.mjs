import {createHmac} from 'node:crypto';
import {securityConfig,safeEqual,requireAdmin} from './auth.mjs';
export const mediaKitHeaders={
 'Cache-Control':'private, no-store, max-age=0',
 'X-Robots-Tag':'noindex, nofollow, noarchive, nosnippet',
 'Referrer-Policy':'no-referrer',
 'X-Content-Type-Options':'nosniff',
 'X-Frame-Options':'DENY'
};
export function deriveMediaKitKey(secret){
 if(typeof secret!=='string'||secret.length<32)throw new Error('Mídia kit indisponível.');
 return createHmac('sha256',secret).update('tiolira:reserved-media-kit:2026:v1').digest('base64url');
}
export function matchesMediaKitKey(candidate,expected){return typeof candidate==='string'&&/^[A-Za-z0-9_-]{43}$/.test(candidate)&&safeEqual(candidate,expected);}
export async function mediaKitKey(){const {sessionSecret}=await securityConfig();return deriveMediaKitKey(sessionSecret);}
export async function canReadMediaKit(key){
 if(typeof key!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(key))return false;
 return matchesMediaKitKey(key,await mediaKitKey());
}
export async function isMediaKitAdmin(request){try{await requireAdmin({headers:{cookie:request.headers.get('cookie')||''}});return true;}catch{return false;}}
export function mediaKitDenied(){return new Response('Este link reservado não está disponível.',{status:404,headers:{...mediaKitHeaders,'Content-Type':'text/plain; charset=utf-8'}});}
export const mediaKitAssetNames=new Set(['nativity.jpg','hero.jpg','logo.png','click.jpg','assembly.jpg','easter.jpg','passion.jpg','mini.jpg','jesus.jpg','marble.jpg','heart.jpg','panetone.jpg']);
