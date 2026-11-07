'use client';
import {useEffect,useState} from 'react';
import '../app/collection-access.css';

export default function AdminCollectionAccess({preview}){
 const [search,setSearch]=useState(''),[query,setQuery]=useState(''),[memberId,setMemberId]=useState(''),[collectionId,setCollectionId]=useState('');
 const [data,setData]=useState(null),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState(''),[refresh,setRefresh]=useState(0);
 useEffect(()=>{
  if(preview){setLoading(false);return;}
  const controller=new AbortController();setLoading(true);setError('');
  fetch('/api/admin/collection-access?'+new URLSearchParams({q:query,memberId}),{signal:controller.signal,cache:'no-store'}).then(async r=>{const result=await r.json();if(!r.ok)throw Error(result.error||'Não foi possível carregar os acessos.');return result;}).then(result=>{setData(result);setLoading(false);}).catch(e=>{if(e.name!=='AbortError'){setError(e.message);setLoading(false);}});
  return()=>controller.abort();
 },[preview,query,memberId,refresh]);
 function select(id){setMemberId(id);setCollectionId('');setMessage('');setError('');}
 async function save(id,active){
  if(!data?.member||loading||saving)return;
  setSaving(true);setMessage('');setError('');
  try{
   const r=await fetch('/api/admin/collection-access',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({memberId:data.member.id,collectionId:id,active,revision:data.revision})}),result=await r.json();
   if(!r.ok)throw Error(result.error||'Não foi possível salvar.');
   setCollectionId('');setMessage(active?'Coleção liberada sem custo para este parceiro.':'Liberação revogada. Compras já pagas continuam válidas.');setRefresh(n=>n+1);
  }catch(e){setError(e.message);}finally{setSaving(false);}
 }
 if(preview)return <p className="notice">Entre na administração conectada ao site para liberar coleções aos parceiros.</p>;
 const activeIds=new Set(data?.grants.filter(g=>g.active).map(g=>g.collectionId));
 const choices=data?.collections.filter(c=>!c.free&&!activeIds.has(c.id))||[];
 const busy=loading||saving;
 return <div className="admin-access">
  <p className="notice">Escolha um parceiro cadastrado no Clube e as coleções que deseja liberar. Ele poderá baixar os arquivos e as licenças sem pagar. A liberação inclui os arquivos atuais e futuros publicados no site nessa coleção; obras exclusivas do MakerWorld continuam no MakerWorld.</p>
  <form className="admin-access-search" onSubmit={e=>{e.preventDefault();setQuery(search.trim());select('');setRefresh(n=>n+1);}}><label>Buscar parceiro por nome ou e-mail<input type="search" value={search} maxLength={200} onChange={e=>setSearch(e.target.value)} placeholder="Nome ou e-mail do parceiro" disabled={saving}/></label><button className="button outline" disabled={busy}>Buscar</button></form>
  {error&&<p role="alert" className="error-text">{error} <button className="text-link" disabled={busy} onClick={()=>setRefresh(n=>n+1)}>Recarregar</button></p>}
  {message&&<p role="status" className="notice">{message}</p>}
  {loading&&<p role="status">Carregando acessos…</p>}
  <div className="admin-access-layout"><section className="admin-access-members" aria-label="Parceiros cadastrados"><h2>Parceiros</h2>{data&&<p>{data.total} encontrado{data.total!==1?'s':''}{data.total>50?' · exibindo os primeiros 50; refine a busca':''}</p>}{data?.members.map(m=><button key={m.id} className={memberId===m.id?'selected':''} aria-pressed={memberId===m.id} disabled={busy} onClick={()=>select(m.id)}><strong>{m.name}</strong><small>{m.email}</small></button>)}{data&&!data.members.length&&<p>Nenhum parceiro encontrado. Ele precisa ter cadastro no Clube.</p>}</section>
  <section className="admin-access-detail" aria-label="Liberações do parceiro">{data?.member&&data.member.id===memberId?<><p className="eyebrow">PARCEIRO SELECIONADO</p><h2>{data.member.name}</h2><p>{data.member.email}</p>
   <form onSubmit={e=>{e.preventDefault();if(collectionId)save(collectionId,true);}}><label>Coleção para liberar<select required value={collectionId} disabled={busy} onChange={e=>setCollectionId(e.target.value)}><option value="">Escolha uma coleção</option>{choices.map(c=><option key={c.id} value={c.id}>{c.name} · {c.productCount} {c.productCount===1?'peça':'peças'}</option>)}</select></label><small>As coleções gratuitas para todos já estão disponíveis e não precisam de liberação.</small><button className="button primary" disabled={busy||!collectionId}>{saving?'Salvando…':'Liberar coleção sem custo'}</button></form>
   <h3>Histórico de liberações</h3>{!data.grants.length&&<p>Nenhuma coleção liberada individualmente para este parceiro.</p>}{data.grants.map(g=><article className="admin-access-grant" key={g.id}><div><strong>{g.collectionName}</strong><span className={g.active?'active':'revoked'}>{g.active?'Sem custo · ativa':'Revogada'}</span><small>Liberada em {new Date(g.grantedAt).toLocaleString('pt-BR')} por {g.grantedBy}</small>{g.revokedAt&&<small>Revogada em {new Date(g.revokedAt).toLocaleString('pt-BR')} por {g.revokedBy}</small>}</div>{g.active&&<button className="button outline" disabled={busy} onClick={()=>{if(window.confirm('Revogar o acesso gratuito a '+g.collectionName+' para '+data.member.name+'? Compras pagas não serão alteradas.'))save(g.collectionId,false);}}>Revogar acesso</button>}</article>)}
  </>:<p>Selecione um parceiro para conferir e alterar suas liberações.</p>}</section></div>
 </div>;
}
