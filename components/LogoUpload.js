'use client';
import {useEffect,useId,useRef,useState} from 'react';
import {dictionaries} from '../lib/i18n';
export default function LogoUpload({lang='pt',value='',onChange,onBusyChange,disabled=false}){
 const t=dictionaries[lang],helpId=useId(),input=useRef(null),sequence=useRef(0),[error,setError]=useState(''),[reading,setReading]=useState(false);
 useEffect(()=>()=>{sequence.current++;onBusyChange?.(false)},[onBusyChange]);
 async function choose(e){
  const file=e.target.files?.[0],version=++sequence.current;setError('');
  if(!file)return;
  if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>2*1024*1024){setError(t.logoError);e.target.value='';return;}
  setReading(true);onBusyChange?.(true);
  try{
   const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file)});
   const image=new Image();image.src=data;await image.decode();
   if(image.naturalWidth*image.naturalHeight>16_000_000)throw Error();
   if(sequence.current===version)onChange(data);
  }catch{if(sequence.current===version){setError(t.logoError);input.current.value=''}}
  finally{if(sequence.current===version){setReading(false);onBusyChange?.(false)}}
 }
 return <div className="logo-upload full"><label>{t.logoLabel}<input ref={input} type="file" accept="image/png,image/jpeg,image/webp" disabled={disabled||reading} onChange={choose} aria-describedby={helpId}/></label><p id={helpId} className="field-help">{t.logoHelp}</p>{reading&&<p role="status">{t.loading}</p>}{value&&<div className="logo-upload-preview"><img src={value} alt={t.logoPreview}/><button type="button" className="text-link" disabled={disabled||reading} onClick={()=>{sequence.current++;onChange('');input.current.value='';setError('')}}>{t.removeLogo}</button></div>}{error&&<p className="error-text" role="alert">{error}</p>}</div>;
}
