'use client';
import {useRef,useState} from 'react';
import {upload} from '@vercel/blob/client';

const MAX_IMAGES=20;
const MAX_FILE_SIZE=10_000_000;
const MIME_EXTENSIONS={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'};

export default function GalleryUpload({value=[],onChange,onBusyChange,disabled=false}){
 const input=useRef(null),images=Array.isArray(value)?value:[];
 const [error,setError]=useState(''),[busy,setBusy]=useState(false),[progress,setProgress]=useState(0);
 async function choose(e){
  const files=Array.from(e.target.files||[]);setError('');if(!files.length)return;
  if(images.length+files.length>MAX_IMAGES){setError(`A galeria pode ter até ${MAX_IMAGES} fotos.`);e.target.value='';return;}
  if(files.some(file=>!MIME_EXTENSIONS[file.type]||file.size>MAX_FILE_SIZE)){setError('Envie fotos JPG, PNG ou WEBP de até 10 MB cada.');e.target.value='';return;}
  setBusy(true);setProgress(0);onBusyChange?.(true);
  const uploaded=[];
  try{
   for(let index=0;index<files.length;index++){
    const file=files[index],extension=MIME_EXTENSIONS[file.type],path=`images/${crypto.randomUUID()}.${extension}`;
    const blob=await upload(path,file,{access:'private',handleUploadUrl:'/api/blob-upload',onUploadProgress:event=>setProgress(((index+(event.percentage||0)/100)/files.length)*100)});
    uploaded.push(`/api/media?path=${encodeURIComponent(blob.pathname)}`);onChange([...images,...uploaded]);
   }
   if(input.current)input.current.value='';
  }catch(error){setError(/client token/i.test(String(error?.message))?'Conecte o Vercel Blob ao projeto e faça um novo deploy.':error.message||'Não foi possível enviar a foto.');}
  finally{setBusy(false);onBusyChange?.(false)}
 }
 function remove(index){onChange(images.filter((_,itemIndex)=>itemIndex!==index));setError('');}
 return <div className="logo-upload full gallery-upload"><label>Fotos da galeria<input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={disabled||busy||images.length>=MAX_IMAGES} onChange={choose}/></label><p className="field-help">Selecione várias fotos para a página da obra. Até 20 fotos, com 10 MB por foto.</p>{busy&&<p role="status">Enviando fotos... {Math.round(progress)}%</p>}{images.length>0&&<div className="gallery-upload-grid">{images.map((image,index)=><div className="gallery-upload-item" key={`${image}-${index}`}><img src={image} alt={`Foto ${index+1} da galeria`}/><button type="button" className="text-link" disabled={disabled||busy} onClick={()=>remove(index)}>Remover</button></div>)}</div>}{error&&<p className="error-text" role="alert">{error}</p>}</div>;
}
