'use client';
import {useState} from 'react';
import LocationFields from './LocationFields';
import DeliveryFields from './DeliveryFields';
import LogoUpload from './LogoUpload';
import {countryName} from '../lib/geography.mjs';

export default function PartnerProfile({lang,t,member,onSave}){
 const [profile,setProfile]=useState({...member,countryCode:member.countryCode||'BR',stateId:member.stateId||'',cityId:member.cityId||''});
 const [logo,setLogo]=useState(null),[logoBusy,setLogoBusy]=useState(false),[saving,setSaving]=useState(false),[message,setMessage]=useState('');
 const change=(key,value)=>setProfile(p=>({...p,[key]:value}));
 async function save(event){
  event.preventDefault();setSaving(true);setMessage('');
  try{
   const response=await fetch('/api/club/profile',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({...profile,country:countryName(profile.countryCode),...(logo===null?{}:logo?{logoData:logo}:{removeLogo:true})})});
   const data=await response.json();if(!response.ok)throw Error(data.error||t.clubError);
   setProfile(data.member);setLogo(null);onSave(data);setMessage(t.partnerProfileSaved);
  }catch(error){setMessage(error.message)}finally{setSaving(false)}
 }
 return <section className="partner-panel" aria-labelledby="profile-title"><header className="partner-panel-heading"><p className="eyebrow">{t.clubArea}</p><h2 id="profile-title">{t.partnerProfile}</h2><p>{t.partnerProfileIntro}</p></header>
 <form className="form-grid partner-profile-form" onSubmit={save} aria-busy={saving}>
 <label>{t.name}<input required maxLength={200} value={profile.name||''} onChange={e=>change('name',e.target.value)}/></label>
 <label>{t.email}<input type="email" value={profile.email} readOnly/><small>{t.partnerEmailHelp}</small></label>
 <LogoUpload lang={lang} value={logo??profile.logo??''} onChange={setLogo} onBusyChange={setLogoBusy} disabled={saving}/>
 <LocationFields lang={lang} value={profile} required onChange={value=>setProfile(p=>({...p,...value,...(value.countryCode!==p.countryCode&&p.serviceArea?{serviceArea:{scope:'country',countryCode:value.countryCode,stateId:'',cities:[]}}:{})}))}/>
 <label>{t.whatsapp}<input required inputMode="tel" maxLength={15} pattern="[0-9]{10,15}" value={profile.whatsapp||''} onChange={e=>change('whatsapp',e.target.value.replace(/\D/g,''))}/></label>
 <label className="full">{t.partnerInstagram}<input name="instagram" autoCapitalize="none" spellCheck={false} maxLength={1800} placeholder="@seuusuario" value={profile.instagram||''} onChange={e=>change('instagram',e.target.value)}/><small>{t.partnerInstagramHelp}</small></label>
 <label className="full">{t.website}<input type="url" maxLength={1800} value={profile.website||''} onChange={e=>change('website',e.target.value)}/></label>
 {profile.serviceArea?<DeliveryFields key={profile.countryCode} lang={lang} value={profile.serviceArea} onChange={value=>change('serviceArea',value)}/>:<label className="full">{t.delivery}<input maxLength={16000} value={profile.delivery||''} onChange={e=>change('delivery',e.target.value)}/></label>}
 <label className="full">{t.description}<textarea maxLength={2000} value={profile.description||''} onChange={e=>change('description',e.target.value)}/></label>
 <label className="check full"><input type="checkbox" checked={profile.partnershipConsent||false} onChange={e=>change('partnershipConsent',e.target.checked)}/><span>{t.partnership}</span></label>
 {message&&<p className="status-message full" role="status">{message}</p>}
 <div className="full"><button className="button primary" disabled={saving||logoBusy}>{saving?t.clubWait:t.partnerSaveProfile}</button></div>
 </form></section>;
}
