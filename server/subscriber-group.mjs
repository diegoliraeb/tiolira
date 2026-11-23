import {subscriptionDashboard} from './maker-subscriptions.mjs';
import {readRecord} from './store.mjs';
import {CLUB_KEY,clubDefaults} from './instagram-club.mjs';

// Resolve the invitation on the server after a fresh subscription check.
export async function subscriberGroup(member,{join=false}={}){
 const subscription=await subscriptionDashboard(member);
 const active=subscription.active===true&&Date.parse(subscription.validUntil)>Date.now();
 if(!join)return {active};
 if(!active)throw Object.assign(Error('Entre com uma assinatura ativa para acessar o grupo.'),{status:403});
 const invite=(await readRecord(CLUB_KEY))?.data?.inviteUrl||clubDefaults().inviteUrl;
 if(!/^https:\/\/chat\.whatsapp\.com\/[A-Za-z0-9]{20,32}$/.test(invite))throw Object.assign(Error('Convite indisponível. Fale com o Tio Lira.'),{status:503});
 return {invite};
}
