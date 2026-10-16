import {trafficSource} from './activity.mjs';
let fallbackSession=null;
export function trackActivity(input){
 try{
  if(navigator.doNotTrack==='1'||navigator.globalPrivacyControl===true)return;
  const key='tiolira-visit-v1',now=Date.now();let session;
  try{session=JSON.parse(sessionStorage.getItem(key));}catch{session=fallbackSession;}
  if(!session||now-session.lastAt>30*60_000){const q=new URLSearchParams(location.search);session={id:crypto.randomUUID(),source:trafficSource(document.referrer,q.get('utm_source'),location.hostname)};if(session.source==='internal')session.source='direct';}
  session.lastAt=now;fallbackSession=session;try{sessionStorage.setItem(key,JSON.stringify(session));}catch{}
  fetch('/api/analytics/event',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...input,eventId:crypto.randomUUID(),sessionId:session.id,source:session.source,device:innerWidth<=600?'mobile':innerWidth<=1024?'tablet':'desktop'}),keepalive:true}).catch(()=>{});
 }catch{}
}
