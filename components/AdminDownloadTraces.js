'use client';
import {useRef,useState} from 'react';
import {inspectLocal3mf} from '../lib/three-mf-trace.mjs';

export default function AdminDownloadTraces({preview}){
 const [busy,setBusy]=useState(false),[result,setResult]=useState(null),[message,setMessage]=useState(''),[filename,setFilename]=useState('');
 const sequence=useRef(0);
 async function inspect(file){
  const turn=++sequence.current;setResult(null);setMessage('');setFilename(file?.name||'');if(!file)return;
  if(!/\.3mf$/i.test(file.name)){setMessage('Selecione um arquivo com extensão .3mf.');return;}
  setBusy(true);
  try{
   const trace=await inspectLocal3mf(file);
   if(!trace){setMessage('Nenhum código encontrado. Pode ser um arquivo anterior à ativação, baixado fora do site ou com a identificação removida.');return;}
   const response=await fetch('/api/admin/download-traces/inspect',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({trace})});
   const data=await response.json();if(!response.ok)throw new Error(data.error||'Não foi possível consultar.');
   if(turn===sequence.current){setResult(data.status==='found'?data:null);setMessage(data.message||'Código validado. Veja o cadastro vinculado à cópia.');}
  }catch(error){if(turn===sequence.current)setMessage(error.message||'Não foi possível analisar o arquivo.');}
  finally{if(turn===sequence.current)setBusy(false);}
 }
 return <div className="admin-panel">
  <p>Selecione o arquivo 3MF que você recebeu para consultar a conta à qual essa cópia foi entregue.</p>
  <label className="admin-trace-picker">Arquivo 3MF<input type="file" accept=".3mf" disabled={busy||preview} onChange={e=>inspect(e.target.files?.[0])}/></label>
  <p className="field-help">A análise acontece neste navegador. Apenas o código é enviado ao site; o modelo não é reenviado nem armazenado nesta consulta.</p>
  {preview&&<p className="notice">Entre no admin conectado para consultar os registros reais.</p>}
  {busy&&<p role="status">Analisando a identificação de {filename}…</p>}
  {message&&<p role="status" className="notice">{message}</p>}
  {result&&<article className="admin-trace-result"><h2>Cadastro vinculado</h2><dl>
   <dt>Nome</dt><dd>{result.member.name||'Não informado'}</dd>
   <dt>E-mail</dt><dd>{result.member.email||'Não informado'}</dd>
   <dt>WhatsApp / telefone</dt><dd>{result.member.whatsapp||'Não informado'}</dd>
   <dt>ID do cadastro</dt><dd>{result.member.id}</dd>
   <dt>Obra</dt><dd>{result.product.name}</dd>
   <dt>Perfil de impressão</dt><dd>{result.profile.name}</dd>
   <dt>Emissão da cópia</dt><dd>{new Date(result.createdAt).toLocaleString('pt-BR',{timeZone:'America/Maceio'})} (Maceió)</dd>
   <dt>Entrega</dt><dd>{{prepared:'Cópia preparada; conclusão não confirmada',streamed:'Envio concluído pelo servidor',interrupted:'Envio interrompido ou conclusão não confirmada'}[result.deliveryStatus]||result.deliveryStatus}</dd>
   <dt>Código</dt><dd>{result.code}</dd>
  </dl></article>}
  <p className="field-help">O código vincula uma cópia a um cadastro, mas pode ser removido ou copiado. Ele não comprova, sozinho, quem compartilhou o arquivo. Downloads antigos, arquivos exportados para STL e downloads diretos do MakerWorld não possuem este rastreamento.</p>
  <style jsx>{`
   .admin-trace-picker{display:grid;gap:12px;margin:24px 0;font-weight:600}
   input{max-width:100%;padding:16px;border:1px dashed #8a856f;border-radius:10px;background:#faf8f2}
   .admin-trace-result{margin:24px 0;padding:24px;background:#f7f5ee;border-radius:12px}
   dl{display:grid;grid-template-columns:minmax(120px,1fr) 2fr;gap:12px 24px}dt{font-weight:600}dd{margin:0;overflow-wrap:anywhere}
   @media(max-width:600px){dl{grid-template-columns:1fr;gap:6px}dd{margin-bottom:12px}.admin-trace-result{padding:16px}}
  `}</style>
 </div>;
}
