'use client';
import {useEffect,useState} from 'react';
import {dictionaries} from '../lib/i18n';
export default function ClubDownloadButton({lang,downloadUrl,label,loginLabel}){
 const [loggedIn,setLoggedIn]=useState(false),[ready,setReady]=useState(false);
 useEffect(()=>{fetch('/api/club/me').then(r=>setLoggedIn(r.ok)).catch(()=>{}).finally(()=>setReady(true))},[]);
 const currentPath=typeof window==='undefined'?'':window.location.pathname;
 const href=loggedIn?downloadUrl:`/${lang}/clube?returnTo=${encodeURIComponent(currentPath)}`;
 const translatedLogin=loginLabel||dictionaries[lang]?.clubDownloadLogin||'Entrar no Clube para baixar';
 const external=loggedIn&&/^https?:\/\//.test(downloadUrl);
 return <a className="button primary" href={href} target={external?'_blank':undefined} rel={external?'noreferrer':undefined}>{ready&&loggedIn?label:translatedLogin}{loggedIn?(external?' ↗':' ↓'):' →'}</a>;
}
