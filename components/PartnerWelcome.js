import {localizeOrder} from '../lib/i18n';
import MovementWaves from './MovementWaves';
import {collectionCover} from '../lib/collection-covers.mjs';

export function PartnerCollections({groups,items,t,onSelect}){
 return <div className="partner-collection-grid">{groups.map(group=><button className="partner-collection-tile" key={group.id} onClick={()=>onSelect(group.id)} aria-label={`${t.explore}: ${group.name}`}><img src={collectionCover(group)} alt="" loading="lazy" width="600" height="600"/>{group.comingSoon&&<span className="partner-tile-tag">{t.soon}</span>}<span className="partner-tile-label"><span>{group.name}<small>{items.filter(item=>item.collection===group.id).length} {t.works.toLowerCase()}</small></span><b aria-hidden="true">↗</b></span></button>)}</div>;
}
export default function PartnerWelcome({lang,member,groups,items,t,copy,motion,cartState,onCollections,onFiles,onOrders}){
 const nativity=groups.find(c=>c.id==='presepio')||groups[0];
 const recent=cartState.data?.orders.filter(o=>o.status==='paid').sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt))[0];
 const recentImage=recent?.items.map(i=>i.products?.[0]?.id).map(id=>cartState.data.products.find(p=>p.id===id)?.image).find(Boolean);
 return <section className="partner-atelier">
  <div className="partner-welcome"><MovementWaves enabled={motion}/><div className="partner-welcome-copy"><p className="eyebrow">{copy.hello}, {member.name?.split(' ')[0]}.</p><h1>{copy.title}<br/><em>{copy.create}</em></h1><p>{copy.intro}</p><button className="button primary" onClick={()=>onCollections('all')}>{copy.explore} ↗</button></div>{nativity&&<img className="partner-welcome-image" src={collectionCover(nativity)} alt={nativity.name} width="400" height="400"/>}</div>
  {recent&&<><div className="partner-section-title"><h2>{copy.recent}</h2><button className="text-link" onClick={onOrders}>{copy.orders} →</button></div><article className="partner-recent-purchase">{recentImage&&<img src={recentImage} alt="" width="80" height="90"/>}<div><span className="partner-paid-status">✓ {copy.released}</span><h3>{localizeOrder(recent,lang).items.map(i=>i.name).join(', ')}</h3><small>{copy.filesReady}</small></div><button className="button primary" onClick={onFiles}>{copy.files} ↗</button></article></>}
  <div className="partner-section-title"><h2>{copy.collectionsTitle}</h2><button className="text-link" onClick={()=>onCollections('all')}>{t.all} →</button></div><PartnerCollections groups={groups} items={items} t={t} onSelect={onCollections}/>
 </section>;
}
