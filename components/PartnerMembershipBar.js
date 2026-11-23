'use client';
import {clubInterfaceCopy} from '../lib/club-interface-copy.mjs';
export default function PartnerMembershipBar({lang='pt',subscription}){
 const c=clubInterfaceCopy(lang);if(!subscription)return null;
 const active=subscription.active&&Date.parse(subscription.validUntil)>Date.now();
 return <aside className={`partner-membership-bar ${active?'is-active':subscription.pending?'is-pending':'is-inactive'}`} aria-label={c.about}><div><strong>{active?`✓ ${c.active}`:subscription.pending?c.pending:c.inactive}</strong>{active&&<span>{c.until}: <time dateTime={subscription.validUntil}>{new Date(subscription.validUntil).toLocaleDateString(lang,{timeZone:'America/Maceio'})}</time></span>}</div><nav aria-label={c.about}>{active?<a href="/api/club/subscriber-group?join=1" target="_blank" rel="noopener noreferrer">{c.group}</a>:<a href={`/${lang}/clube#assinatura`}>{subscription.pending?c.manage:c.subscribe}</a>}<a href={`/${lang}/assinatura/sobre`}>{c.about}</a></nav></aside>;
}
