'use client';
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {partnerInstagram} from '../lib/instagram.mjs';
import LogoUpload from './LogoUpload';
import LocationFields from './LocationFields';
import DeliveryFields from './DeliveryFields';
import {countryName,deliveryLabel} from '../lib/geography.mjs';
import {matchesStore} from '../lib/store-search.mjs';
import {dictionaries,localized} from '../lib/i18n';

export default function StoreNetwork({lang,catalog}){
 const t=dictionaries[lang];
 const dialog=useRef(null),results=useRef(null),feedback=useRef(null),submitting=useRef(false);
 const [location,setLocation]=useState({countryCode:'BR',stateId:'',cityId:'',city:''});
 const [address,setAddress]=useState({countryCode:'BR',stateId:'',state:'',cityId:'',city:''});
 const [serviceArea,setServiceArea]=useState({scope:'city',countryCode:'BR',stateId:'',cities:[]});
 const [piece,setPiece]=useState('all');
 const [logo,setLogo]=useState(''),[logoBusy,setLogoBusy]=useState(false);
 const [message,setMessage]=useState(''),[busy,setBusy]=useState(false),[sent,setSent]=useState(false);
 const found=catalog.stores.filter(s=>matchesStore(s,location,piece,catalog.products));
 useEffect(()=>{
  if(sent||message){dialog.current.scrollTop=0;feedback.current?.focus();}
 },[sent,message]);
 function openRegistration(){setMessage('');dialog.current.showModal();}
 function quoteUrl(store){
  const selected=piece.startsWith('collection:')?catalog.collections.find(c=>`collection:${c.id}`===piece):catalog.products.find(p=>p.id===piece);
  const request=selected?`${localized(selected,lang).name}${piece.startsWith('collection:')?` — ${t.completeCollection}`:''}`:'';
  const greeting={pt:'Olá! Encontrei seu contato na rede do Tio Lira. Gostaria de um orçamento',en:'Hello! I found you on the Tio Lira network. I would like a quote',es:'¡Hola! Te encontré en la red de Tio Lira. Quisiera un presupuesto'}[lang];
  return `https://wa.me/${store.whatsapp}?text=${encodeURIComponent(`${greeting}${request?`: ${request}`:'.'}`)}`;
 }
 async function submit(e){
  e.preventDefault();
  if(!catalog.registrationReady||submitting.current||logoBusy)return;
  const form=e.currentTarget,f=new FormData(form),data=Object.fromEntries(f);
  Object.assign(data,address,{country:countryName(address.countryCode),serviceArea,delivery:deliveryLabel(serviceArea)});
  if(!address.stateId||!address.cityId){setMessage(t.registrationError);return;}
  if(['city','cities'].includes(serviceArea.scope)&&!serviceArea.cities.length){setMessage(t.chooseDeliveryCity);return;}
  if(logo)data.logoData=logo;
  data.consent=f.has('consent');data.partnershipConsent=f.has('partnershipConsent');
  data.whatsapp=data.whatsapp.replace(/\D/g,'');
  if(!/^\d{10,15}$/.test(data.whatsapp)){setMessage(t.whatsappHelp);return;}
  submitting.current=true;setBusy(true);setMessage('');
  try{
   const r=await fetch('/api/stores/apply',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
   const result=await r.json();
   if(!r.ok||result.ok!==true){setMessage(result.code==='PARTNER_EXISTS'?t.clubExistingPartner:result.code==='INVALID_LOGO'?t.logoError:r.status===429?t.registrationLimit:r.status===409?t.registrationClosed:t.registrationError);return;}
   form.reset();setSent(true);
  }catch{setMessage(t.registrationError)}
  finally{submitting.current=false;setBusy(false)}
 }
 return <section className="store-section wrap section" id="lojas">
  <div className="store-heading"><div><p className="eyebrow">{t.shopEyebrow}</p><h2>{t.shopTitle}</h2></div><p>{t.shopIntro}</p></div>
  <div className="network-benefit"><span aria-hidden="true">✦</span><div><h3>{t.networkBenefitTitle}</h3><p>{t.networkBenefit}</p></div><button className="button primary" onClick={openRegistration}>{t.join} ↗</button></div>
  {sent&&<p className="notice registration-receipt" role="status">{t.sent} {t.registrationReview}</p>}
  <div className="store-shell">
   <div className="store-search-panel"><span className="store-icon">⌖</span><h3>{t.stores}</h3>
    <form onSubmit={e=>{e.preventDefault();results.current?.scrollIntoView({behavior:'smooth',block:'nearest'})}}>
     <p className="field-help">{t.storeSearchHelp}</p><LocationFields lang={lang} value={location} onChange={setLocation}/>
     <label htmlFor="store-piece">{t.piece}</label><select id="store-piece" value={piece} onChange={e=>setPiece(e.target.value)}><option value="all">{t.all}</option><optgroup label={t.collections}>{catalog.collections.map(c=><option key={c.id} value={`collection:${c.id}`}>{localized(c,lang).name} — {t.completeCollection}</option>)}</optgroup><optgroup label={t.works}>{catalog.products.filter(p=>p.access!=='soon').map(p=><option key={p.id} value={p.id}>{localized(p,lang).name}</option>)}</optgroup></select>
     <p className="collection-search-note">{t.collectionSearchNote}</p><button className="button primary">{t.find} →</button><button type="button" className="text-link" onClick={()=>{setLocation({countryCode:'',stateId:'',cityId:'',city:''});setPiece('all')}}>{t.clearFilters}</button>
    </form>
    <button className="store-register" onClick={openRegistration}>{t.join} ↗</button>
   </div>
   <div className="store-results-panel" ref={results}><span className="network-label">{t.join} · {t.freeNativity}</span>
    <p className="store-result-count" role="status">{found.length} {found.length===1?t.storeCountOne:t.storeCount}</p><div className="store-results" aria-live="polite">{!found.length?<div className="store-empty"><span>⌖</span><h3>{catalog.stores.length?t.noMatch:t.noStores}</h3><p>{t.joinIntro}</p></div>:found.map(s=><article className="store-card" key={s.id}><div className="store-identity">{s.logo&&<img className="store-logo" src={s.logo} alt={`${t.logoOf} ${s.name}`} loading="lazy" width="72" height="72"/>}<h3>{s.name}</h3></div><p>{s.city}, {s.state} · {s.country}</p><p>{s.description}</p><p className="store-delivery">{s.serviceArea?deliveryLabel(s.serviceArea,lang):s.delivery}</p>{s.offeringsUnspecified&&<p className="store-availability">{t.confirmAvailability}</p>}<div className="store-card-actions"><a className="store-contact" href={quoteUrl(s)} target="_blank" rel="noreferrer">{t.quote} ↗</a>{partnerInstagram(s)&&<a className="store-instagram" href={partnerInstagram(s)} target="_blank" rel="noopener noreferrer">{t.viewInstagram} ↗</a>}</div></article>)}</div>
    <p className="store-disclaimer">{t.disclaimer}</p>
   </div>
  </div>
  <dialog className="seller-form" ref={dialog} aria-labelledby="join-title">
   <button className="close-dialog" aria-label={t.close} onClick={()=>dialog.current.close()}>×</button>
   {sent?<div className="registration-success" ref={feedback} tabIndex={-1} role="status">
    <span className="registration-success-icon" aria-hidden="true">✓</span><h2 id="join-title">{t.sent}</h2><p>{t.registrationReview}</p><p>{t.clubUnifiedAccount}</p><Link className="button primary" href={`/${lang}/clube`}>{t.clubLoginSubmit}</Link><button className="button primary" onClick={()=>dialog.current.close()}>{t.close}</button>
   </div>:<>
    <p className="eyebrow">{t.join}</p><h2 id="join-title">{t.joinTitle}</h2><p>{t.clubUnifiedAccount}</p><p><Link href={`/${lang}/clube#senha`}>{t.clubExistingPartner}</Link></p><p className="registration-benefit">✦ {t.networkBenefit}</p>
    {!catalog.registrationReady&&<p className="notice">{t.previewForm}</p>}
    {message&&<p className="notice registration-error" ref={feedback} tabIndex={-1} role="alert">{message}</p>}
    <form onSubmit={submit} className="form-grid" aria-busy={busy}>
     <label>{t.name}<input name="name" required maxLength={200}/></label>
     <label>{t.email}<input name="email" type="email" required maxLength={254}/></label>
     <label className="full">{t.clubPassword}<input name="password" type="password" required minLength={12} maxLength={200} autoComplete="new-password"/></label>
     <LogoUpload lang={lang} value={logo} onChange={setLogo} onBusyChange={setLogoBusy} disabled={busy}/>
     <LocationFields lang={lang} value={address} required onChange={value=>{setAddress(value);if(value.countryCode!==address.countryCode)setServiceArea({scope:'city',countryCode:value.countryCode,stateId:'',cities:[]})}}/>
     <label>{t.whatsapp}<input name="whatsapp" type="tel" required placeholder="55 82 99999-9999" maxLength={30}/></label>
     <label className="full">{t.partnerInstagram}<input name="instagram" autoCapitalize="none" spellCheck={false} maxLength={1800} placeholder="@seuusuario"/><span className="field-help">{t.partnerInstagramHelp}</span></label>
     <label className="full">{t.website}<input name="website" type="url" placeholder="https://" pattern="https://.*"/></label>
     <DeliveryFields key={address.countryCode} lang={lang} value={serviceArea} onChange={setServiceArea}/><p className="field-help full">{t.locationSources}: <a href="https://servicodados.ibge.gov.br/api/docs/localidades" target="_blank" rel="noreferrer">IBGE</a> · <a href="/geography/README.txt" target="_blank" rel="noreferrer">Countries States Cities Database (ODbL)</a></p>
     <label className="full">{t.description}<textarea name="description" required maxLength={2000}/></label>
     <p className="field-help full">{t.clubConsent}</p>
     <label className="check full"><input type="checkbox" name="consent" required/>{t.consent}</label>
     <label className="check full"><input type="checkbox" name="partnershipConsent"/>{t.partnership}</label>
     <div className="honey" aria-hidden="true"><label>Website confirmation<input name="honeypot" tabIndex={-1} autoComplete="off"/></label></div>
     <button className="button primary full" disabled={busy||logoBusy||!catalog.registrationReady}>{busy?t.loading:t.submit}</button>
    </form>
   </>}
  </dialog>
 </section>
}
