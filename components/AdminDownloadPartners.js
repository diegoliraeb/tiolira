'use client';
import {useEffect,useRef,useState} from 'react';

const date=value=>new Date(value).toLocaleString('pt-BR',{timeZone:'America/Maceio'});

export default function AdminDownloadPartners({product,onClose}){
 const dialog=useRef(null);
 const [result,setResult]=useState(null),[error,setError]=useState(''),[attempt,setAttempt]=useState(0);
 useEffect(()=>{const element=dialog.current;element.showModal();return()=>element.close();},[]);
 useEffect(()=>{
  const controller=new AbortController();setResult(null);setError('');
  async function load(){
   try{
    const response=await fetch(`/api/admin/downloads?productId=${encodeURIComponent(product.id)}`,{signal:controller.signal});
    const data=await response.json();if(!response.ok)throw Error(data.error||'Não foi possível carregar os parceiros.');
    if(!controller.signal.aborted)setResult(data);
   }catch(error){if(!controller.signal.aborted)setError(error.message||'Não foi possível carregar os parceiros.');}
  }
  load();return()=>controller.abort();
 },[product.id,attempt]);
 return <dialog ref={dialog} className="admin-editor download-partners-dialog" aria-labelledby="download-partners-title" onCancel={event=>{event.preventDefault();onClose();}}>
  <button type="button" className="close-dialog" aria-label="Fechar parceiros dos downloads" onClick={onClose}>×</button>
  <p className="eyebrow">PARCEIROS QUE BAIXARAM</p><h2 id="download-partners-title">{product.name}</h2>
  {!result&&!error&&<p role="status">Carregando parceiros…</p>}
  {error&&<div role="alert"><p>{error}</p><button type="button" className="button outline" onClick={()=>setAttempt(value=>value+1)}>Tentar novamente</button></div>}
  {result&&<>
   <p><strong>{result.totalDownloads}</strong> downloads iniciados · <strong>{result.partners.length}</strong> parceiros identificados</p>
   <p className="field-help">Cada parceiro aparece uma vez. A quantidade inclui downloads repetidos da mesma obra. Datas no horário de Brasília.</p>
   {result.unattributedDownloads>0&&<p className="notice">{result.unattributedDownloads} downloads antigos sem identificação disponível no histórico. Os totais por parceiro abaixo consideram apenas os registros preservados.</p>}
   {result.partners.length?<div className="shop-table-wrap"><table className="shop-table download-partners-table"><thead><tr><th scope="col">Parceiro</th><th scope="col">Downloads</th><th scope="col">Último download</th></tr></thead><tbody>{result.partners.map(partner=><tr key={partner.memberId}><td><strong>{partner.memberName}</strong>{partner.memberEmail&&<small>{partner.memberEmail}</small>}</td><td>{partner.downloads}</td><td>{date(partner.lastAt)}</td></tr>)}</tbody></table></div>:<p>{result.totalDownloads?'Não há parceiros identificados nos registros disponíveis.':'Esta obra ainda não teve downloads.'}</p>}
  </>}
  <button type="button" className="button outline" onClick={onClose}>Fechar</button>
 </dialog>;
}
