'use client';
import {useRef,useState} from 'react';
import {uploadPresigned} from '@vercel/blob/client';
export default function ModelUpload({value='',onChange,onBusyChange,disabled=false}){
 const input=useRef(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[progress,setProgress]=useState(0);
 async function choose(e){
  const file=e.target.files?.[0];setError('');if(!file)return;
  const extension=file.name.split('.').pop()?.toLowerCase();
  if(!['stl','3mf','zip','pdf'].includes(extension)||file.size>100_000_000){setError('Envie STL, 3MF, ZIP ou PDF de até 100 MB.');e.target.value='';return;}
  setBusy(true);setProgress(0);onBusyChange?.(true);
  try{
   const path=`models/${crypto.randomUUID()}.${extension}`;
   const blob=await uploadPresigned(path,file,{access:'private',handleUploadUrl:'/api/blob-upload',multipart:file.size>5_000_000,onUploadProgress:event=>setProgress(event.percentage||0)});
   onChange(blob.pathname);
  }catch(error){setError(/client token/i.test(String(error?.message))?'Conecte o Vercel Blob ao projeto e faça um novo deploy.':error.message||'Não foi possível enviar o arquivo.')}finally{setBusy(false);onBusyChange?.(false)}
 }
 return <div className="logo-upload full"><label>Arquivo privado do Clube<input ref={input} type="file" accept=".stl,.3mf,.zip,.pdf" disabled={disabled||busy} onChange={choose}/></label><p className="field-help">Envie o arquivo diretamente para o armazenamento privado. Limite atual: 100 MB.</p>{busy&&<p role="status">Enviando arquivo... {Math.round(progress)}%</p>}{value&&<div className="model-upload-current"><strong>Arquivo salvo no armazenamento privado</strong><code>{value}</code><button type="button" className="text-link" disabled={disabled||busy} onClick={()=>{onChange('');if(input.current)input.current.value=''}}>Remover arquivo</button></div>}{error&&<p className="error-text" role="alert">{error}</p>}</div>;
}
