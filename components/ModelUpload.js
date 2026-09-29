'use client';
import {useRef,useState} from 'react';
export default function ModelUpload({value='',onChange,onBusyChange,disabled=false}){
 const input=useRef(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 async function choose(e){
  const file=e.target.files?.[0];setError('');if(!file)return;
  const extension=file.name.split('.').pop()?.toLowerCase();
  if(!['stl','3mf','zip','pdf'].includes(extension)||file.size>25_000_000){setError('Envie STL, 3MF, ZIP ou PDF de até 25 MB.');e.target.value='';return;}
  setBusy(true);onBusyChange?.(true);
  try{
   const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=reject;reader.readAsDataURL(file)});
   const response=await fetch('/api/admin/upload',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind:'model',name:file.name,base64:data})});
   const result=await response.json();if(!response.ok)throw Error(result.error||'Não foi possível enviar o arquivo.');onChange(result.path);
  }catch(error){setError(error.message)}finally{setBusy(false);onBusyChange?.(false)}
 }
 return <div className="logo-upload full"><label>Arquivo privado do Clube<input ref={input} type="file" accept=".stl,.3mf,.zip,.pdf" disabled={disabled||busy} onChange={choose}/></label><p className="field-help">Envie o arquivo que será liberado somente para membros logados do Clube. Limite atual: 25 MB.</p>{busy&&<p role="status">Enviando arquivo...</p>}{value&&<div className="model-upload-current"><strong>Arquivo salvo no armazenamento privado</strong><code>{value}</code><button type="button" className="text-link" disabled={disabled||busy} onClick={()=>{onChange('');if(input.current)input.current.value=''}}>Remover arquivo</button></div>}{error&&<p className="error-text" role="alert">{error}</p>}</div>;
}
