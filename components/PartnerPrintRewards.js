'use client';
import {useEffect,useRef,useState} from 'react';
import {PRINT_ANGLES,PRINT_REWARD_STATUS,PRINT_REWARD_TERMS} from '../lib/print-rewards.mjs';
export async function rewardsApi(path,input,method='POST'){
 const r=await fetch(`/api/${path}`,input?{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(input)}:undefined),data=await r.json();
 if(!r.ok)throw Error(data.error||'Não foi possível concluir. Tente novamente.');return data;
}
async function preparePhoto(file){
 if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>20*1024*1024)throw Error('Escolha uma foto JPG, PNG ou WebP de até 20 MB.');
 const bitmap=await createImageBitmap(file);
 try{
  if(Math.min(bitmap.width,bitmap.height)<600||bitmap.width*bitmap.height>30_000_000)throw Error('Use uma foto com pelo menos 600 pixels em cada lado e no máximo 30 megapixels.');
  const scale=Math.min(1,2400/Math.max(bitmap.width,bitmap.height)),canvas=document.createElement('canvas');canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);
  for(const quality of [.92,.85,.76]){const result=canvas.toDataURL('image/webp',quality);if(result.length<=2_700_000)return result;}
  throw Error('Esta foto ficou muito grande. Escolha uma versão menor.');
 }finally{bitmap.close();}
}
export default function PartnerPrintRewards({onRefresh}){
 const choiceBox=useRef(null);
 const [data,setData]=useState(null),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[terms,setTerms]=useState(false),[printed,setPrinted]=useState(false),[consent,setConsent]=useState(false),[collection,setCollection]=useState('all'),[choice,setChoice]=useState(null),[requestId,setRequestId]=useState('');
 useEffect(()=>{if(choice){choiceBox.current?.focus({preventScroll:true});choiceBox.current?.scrollIntoView({behavior:'smooth',block:'center'});}},[choice]);
 async function load(){const d=await rewardsApi('club/print-rewards');setData(d);return d;}
 useEffect(()=>{load().catch(e=>setError(e.message));},[]);
 const current=data?.claims.find(c=>c.status!=='approved'),canEdit=current&&['printing','changes'].includes(current.status);
 useEffect(()=>{
  if(current?.status!=='pending')return;
  let cancelled=false,inFlight=false;
  async function refreshReview(){
   if(document.visibilityState==='hidden'||inFlight)return;
   inFlight=true;
   try{const next=await rewardsApi('club/print-rewards');if(cancelled)return;setData(next);if(next.canClaim){setCollection('all');setChoice(null);setNotice('Fotos aprovadas! Escolha sua próxima peça em qualquer coleção participante.');}}catch{/* Keep the last saved progress and allow manual refresh. */}finally{inFlight=false;}
  }
  const timer=setInterval(refreshReview,20_000);
  window.addEventListener('focus',refreshReview);document.addEventListener('visibilitychange',refreshReview);
  return()=>{cancelled=true;clearInterval(timer);window.removeEventListener('focus',refreshReview);document.removeEventListener('visibilitychange',refreshReview);};
 },[current?.status]);
 function choose(product){setChoice(product);setTerms(false);setRequestId(crypto.randomUUID());}
 const visibleProducts=data?.products.filter(p=>collection==='all'||p.collectionId===collection)||[];
 async function run(action,message){setBusy(true);setError('');setNotice('');try{const d=await action();setData(d);setNotice(message);return true;}catch(e){setError(e.message);await load().catch(()=>{});return false;}finally{setBusy(false);}}
 async function claim(){if(!choice)return;const ok=await run(()=>rewardsApi('club/print-rewards/claim',{productId:choice.id,requestId,acceptTerms:terms}),'Peça liberada! Baixe o arquivo, imprima e prepare suas cinco fotos.');if(ok){setChoice(null);setTerms(false);onRefresh?.().catch(()=>{});}}
 async function upload(e,angle){const file=e.target.files?.[0];e.target.value='';if(!file)return;await run(async()=>rewardsApi('club/print-rewards/photo',{claimId:current.id,version:current.version,angle,photo:await preparePhoto(file)}),'Foto salva.');}
 async function submit(e){e.preventDefault();const ok=await run(()=>rewardsApi('club/print-rewards/submit',{claimId:current.id,version:current.version,confirmPrinted:printed,acceptPhotoUse:consent}),'Cinco fotos enviadas. Aguarde a aprovação do Tio Lira para escolher a próxima peça.');if(ok){setPrinted(false);setConsent(false);}}
 return <section className="print-rewards"><header className="partner-panel-heading"><p className="eyebrow">PARCEIROS QUE DÃO VIDA ÀS IDEIAS</p><h2>Imprima, fotografe e ganhe.</h2><p>Escolha uma peça paga sem custo. Imprima, monte e envie cinco fotos sobre a impressora. Após a aprovação do Tio Lira, escolha outra e repita.</p></header>
 <ol className="print-reward-steps"><li><b>01</b><span>Escolha sua peça digital grátis</span></li><li><b>02</b><span>Imprima, monte e fotografe</span></li><li><b>03</b><span>Envie cinco ângulos para aprovação</span></li><li><b>04</b><span>Fotos aprovadas? Escolha outra!</span></li></ol>
 {error&&<p role="alert" className="status-message">{error}</p>}{notice&&<p role="status" className="notice">{notice}</p>}
 <button className="text-link" disabled={busy} onClick={()=>load().catch(e=>setError(e.message))}>Atualizar meu progresso ↻</button>
 {!data?<p>Carregando sua participação…</p>:<>
 {!data.enabled&&<p className="notice">Novos resgates estão pausados. Peças já liberadas continuam disponíveis e você pode enviar as fotos pendentes.</p>}
 {data.collections.length>0&&<p><strong>Coleções participantes:</strong> {data.collections.map(c=>c.name).join(' · ')}</p>}
 {current&&<article className="print-reward-current"><header><div><p className="eyebrow">SUA PEÇA ATUAL</p><h3>{current.productName}</h3><p>{current.collectionName}</p></div><span className={`print-reward-status is-${current.status}`}>{PRINT_REWARD_STATUS[current.status]}</span></header>
 <div className="feedback-actions"><a className="button primary" href={current.downloadUrl}>Baixar arquivo</a><a className="button outline" href={current.licenseUrl}>Baixar licença</a></div>
 {current.feedback&&<p className="notice"><strong>Orientação do Tio Lira:</strong> {current.feedback}</p>}
 <h3>Uma peça montada. Cinco ângulos.</h3><p>Posicione a peça impressa e completamente montada em cima da impressora. Mantenha a impressora visível nas fotos, use boa iluminação e mostre a peça inteira. Envie fotografias reais de sua autoria, sem montagens ou imagens geradas.</p>
 <div className="print-reward-photo-grid">{PRINT_ANGLES.map(([angle,label],i)=>{const photo=current.photos.find(p=>p.angle===angle);return <div className="print-reward-photo" key={angle}><strong>{i+1}. {label}</strong>{photo?<a href={photo.url} target="_blank" rel="noreferrer"><img loading="lazy" src={photo.url} alt={`${label} de ${current.productName}`}/></a>:<div className="print-reward-placeholder"><span aria-hidden="true">{String(i+1).padStart(2,'0')}</span><span>{label}</span></div>}{canEdit&&<label className="print-reward-upload">{photo?'Trocar foto':'Selecionar foto'}<input aria-label={`Enviar foto: ${label}`} type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={e=>upload(e,angle)}/></label>}</div>})}</div>
 {canEdit?<form className="print-reward-confirm" onSubmit={submit}><p className="field-help">{current.photos.length} de 5 fotos salvas · JPG, PNG ou WebP. Fotos grandes são ajustadas para envio.</p><label><input type="checkbox" checked={printed} disabled={busy} onChange={e=>setPrinted(e.target.checked)}/>Confirmo que as cinco fotos mostram minha impressão real, montada, sobre a impressora e em ângulos diferentes.</label><label><input type="checkbox" checked={consent} disabled={busy} onChange={e=>setConsent(e.target.checked)}/>Sou autor das fotos e autorizo seu uso no site, nas redes sociais e na divulgação do Tio Lira 3D, com crédito ao meu nome de parceiro.</label><button className="button primary" disabled={busy||current.photos.length!==5||!printed||!consent}>{busy?'Salvando…':'Enviar as cinco fotos para aprovação'}</button></form>:<p className="notice">O envio está em análise. A próxima peça será liberada somente após a aprovação do Tio Lira.</p>}
 </article>}
 {!current&&data.enabled&&<section><h3>{data.claims.length?'Suas fotos foram aprovadas. Escolha a próxima!':'Sua primeira peça é por nossa conta.'}</h3><p>Clique na foto ou em “Escolher esta peça”. A cada aprovação, escolha outro modelo de qualquer coleção participante. A impressão física é feita por você.</p><label>Filtrar coleção<select value={collection} onChange={e=>setCollection(e.target.value)}><option value="all">Todas as participantes</option>{data.collections.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
 {choice&&<div ref={choiceBox} tabIndex={-1} className="print-reward-choice"><h3>Resgatar {choice.name}?</h3><p>Esta será sua peça para imprimir e fotografar. Você poderá escolher outra após a aprovação das cinco fotos.</p><label><input type="checkbox" checked={terms} disabled={busy} onChange={e=>setTerms(e.target.checked)}/>{PRINT_REWARD_TERMS}</label><div className="feedback-actions"><button className="button primary" disabled={busy||!terms} onClick={claim}>{busy?'Liberando…':'Confirmar resgate gratuito'}</button><button className="button outline" disabled={busy} onClick={()=>setChoice(null)}>Voltar à escolha</button></div></div>}
 <div className="print-reward-product-grid">{visibleProducts.map(p=><article key={p.id}><button type="button" className="print-reward-product-choice" aria-label={`Escolher grátis: ${p.name}`} aria-pressed={choice?.id===p.id} disabled={busy||!data.canClaim} onClick={()=>choose(p)}><span className="print-reward-product-info"><span className="print-reward-badge">Modelo digital grátis</span><span className="print-reward-product-name">{p.name}</span><span className="print-reward-product-cta">Escolher esta peça <span aria-hidden="true">→</span></span></span><img src={p.image} alt={p.name} loading="lazy"/></button></article>)}</div>{!visibleProducts.length&&<p className="notice">{data.products.length?'Você já possui as peças disponíveis desta coleção. Escolha outra coleção no filtro acima.':'Você já possui as peças disponíveis ou ainda não há modelos elegíveis. Seu benefício fica aguardando novas peças nas coleções participantes.'}</p>}</section>}
 {data.claims.length>0&&<section><h3>Minhas participações</h3>{data.claims.map(c=><details className="print-reward-history" key={c.id}><summary>{c.productName} · {PRINT_REWARD_STATUS[c.status]}</summary><p>{c.collectionName}</p><div className="feedback-actions"><a href={c.downloadUrl}>Baixar arquivo</a><a href={c.licenseUrl}>Baixar licença</a></div>{c.feedback&&<p>{c.feedback}</p>}<div className="print-reward-photo-grid">{c.photos.map(p=><a href={p.url} key={p.angle} target="_blank" rel="noreferrer"><img loading="lazy" src={p.url} alt={p.label}/><span>{p.label}</span></a>)}</div></details>)}</section>}
 </>}
 </section>;
}
