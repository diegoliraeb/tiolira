import {printProfileCopy} from '../lib/print-profile-copy.mjs';
export default function PrintProfiles({profiles=[],lang='pt',paid=false,partnerLink=false}){
 if(!profiles.length)return null;
 const copy=printProfileCopy(lang),available=profiles.some(p=>p.downloadUrl);
 return <section className="print-profiles" aria-label={copy.title}><header><h3>{copy.title}</h3><p>{paid?copy.included:copy.choose}</p></header><div className="print-profile-list">{profiles.map(profile=><article className="print-profile-card" key={profile.id}><div><h4>{profile.name==='Perfil original'?copy.original:profile.name}</h4><div className="print-profile-tags">{profile.layerHeight!=null&&<span>{copy.layer} {new Intl.NumberFormat(lang,{minimumFractionDigits:2,maximumFractionDigits:2}).format(profile.layerHeight)} mm</span>}<span>{profile.format}</span></div>{profile.notes&&<p>{profile.notes}</p>}</div>{profile.downloadUrl&&<a className="button outline" href={profile.downloadUrl} aria-label={`${copy.download}: ${profile.name}`}>{copy.download} ↓</a>}</article>)}</div>{partnerLink&&!available&&<a className="text-link" href={`/${lang}/clube#colecoes`}>{copy.access} ↗</a>}</section>;
}
