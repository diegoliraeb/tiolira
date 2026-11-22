import {randomUUID,createHmac} from 'node:crypto';
import {securityConfig,safeEqual,rateLimit} from './auth.mjs';
import {readRecord,updateRecord} from './store.mjs';
import {POLL_ID,addBallot,pollResults,validateChoices} from '../lib/click-sanctis-poll.mjs';
const key=`polls/${POLL_ID}.json`,cookieName='tiolira_poll_sanctis_2';
async function signingSecret(){const {sessionSecret}=await securityConfig();if(!sessionSecret||sessionSecret.length<32)throw Object.assign(Error('Votação temporariamente indisponível.'),{status:503});return sessionSecret;}
export function signVoter(id,secret){return `${id}.${createHmac('sha256',secret).update(`${POLL_ID}:${id}`).digest('base64url')}`;}
export function verifyVoter(token,secret){if(typeof token!=='string'||token.length>160)return null;const [id]=token.split('.');return /^[0-9a-f-]{36}$/.test(id)&&safeEqual(token,signVoter(id,secret))?id:null;}
async function identity(req,res,create=false){
 const secret=await signingSecret(),token=String(req.headers.cookie||'').split(';').map(c=>c.trim()).find(c=>c.startsWith(cookieName+'='))?.slice(cookieName.length+1);
 let id=verifyVoter(token,secret);
 if(!id&&create){id=randomUUID();res.setHeader('Set-Cookie',`${cookieName}=${signVoter(id,secret)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=31536000${process.env.VERCEL?'; Secure':''}`);}
 if(!id)throw Object.assign(Error('Ative os cookies e recarregue a página para votar.'),{status:400});
 return createHmac('sha256',secret).update(`ballot:${id}`).digest('hex');
}
export async function readPoll(req,res){const voter=await identity(req,res,true);return pollResults((await readRecord(key))?.data,voter);}
export async function votePoll(req,res,input){
 const choices=validateChoices(input.choices),voter=await identity(req,res);
 await rateLimit(req,'sanctis-poll-vote',20,600_000);
 await rateLimit(req,'sanctis-poll-voter',5,600_000,voter);
 const state=await updateRecord(key,old=>addBallot(old,voter,choices));
 return pollResults(state,voter);
}
