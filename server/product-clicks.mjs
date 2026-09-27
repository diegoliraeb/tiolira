import {createHmac} from 'node:crypto';
import {readRecord,updateRecord} from './store.mjs';
import {securityConfig} from './auth.mjs';

const key='analytics/product-clicks.json';
export async function readClickCounts(){return (await readRecord(key))?.data.counts||{};}

export async function recordProductClick(req,id){
 const {sessionSecret}=await securityConfig();
 if(!sessionSecret)return;
 const agent=String(req.headers['user-agent']||'').slice(0,500);
 if(/bot|crawler|spider|preview/i.test(agent))return;
 const ip=process.env.VERCEL?String(req.headers['x-forwarded-for']||'unknown').split(',')[0].trim():req.socket?.remoteAddress||'local';
 // Keep only a keyed hash for short-lived deduplication; never store the raw IP.
 const visitor=createHmac('sha256',sessionSecret).update(`${id}:${ip}:${agent}`).digest('hex');
 const now=Date.now();
 const current=(await readRecord(key))?.data;
 if(current?.recent?.[visitor]>now)return;
 await updateRecord(key,old=>{
  const counts={...old?.counts},recent=Object.fromEntries(Object.entries(old?.recent||{}).filter(([,expires])=>expires>now));
  if(!recent[visitor]&&Object.keys(recent).length<10000){counts[id]=(counts[id]||0)+1;recent[visitor]=now+30*60_000;}
  return {counts,recent};
 });
}
