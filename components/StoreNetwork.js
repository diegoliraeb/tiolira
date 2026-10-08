'use client';
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import LogoUpload from './LogoUpload';
import DirectoryConsent from './DirectoryConsent';
import LocationFields from './LocationFields';
import DeliveryFields from './DeliveryFields';
import {brStates,countryName,deliveryLabel} from '../lib/geography.mjs';
import {directoryCounts,directorySelected,directoryStores,shuffleStores} from '../lib/store-directory.mjs';
import StoreMap from './StoreMap';
import PartnerDirectoryList from './PartnerDirectoryList';
import {dictionaries,localized} from '../lib/i18n';

export default function StoreNetwork({lang,catalog}){
 const t=dictionaries[lang];
 const dialog=useRef(null),results=useRef(null),feedback=useRef(null),submitting=useRef(false);
 const [location,setLocation]=useState({countryCode:'BR',stateId:'',cityId:'',city:''});
 const [region,setRegion]=useState('');
 const [listing,setListing]=useState({visible:false,ids:[],revision:0});
 const pendingFocus=useRef(false);
 const [address,setAddress]=useState({countryCode:'BR',stateId:'',state:'',cityId:'',city:''});
 const [serviceArea,setServiceArea]=useState({scope:'city',countryCode:'BR',stateId:'',cities:[]});
 const [piece,setPiece]=useState('all');
 const [logo,setLogo]=useState(''),[logoBusy,setLogoBusy]=useState(false);
 const [directoryPublished,setDirectoryPublished]=useState(false);
 const [message,setMessage]=useState(''),[busy,setBusy]=useState(false),[sent,setSent]=useState(false);
 const hasSelection=directorySelected(location,region);
 const ranks=new Map(listing.ids.map((id,index)=>[id,index]));
 const found=directoryStores(catalog.stores,location,region,piece,catalog.products).sort((a,b)=>(ranks.get(a.id)??Infinity)-(ranks.get(b.id)??Infinity));
 const showList=hasSelection&&listing.visible;
 const counts=directoryCounts(catalog.stores,piece,catalog.products);
 const regions=['Norte','Nordeste','Centro-Oeste','Sudeste','Sul'];
 const regionName=value=>t.mapRegions[regions.indexOf(value)]||value;
 const selectionName=location.city||brStates.find(s=>s.id===location.stateId&&location.countryCode==='BR')?.name||location.state||(region?regionName(region):location.countryCode?countryName(location.countryCode,lang):'');
 function search(nextLocation=location,nextRegion=region,nextPiece=piece,focus=false){
  const ids=shuffleStores(directoryStores(catalog.stores,nextLocation,nextRegion,nextPiece,catalog.products)).map(s=>s.id);
  pendingFocus.current=focus;
  setListing(previous=>({visible:directorySelected(nextLocation,nextRegion),ids,revision:previous.revision+1}));
 }
 function changeLocation(value){const nextRegion=value.countryCode!==location.countryCode?'':region;setRegion(nextRegion);setLocation(value);search(value,nextRegion)}
 function changeRegion(value){const next={countryCode:'BR',stateId:'',cityId:'',city:''};setRegion(value);setLocation(next);search(next,value)}
 function changePiece(value){setPiece(value);search(location,region,value)}
 function selectState(state){const next={countryCode:'BR',stateId:state.id,state:state.name,stateCode:state.code,cityId:'',city:''};setRegion('');setLocation(next);search(next,'',piece,true)}
 function backToMap(){pendingFocus.current=true;setListing(previous=>({...previous,visible:false}));}
 function clearFilters(){setLocation({countryCode:'BR',stateId:'',cityId:'',city:''});setRegion('');setPiece('all');setListing(previous=>({visible:false,ids:[],revision:previous.revision+1}));}
 useEffect(()=>{
  if(pendingFocus.current){pendingFocus.current=false;results.current?.focus({preventScroll:true});results.current?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});}
 },[listing]);
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
  data.consent=f.has('consent');data.directoryConsent=f.get('directoryConsent')==='yes';data.partnershipConsent=f.has('partnershipConsent');
  data.whatsapp=data.whatsapp.replace(/\D/g,'');
  if(!/^\d{10,15}$/.test(data.whatsapp)){setMessage(t.whatsappHelp);return;}
  submitting.current=true;setBusy(true);setMessage('');
  try{
   const r=await fetch('/api/stores/apply',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
   const result=await r.json();
   if(!r.ok||result.ok!==true){setMessage(result.code==='PARTNER_EXISTS'?t.clubExistingPartner:result.code==='INVALID_LOGO'?t.logoError:r.status===429?t.registrationLimit:r.status===409?t.registrationClosed:t.registrationError);return;}
   setDirectoryPublished(data.directoryConsent);form.reset();setSent(true);
  }catch{setMessage(t.registrationError)}
  finally{submitting.current=false;setBusy(false)}
 }
 return <section className="store-section wrap section" id="lojas">
  <div className="store-heading"><div><p className="eyebrow">{t.shopEyebrow}</p><h2>{t.shopTitle}</h2></div><p>{t.shopIntro}</p></div>
  <div className="network-benefit"><span aria-hidden="true">✦</span><div><h3>{t.networkBenefitTitle}</h3><p>{t.networkBenefit}</p></div><button className="button primary" onClick={openRegistration}>{t.join} ↗</button></div>
  {sent&&<p className="notice registration-receipt" role="status">{t.sent} {directoryPublished?t.directoryPublished:t.directoryPending}</p>}
  <div className="store-shell">
   <div className="store-search-panel"><span className="store-icon">⌖</span><h3>{t.stores}</h3>
    <form onSubmit={e=>{e.preventDefault();search(location,region,piece,true)}}>
     <p className="field-help">{t.mapSearchHelp}</p>
     <LocationFields lang={lang} value={location} onChange={changeLocation} stateFilter={location.countryCode==='BR'&&region?s=>brStates.some(b=>b.id===s.id&&b.region===region):undefined}>{location.countryCode==='BR'&&<label>{t.mapRegion}<select value={region} onChange={e=>changeRegion(e.target.value)}><option value="">{t.mapChooseRegion}</option>{regions.map(r=><option key={r} value={r}>{regionName(r)}</option>)}</select></label>}</LocationFields>
     <label htmlFor="store-piece">{t.piece}</label><select id="store-piece" value={piece} onChange={e=>changePiece(e.target.value)}><option value="all">{t.all}</option><optgroup label={t.collections}>{catalog.collections.map(c=><option key={c.id} value={`collection:${c.id}`}>{localized(c,lang).name} — {t.completeCollection}</option>)}</optgroup><optgroup label={t.works}>{catalog.products.filter(p=>p.access!=='soon').map(p=><option key={p.id} value={p.id}>{localized(p,lang).name}</option>)}</optgroup></select>
     <p className="collection-search-note">{t.collectionSearchNote}</p><button className="button primary">{t.find} →</button><button type="button" className="text-link" onClick={clearFilters}>{t.clearFilters}</button>
    </form>
    <button className="store-register" onClick={openRegistration}>{t.join} ↗</button>
   </div>
   <div className="store-results-panel" ref={results} tabIndex={-1}>
    {!showList?<>
     <StoreMap counts={counts} stateId={location.countryCode==='BR'?location.stateId:''} region={region} onSelect={selectState} t={t}/>
     <div className="store-empty"><h3>{t.mapEmptyTitle}</h3><p>{t.mapEmptyHelp}</p></div>
    </>:<div className="store-directory-results store-directory-list-view">
     <button type="button" className="store-back-map" onClick={backToMap}>← {t.backToMap}</button>
     <div className="store-directory-heading"><h3>{t.partnersIn} {selectionName}</h3><p className="store-result-count" role="status">{found.length} {found.length===1?t.storeCountOne:t.storeCount}</p></div>
     {found.length>0&&<p className="partner-directory-help">{t.expandPartner}</p>}
     {!found.length?<div className="store-empty"><span aria-hidden="true">⌖</span><h3>{catalog.stores.length?t.noMatch:t.noStores}</h3><p>{t.mapNoMatchHelp}</p></div>:<PartnerDirectoryList key={listing.revision} stores={found} lang={lang} t={t} quoteUrl={quoteUrl}/>}
    </div>}
    <p className="store-disclaimer">{t.disclaimer}</p>
   </div>
  </div>
  <dialog className="seller-form" ref={dialog} aria-labelledby="join-title">
   <button className="close-dialog" aria-label={t.close} onClick={()=>dialog.current.close()}>×</button>
   {sent?<div className="registration-success" ref={feedback} tabIndex={-1} role="status">
    <span className="registration-success-icon" aria-hidden="true">✓</span><h2 id="join-title">{t.sent}</h2><p>{directoryPublished?t.directoryPublished:t.directoryPending}</p><p>{t.clubUnifiedAccount}</p><Link className="button primary" href={`/${lang}/clube`}>{t.clubLoginSubmit}</Link><button className="button primary" onClick={()=>dialog.current.close()}>{t.close}</button>
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
     <label className="check full"><input type="checkbox" name="consent" required/>{t.clubConsent}</label>
     <DirectoryConsent t={t} disabled={busy}/>
     <label className="check full"><input type="checkbox" name="partnershipConsent"/>{t.partnership}</label>
     <div className="honey" aria-hidden="true"><label>Website confirmation<input name="honeypot" tabIndex={-1} autoComplete="off"/></label></div>
     <button className="button primary full" disabled={busy||logoBusy||!catalog.registrationReady}>{busy?t.loading:t.submit}</button>
    </form>
   </>}
  </dialog>
 </section>
}
