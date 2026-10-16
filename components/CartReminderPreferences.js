'use client';
import {useEffect,useState} from 'react';
import {reminderCopy} from '../lib/cart-reminder-copy.mjs';
export default function CartReminderPreferences({lang}){
 const c=reminderCopy(lang),[token,setToken]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[done,setDone]=useState(false);
 useEffect(()=>{const value=new URLSearchParams(window.location.hash.slice(1)).get('cancelar');if(value&&/^[a-f0-9]{64}\.[A-Za-z0-9_-]{43}$/.test(value))setToken(value);else setMessage(c.invalid);window.history.replaceState(null,'',window.location.pathname);},[c]);
 async function stop(){setBusy(true);setMessage('');try{const r=await fetch('/api/cart-reminders/unsubscribe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token})});if(!r.ok)throw Error(c.invalid);setDone(true);setMessage(c.stopped);}catch(e){setMessage(e.message);}finally{setBusy(false);}}
 return <main className="wrap section"><p className="eyebrow">TIO LIRA</p><h1>{c.stopTitle}</h1><p>{c.stopIntro}</p>{!done&&<button className="button primary" disabled={!token||busy} onClick={stop}>{busy?c.wait:c.stopButton}</button>}{message&&<p className="notice" role="status">{message}</p>}<p><a className="text-link" href={`/${lang}`}>{c.back} →</a></p></main>;
}
