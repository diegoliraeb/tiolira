'use client';
import {useEffect,useRef,useState} from 'react';

export default function AdminFileAudit({products}){
 const [results,setResults]=useState([]),[busy,setBusy]=useState(false),[current,setCurrent]=useState('');
 const controller=useRef(null);
 useEffect(()=>()=>controller.current?.abort(),[]);
 const files=products.filter(p=>p.published&&p.filePath&&['site','paid'].includes(p.access));
 async function verify(){
  if(controller.current)return;
  const abort=new AbortController();controller.current=abort;setResults([]);setBusy(true);
  try{for(const p of files){
   if(abort.signal.aborted)break;
   setCurrent(p.name);
   try{const response=await fetch(`/api/admin/files/verify?id=${encodeURIComponent(p.id)}`,{cache:'no-store',signal:abort.signal}),result=await response.json();if(!response.ok)throw Error(result.error||'Não foi possível verificar.');setResults(rows=>[...rows,result]);}
   catch(error){if(abort.signal.aborted)break;setResults(rows=>[...rows,{id:p.id,name:p.name,ok:false,error:error.message}]);}
  }}finally{controller.current=null;setBusy(false);setCurrent('');}
 }
 return <section className="admin-panel" aria-label="Verificação dos arquivos"><h2>Verificação dos arquivos</h2><p>Confira se os arquivos 3MF publicados podem ser lidos por completo e estão íntegros.</p><button className="button outline" disabled={busy||!files.length} onClick={verify}>{busy?'Verificando arquivos…':'Verificar arquivos 3MF'}</button><p role="status">{busy?`${results.length} de ${files.length} verificados · ${current}`:results.length?`${results.filter(r=>r.ok).length} de ${results.length} arquivos íntegros.`:''}</p>{results.length>0&&<ul>{results.map(r=><li key={r.id}><strong>{r.name}</strong> — {r.ok?`Íntegro · ${(r.bytes/1000000).toLocaleString('pt-BR',{maximumFractionDigits:1})} MB`:r.error}</li>)}</ul>}</section>;
}
