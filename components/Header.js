'use client';
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {dictionaries,languages,localeNames} from '../lib/i18n';

const navigationCopy={
 pt:{club:'Clube',menu:'Menu',browse:'Explore o ateliê',partner:'Sua Área do Parceiro',makers:'Encontre quem imprime',orders:'Compras e arquivos',licenses:'Minhas licenças',language:'Idioma'},
 en:{club:'Club',menu:'Menu',browse:'Explore the studio',partner:'Your Partner Area',makers:'Find a print partner',orders:'Orders & files',licenses:'My licenses',language:'Language'},
 es:{club:'Club',menu:'Menú',browse:'Explora el taller',partner:'Tu Área de Socios',makers:'Encuentra quién imprime',orders:'Compras y archivos',licenses:'Mis licencias',language:'Idioma'},
 fr:{club:'Club',menu:'Menu',browse:'Explorez l’atelier',partner:'Votre espace partenaire',makers:'Trouver un imprimeur',orders:'Achats et fichiers',licenses:'Mes licences',language:'Langue'}
};
export default function Header({lang,onWorks}){
 const t=dictionaries[lang],copy=navigationCopy[lang]||navigationCopy.pt,path=usePathname();
 const dialog=useRef(null),trigger=useRef(null),[open,setOpen]=useState(false);
 const links=[
  {href:`/${lang}/colecoes`,label:t.collections},
  {href:`/${lang}#obras`,label:t.works,onClick:onWorks},
  {href:`/${lang}#lojas`,label:copy.makers},
  {href:`/${lang}/calculadora`,label:t.calculator}
 ];
 const close=()=>{dialog.current?.close();setOpen(false)};
 const navigate=href=>{close();if(!href.includes('#'))window.scrollTo({top:0,behavior:'instant'});};
 useEffect(()=>{if(!open)return;const el=dialog.current,previous=document.body.style.overflow;el.showModal();document.body.style.overflow='hidden';const media=window.matchMedia('(min-width: 1001px)'),resize=()=>{if(media.matches)setOpen(false)};media.addEventListener('change',resize);return()=>{el.close();document.body.style.overflow=previous;media.removeEventListener('change',resize);trigger.current?.focus({preventScroll:true});};},[open]);
 useEffect(()=>{setOpen(false)},[path]);
 const languageLinks=()=>languages.map(l=><Link key={l} href={path.replace(/^\/(pt|en|es|fr)(?=\/|$)/,`/${l}`)} onClick={close} lang={l} title={localeNames[l]} aria-current={l===lang?'page':undefined}>{l.toUpperCase()}</Link>);
 return <>
  <header className="tl-site-header">
   <Link className="tl-brand" href={`/${lang}`} onNavigate={()=>navigate(`/${lang}`)} aria-label="Tio Lira"><img src="/assets/tl-monogram-3d.webp" width="42" height="42" alt=""/><span>tio lira<small>{t.studio}</small></span></Link>
   <nav className="tl-desktop-nav" aria-label={copy.browse}>{links.slice(0,3).map(link=><Link key={link.href} href={link.href} onNavigate={()=>navigate(link.href)} onClick={link.onClick}>{link.label}</Link>)}</nav>
   <div className="tl-header-actions"><a className="tl-instagram" href="https://www.instagram.com/tiolira/" target="_blank" rel="noopener noreferrer" aria-label="Instagram @tiolira" title="Instagram @tiolira"><svg width="21" height="21" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" strokeWidth="1.7"/><circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.7"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/></svg></a><div className="tl-header-languages" aria-label={copy.language}>{languageLinks()}</div><Link className="tl-club-button" href={`/${lang}/clube`} onNavigate={()=>navigate(`/${lang}/clube`)}><span className="tl-club-label">{t.club}</span><span className="tl-club-short">{copy.club}</span><span className="tl-club-arrow" aria-hidden="true">↗</span></Link><button ref={trigger} type="button" className="tl-menu-toggle" aria-label={copy.menu} aria-expanded={open} aria-controls="tl-site-menu" aria-haspopup="dialog" onClick={()=>setOpen(true)}><svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg><span>{copy.menu}</span></button></div>
  </header>
  <dialog ref={dialog} id="tl-site-menu" className="tl-site-menu" aria-labelledby="tl-menu-title" onCancel={close} onClose={close} onClick={e=>{if(e.target===e.currentTarget){const r=e.currentTarget.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close();}}}>
   <div className="tl-menu-top"><strong id="tl-menu-title">{copy.menu}</strong><button type="button" onClick={close} aria-label={t.close}>×</button></div>
   <p className="tl-menu-label">{copy.browse}</p><nav className="tl-menu-nav" aria-label={copy.browse}>{links.map(link=><Link key={link.href} href={link.href} onNavigate={()=>navigate(link.href)} onClick={()=>{link.onClick?.();close()}}>{link.label}<span aria-hidden="true">↗</span></Link>)}</nav>
   <div className="tl-menu-account"><p className="tl-menu-label">{copy.partner}</p><Link className="tl-menu-club" href={`/${lang}/clube`} onNavigate={()=>navigate(`/${lang}/clube`)} onClick={close}>{t.clubArea}<span aria-hidden="true">↗</span></Link><nav className="tl-menu-nav tl-account-nav" aria-label={copy.partner}><Link href={`/${lang}/clube#compras`} onClick={close}>{copy.orders}<span aria-hidden="true">→</span></Link><Link href={`/${lang}/clube#licencas`} onClick={close}>{copy.licenses}<span aria-hidden="true">→</span></Link></nav></div>
   <div className="tl-menu-bottom"><span>{copy.language}</span><div className="tl-menu-languages">{languageLinks()}</div></div>
  </dialog>
 </>;
}
