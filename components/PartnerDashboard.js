'use client';
import {useEffect,useRef,useState} from 'react';
import PartnerProfile from './PartnerProfile';

function MenuIcon({kind}){
 const paths={profile:'M20 21v-2a7 7 0 0 0-14 0v2 M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0',collections:'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',coupons:'M3 7h18v4a2 2 0 0 0 0 4v4H3v-4a2 2 0 0 0 0-4z M15 7v12',licenses:'M6 3h9l4 4v14H6z M14 3v5h5 M9 14l2 2 4-4'};
 return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d={paths[kind]}/></svg>;
}
export default function PartnerDashboard({lang,t,member,collections,applyDashboard,downloads,coupons,licenses,collectionLicenses,setLicenses,logout,busy}){
 const [selected,setSelected]=useState(null),[issuing,setIssuing]=useState(false),[message,setMessage]=useState(''),[copyMessage,setCopyMessage]=useState('');
 const [section,setSection]=useState('colecoes'),[collection,setCollection]=useState('all'),[collectionsOpen,setCollectionsOpen]=useState(true);
 const dialog=useRef(null),content=useRef(null),locale={pt:'pt-BR',en:'en-US',es:'es-ES'}[lang];
 const localized=item=>({...item,...item.translations?.[lang]});
 const items=downloads.map(localized),groups=collections.map(localized),eligible=items.filter(item=>item.canLicense&&!collectionLicenses.some(l=>l.collectionId===item.collection)),license=collectionLicenses.find(l=>l.collectionId===selected?.collection)||licenses.find(l=>l.productId===selected?.id);
 const currentCollectionLicense=collectionLicenses.find(l=>l.collectionId===collection);
 const currentCollection=groups.find(c=>c.id===collection),visibleItems=collection==='all'?items:items.filter(item=>item.collection===collection);
 useEffect(()=>{if(selected){setMessage('');setCopyMessage('');dialog.current.showModal();}},[selected]);
 useEffect(()=>{
  const read=()=>{const hash=window.location.hash.slice(1);if(['cadastro','cupons','licencas'].includes(hash)){setSection(hash);return;}setSection('colecoes');let id='all';try{if(hash.startsWith('colecao='))id=decodeURIComponent(hash.slice(8));}catch{}setCollection(id);setCollectionsOpen(true);};
  read();window.addEventListener('hashchange',read);window.addEventListener('popstate',read);return()=>{window.removeEventListener('hashchange',read);window.removeEventListener('popstate',read)};
 },[]);
 function navigate(next,id='all'){
  setSection(next);setCollection(id);setCopyMessage('');setMessage('');
  if(next==='colecoes')setCollectionsOpen(true);
  const hash=next==='colecoes'&&id!=='all'?`colecao=${encodeURIComponent(id)}`:next;
  window.history.pushState(null,'',`#${hash}`);
  requestAnimationFrame(()=>{const top=content.current?.getBoundingClientRect().top;if(top<0||innerWidth<=600)content.current?.scrollIntoView({block:'start',behavior:'smooth'});});
 }
 async function copy(code){try{await navigator.clipboard.writeText(code);setCopyMessage(t.clubCopied)}catch{setCopyMessage(t.clubCopyError)}}
 async function generate(){setIssuing(true);setMessage('');try{const r=await fetch('/api/club/licenses',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({productId:selected.id})}),result=await r.json();if(!r.ok)throw Error(result.error||t.clubError);setLicenses(current=>[...current.filter(l=>l.productId!==result.license.productId),result.license]);}catch(e){setMessage(e.message)}finally{setIssuing(false)}}
 const date=value=>new Date(value).toLocaleDateString(locale,{timeZone:'America/Maceio'});
 function receipt(item){return <div className="partner-license-receipt"><p className="eyebrow">{item.kind==='collection'?t.partnerCollectionLicense:t.clubLicenseCode}</p>{item.collectionName&&<h3>{item.collectionName}</h3>}<code>{item.code}</code><p>{t.clubLicensePartner}: <strong>{item.partnerName}</strong></p><p>{t.clubLicenseIssued} {date(item.issuedAt)}</p><p>{item.kind==='collection'?t.partnerCollectionLicenseTerms:t.clubLicenseTerms}</p>{item.productTerms&&<p>{item.productTerms}</p>}<button className="button outline" onClick={()=>copy(item.code)}>{t.clubCopy}</button></div>}

 return <section className="partner-workspace">
 <aside className="partner-sidebar">
  <div className="partner-identity"><span className="partner-avatar" aria-hidden="true">{member.name?.charAt(0).toUpperCase()}</span><div><strong>{member.name}</strong><small>{t.clubArea}</small></div></div>
  <nav aria-label={t.clubArea} className="partner-side-nav">
   <button aria-current={section==='cadastro'?'page':undefined} onClick={()=>navigate('cadastro')}><MenuIcon kind="profile"/><span>{t.partnerProfile}</span></button>
   <button aria-current={section==='colecoes'?'page':undefined} aria-expanded={collectionsOpen} aria-controls="partner-collections-menu" onClick={()=>{if(section==='colecoes')setCollectionsOpen(open=>!open);else navigate('colecoes')}}><MenuIcon kind="collections"/><span>{t.collections}</span><span className="partner-chevron" aria-hidden="true">{collectionsOpen?'−':'+'}</span></button>
   {collectionsOpen&&<div id="partner-collections-menu" className="partner-collection-menu"><button aria-current={section==='colecoes'&&collection==='all'?'page':undefined} onClick={()=>navigate('colecoes')}>{t.partnerAllCollections}<small>{items.length}</small></button>{groups.map(group=><button key={group.id} aria-current={section==='colecoes'&&collection===group.id?'page':undefined} onClick={()=>navigate('colecoes',group.id)}><span>{group.name}</span><small>{items.filter(item=>item.collection===group.id).length}</small></button>)}</div>}
   <button aria-current={section==='cupons'?'page':undefined} onClick={()=>navigate('cupons')}><MenuIcon kind="coupons"/><span>{t.clubCoupons}</span></button>
   <button aria-current={section==='licencas'?'page':undefined} onClick={()=>navigate('licencas')}><MenuIcon kind="licenses"/><span>{t.partnerMyLicenses}</span><small>{licenses.length+collectionLicenses.length}</small></button>
  </nav>
  <button className="partner-signout" onClick={logout} disabled={busy}>{t.clubLogout} <span aria-hidden="true">↗</span></button>
 </aside>
 <div className="partner-content" ref={content}>
 {section==='cadastro'&&<PartnerProfile lang={lang} t={t} member={member} onSave={applyDashboard}/>}
 {section==='colecoes'&&<section className="club-library" aria-labelledby="partner-collection-title"><header className="partner-panel-heading"><p className="eyebrow">{t.collections}</p><h2 id="partner-collection-title">{currentCollection?.name||t.clubLibraryTitle}</h2><p>{currentCollection?.description||t.partnerCollectionsIntro}</p></header>{currentCollectionLicense&&<div className="partner-collection-license"><span>{t.partnerCollectionLicensed}</span><button className="text-link" onClick={()=>navigate('licencas')}>{t.partnerViewLicense} →</button></div>}{visibleItems.length?<div className="club-download-grid">{visibleItems.map(item=><article className="club-download-card" key={item.id}><button className="partner-piece-image" aria-label={`${t.details}: ${item.name}`} onClick={()=>setSelected(item)}><img src={item.image} alt="" loading="lazy"/></button><div><h3>{item.name}</h3><button className="button outline" onClick={()=>setSelected(item)}>{item.canLicense?t.clubLicenseView:t.details}</button></div></article>)}</div>:<p className="notice">{t.clubNoFiles}</p>}</section>}
 {section==='cupons'&&<section className="club-library" aria-labelledby="partner-coupons-title"><header className="partner-panel-heading"><p className="eyebrow">{t.clubArea}</p><h2 id="partner-coupons-title">{t.clubCoupons}</h2><p>{t.clubCouponsIntro}</p></header>{coupons.length?<div className="partner-coupon-grid">{coupons.map(c=><article className="partner-coupon" key={c.id}><p className="eyebrow">{c.supplier}</p><h3>{c.description}</h3><code>{c.code}</code>{c.expiresAt&&<p>{t.clubCouponExpires} {date(c.expiresAt)}</p>}<div className="partner-actions"><button className="button outline" onClick={()=>copy(c.code)}>{t.clubCopy}</button><a className="button primary" href={c.url} target="_blank" rel="noreferrer">{t.clubCouponStore} ↗</a></div></article>)}</div>:<div className="partner-empty"><MenuIcon kind="coupons"/><h3>{t.partnerCouponsSoon}</h3><p>{t.clubNoCoupons}</p></div>}</section>}
 {section==='licencas'&&<section className="club-library" aria-labelledby="partner-licenses-title"><header className="partner-panel-heading"><p className="eyebrow">{t.clubArea}</p><h2 id="partner-licenses-title">{t.partnerMyLicenses}</h2><p>{t.partnerLicensesIntro}</p></header>{collectionLicenses.length>0&&<><p className="notice">{t.partnerAutomaticLicenses}</p>{collectionLicenses.map(item=><details className="partner-saved-license" key={item.code}><summary>{item.collectionName} <span className="partner-license-tag">{t.partnerCollectionLicense}</span></summary>{receipt(item)}</details>)}</>}{licenses.length?licenses.map(item=><details className="partner-saved-license" key={item.code}><summary>{item.productName}</summary>{receipt(item)}</details>):!collectionLicenses.length?<div className="partner-empty"><MenuIcon kind="licenses"/><h3>{t.partnerNoIssuedLicenses}</h3><p>{t.clubLicensesIntro}</p></div>:null}{eligible.length>0&&<><h3>{t.clubLicenses}</h3><div className="partner-license-list">{eligible.map(item=><button className="partner-license-choice" key={item.id} onClick={()=>setSelected(item)}><img src={item.image} alt=""/><span><strong>{item.name}</strong><small>{t.clubLicenseView} →</small></span></button>)}</div></>}</section>}
 {copyMessage&&!selected&&<p role="status" className="status-message">{copyMessage}</p>}
 </div>
 <dialog ref={dialog} className="admin-editor partner-piece-dialog" aria-labelledby="partner-piece-title" onClose={()=>setSelected(null)}><button className="close-dialog" aria-label={t.close} onClick={()=>dialog.current.close()}>×</button>{selected&&<><img className="partner-dialog-image" src={selected.image} alt=""/><h2 id="partner-piece-title">{selected.name}</h2>{selected.downloadUrl&&<a className="button primary" href={selected.downloadUrl} target={selected.downloadUrl.startsWith('https:')?'_blank':undefined} rel="noreferrer">{selected.access==='maker'?t.makerDownload:t.download} ↓</a>}{selected.canLicense&&<div className="club-library"><h3>{license?t.partnerMyLicenses:t.clubLicenses}</h3>{license?receipt(license):<><p>{t.clubLicenseTerms}</p><button className="button outline" disabled={issuing} onClick={generate}>{issuing?t.clubWait:t.clubLicenseGenerate}</button></>}</div>}{message&&<p role="alert" className="status-message">{message}</p>}{copyMessage&&<p role="status">{copyMessage}</p>}</>}</dialog></section>;
}
