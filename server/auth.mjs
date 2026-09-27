import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHmac, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { readRecord, updateRecord } from './store.mjs';
const scrypt=promisify(scryptCallback);
export const cookieName='tiolira_admin';
export async function passwordHash(password){const salt=randomBytes(16).toString('hex');const key=await scrypt(password,salt,64,{N:16384,r:8,p:1});return `${salt}:${key.toString('hex')}`;}
export async function verifyPassword(password,encoded){if(typeof encoded!=='string')return false;const [salt,hash]=encoded.split(':');if(!salt||!hash||hash.length!==128)return false;const key=await scrypt(password,salt,64,{N:16384,r:8,p:1});return timingSafeEqual(Buffer.from(hash,'hex'),key);}
export function safeEqual(a,b){const x=Buffer.from(String(a??'')),y=Buffer.from(String(b??''));return x.length===y.length&&timingSafeEqual(x,y);}
export async function securityConfig(){
 const saved=(await readRecord('security.json'))?.data;
 return {sessionSecret:process.env.ADMIN_SESSION_SECRET||saved?.sessionSecret,setupToken:process.env.ADMIN_SETUP_TOKEN,setupTokenHash:saved?.setupTokenHash};
}
export async function securityReady(){const c=await securityConfig();return Boolean(c.sessionSecret?.length>=32);}
export async function setupReady(){const c=await securityConfig();return Boolean(c.sessionSecret?.length>=32&&(c.setupToken?.length>=32||c.setupTokenHash));}
export async function verifySetupToken(value){const c=await securityConfig();if(c.setupToken?.length>=32)return safeEqual(value,c.setupToken);return typeof value==='string'&&value.length<=200&&Boolean(c.setupTokenHash)&&safeEqual(createHash('sha256').update(value).digest('hex'),c.setupTokenHash);}
async function secret(){const c=await securityConfig();if(!c.sessionSecret||c.sessionSecret.length<32)throw Object.assign(new Error('Configure a chave de segurança da administração.'),{status:503});return c.sessionSecret;}
export async function makeSession(version){const body=Buffer.from(JSON.stringify({version,expires:Date.now()+8*3600_000,nonce:randomBytes(16).toString('hex')})).toString('base64url');return `${body}.${createHmac('sha256',await secret()).update(body).digest('base64url')}`;}
export async function decodeSession(token){try{const [body,sig]=String(token||'').split('.');if(!safeEqual(sig,createHmac('sha256',await secret()).update(body).digest('base64url')))return null;const data=JSON.parse(Buffer.from(body,'base64url'));return data.expires>Date.now()?data:null;}catch{return null;}}
export async function requireAdmin(req){const cookies=Object.fromEntries(String(req.headers.cookie||'').split(';').map(c=>c.trim().split('=')));const session=await decodeSession(cookies[cookieName]);const auth=await readRecord('admin.json');if(!session||!auth||session.version!==auth.data.version)throw Object.assign(new Error('Entre na administração para continuar.'),{status:401});return auth.data;}
export function sessionCookie(token,clear=false){return `${cookieName}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${clear?0:28800}${process.env.VERCEL?'; Secure':''}`;}
export function assertOrigin(req){const origin=req.headers.origin;const host=req.headers.host;let valid=false;try{valid=Boolean(origin)&&new URL(origin).host===host;}catch{}if(!valid)throw Object.assign(new Error('Origem da solicitação inválida.'),{status:403});}
export async function rateLimit(req,kind,max,windowMs){
 const ip=process.env.VERCEL?String(req.headers['x-forwarded-for']||'unknown').split(',')[0]:req.socket?.remoteAddress||'local';
 const bucket=Math.floor(Date.now()/windowMs);const hash=createHmac('sha256',await secret()).update(`${kind}:${ip}`).digest('hex');
 await updateRecord(`limits/${hash}.json`,old=>{if(old?.expires<=Date.now())old=null;if((old?.count||0)>=max)throw Object.assign(new Error('Muitas tentativas. Aguarde antes de tentar novamente.'),{status:429});return {count:(old?.count||0)+1,expires:(bucket+1)*windowMs};});
}
