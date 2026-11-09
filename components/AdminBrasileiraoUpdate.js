'use client';
import {useEffect,useState} from 'react';
import {campaignRecipientStatus,courtesyReportCsv} from '../lib/courtesy-report.mjs';
const date=value=>value?new Date(value).toLocaleString('pt-BR',{timeZone:'America/Maceio'}):'Sem registro';
const labels={awaiting_files:'Aguardando atualização dos arquivos',sending:'Envio liberado',complete:'Envio concluído'};
export default function AdminBrasileiraoUpdate({preview}){
 const [data,setData]=useState(null),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[lang,setLang]=useState('pt'),[confirmed,setConfirmed]=useState(false);
 async function request(action){
  setBusy(true);setMessage('');
  try{const r=await fetch(`/api/admin/brasileirao-update${action?'/'+action:''}`,action?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(action==='release'?{confirmation:'ARQUIVOS ATUALIZADOS; LIBERAR E ENVIAR'}:{})}:{});const j=await r.json();if(!r.ok)throw Error(j.error||'Não foi possível carregar a campanha.');setData(j);if(action)setMessage(action==='tracking'?'Registro de entregas e aberturas conectado.':action==='prepare'?'Cupom e destinatários salvos como rascunho. Nenhum e-mail enviado.':'Cupom liberado. E-mails autorizados para envio pelo sistema.');}
  catch(e){setMessage(e.message)}finally{setBusy(false)}
 }
 useEffect(()=>{if(!preview)request()},[preview]);
 if(preview)return <p className="notice">Entre no painel autenticado para preparar a campanha.</p>;
 function exportReport(){const blob=new Blob([courtesyReportCsv(data?.campaign?.recipients||[])],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='relatorio-atualizacao-brasileirao.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 const c=data?.campaign,mail=data?.previews?.[lang],recipients=c?.recipients||[],sent=recipients.filter(r=>r.status==='sent').length;
 return <section className="club-library">
  <div className="admin-panel"><p className="eyebrow">ATUALIZAÇÃO DE ARQUIVOS · BRASILEIRÃO</p><h2>{c?labels[c.status]||c.status:'Prepare o aviso aos compradores'}</h2><p>Correção do encaixe do rosto: reimprimir apenas a barba e a parte branca do gorro, agora separadas.</p>
   <p><strong>Cupom: {c?.coupon.code||'BRASILEIRAO_CARINHO'}</strong><br/>{c?.coupon.active?'Liberado para os compradores contemplados.':'Bloqueado até a conclusão dos arquivos e a liberação manual.'}</p>
   <p>Uma obra individual de qualquer coleção disponível, uma utilização por cliente, com a licença correspondente. Sem pacotes, sem cobrança e sem acumular promoções.</p>
   <p className="notice"><strong>{recipients.length} destinatários · {sent} enviados</strong><br/>Pagamentos confirmados, incluindo compras de coleção. Cada e-mail recebe somente um aviso. Pedidos pendentes, cancelados, estornados e cortesias sem pagamento não entram.</p>
   <div className="admin-actions"><button className="button outline" disabled={busy} onClick={()=>request()}>Atualizar situação</button>{(!c||c.status==='awaiting_files')&&<button className="button primary" disabled={busy||!data} onClick={()=>request('prepare')}>{c?'Atualizar destinatários do rascunho':'Preparar cupom e campanha'}</button>}</div>
   {c?.status==='awaiting_files'&&<details style={{marginTop:24}}><summary>Quando todos os arquivos estiverem prontos</summary><p>Esta ação ativa a cortesia e autoriza o envio dos e-mails. A coleção precisa estar publicada e fora de “Em preparação”.</p><label className="check"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>Concluí e conferi todos os arquivos corrigidos. Autorizo ativar o cupom e enviar os e-mails.</label><button className="button primary" disabled={!confirmed||busy} onClick={()=>request('release')}>Liberar cupom e enviar avisos</button></details>}
  </div>
  {message&&<p role="status" className="notice">{message}</p>}
  {mail&&<div className="admin-panel" style={{marginTop:24,maxWidth:760}}><label>Prévia do e-mail<select value={lang} onChange={e=>setLang(e.target.value)}>{[['pt','Português'],['en','English'],['es','Español'],['fr','Français']].map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><p>O envio usa o idioma do pedido ou do cadastro do cliente.</p><img src="/assets/tl-monogram-3d-icon.png" width="64" height="64" alt="Tio Lira"/><h3>{mail.subject}</h3><p style={{whiteSpace:'pre-line',lineHeight:1.7}}>{mail.text}</p></div>}
  <div className="admin-panel" style={{marginTop:24}}><h3>Relatório de envios e cortesias</h3>
   <p>Entregue significa recebido pelo servidor de e-mail. Abertura registrada não comprova leitura: alguns aplicativos bloqueiam esse registro ou abrem imagens automaticamente. Datas no horário de Brasília.</p>
   <p className="notice">{data?.tracking?.configured?'Entregas conectadas.':'Registro de entregas ainda não conectado.'} {data?.tracking?.openTracking?'Registro de aberturas habilitado.':'Registro de aberturas ainda não habilitado.'}</p>
   <div className="admin-actions">{(!data?.tracking?.configured||!data?.tracking?.openTracking)&&<button className="button outline" disabled={busy||!data} onClick={()=>request('tracking')}>Conectar relatório de e-mail</button>}<button className="button outline" disabled={!recipients.length} onClick={exportReport}>Exportar CSV</button></div>
   {c&&<><div style={{display:'flex',flexWrap:'wrap',gap:20,margin:'24px 0'}}>{[['recipients','Destinatários'],['sent','Enviados'],['delivered','Entregues'],['opened','Aberturas registradas'],['failed','Falhas / revisão'],['redeemed','Cupons utilizados']].map(([key,label])=><div key={key}><strong style={{fontSize:26}}>{c.summary?.[key]||0}</strong><br/><small>{label}</small></div>)}</div>
   <div style={{overflowX:'auto'}}><table style={{width:'100%',textAlign:'left',borderCollapse:'collapse',minWidth:1000}}><thead><tr>{['Cliente','Envio','Entrega','Abertura registrada','Cupom / obra escolhida'].map(title=><th key={title} style={{padding:12,borderBottom:'1px solid #ded9cc'}}>{title}</th>)}</tr></thead><tbody>{recipients.map(r=><tr key={r.id}>
    <td style={{padding:12,verticalAlign:'top'}}><strong>{r.name}</strong><br/>{r.email}<br/><small>{r.language.toUpperCase()}</small></td>
    <td style={{padding:12,verticalAlign:'top'}}>{campaignRecipientStatus(r)}<br/><small>{date(r.sentAt||r.delivery?.sent)}</small></td>
    <td style={{padding:12,verticalAlign:'top'}}>{r.delivery?.bounced?'Devolvido':r.delivery?.failed?'Falha':r.delivery?.delivered?'Entregue':r.delivery?.delivery_delayed?'Entrega adiada':'Sem confirmação'}<br/><small>{date(r.delivery?.bounced||r.delivery?.failed||r.delivery?.delivered||r.delivery?.delivery_delayed)}</small>{r.delivery?.complained&&<p>Marcado como spam: {date(r.delivery.complained)}</p>}</td>
    <td style={{padding:12,verticalAlign:'top'}}>{date(r.delivery?.opened)}</td>
    <td style={{padding:12,verticalAlign:'top'}}>{r.redemption?<><strong>{r.redemption.status==='paid'?'Utilizado':'Resgate '+r.redemption.status}</strong><br/>{r.redemption.works.join(', ')}<br/><small>{date(r.redemption.at)}<br/>Pedido: {r.redemption.orderId}</small></>:c.coupon.active?'Ainda não utilizado':'Aguardando liberação'}</td>
   </tr>)}</tbody></table></div></>}
  </div>
 </section>;
}
