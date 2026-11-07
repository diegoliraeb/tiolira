import {natalState,NATAL_COLLECTION_ID,pendingNatal} from '../lib/natal-promotion.mjs';
import {currentOrderEnvironment} from './payment-environment.mjs';
const fail=()=>{throw Object.assign(Error('Você já tem uma oferta de Natal reservada em um pedido. Acesse Meus pedidos para concluir ou conferir esse pagamento.'),{status:409});};
export const memberNatalState=(orders,memberId,data,now=Date.now())=>natalState(orders.filter(currentOrderEnvironment),data.products,memberId,now);
const selectionKey=items=>JSON.stringify([...new Map(items.map(i=>[i.kind+':'+i.id,{kind:i.kind,id:i.id,quantity:i.quantity||1}])).values()].sort((a,b)=>(a.kind+a.id).localeCompare(b.kind+b.id)));
export function natalReservation(orders,memberId,data,parsed,provider,environment){
 if(!parsed.items.some(i=>i.kind==='product'&&data.products.some(p=>p.id===i.id&&p.collection===NATAL_COLLECTION_ID)))return null;
 const pending=orders.find(o=>o.memberId===memberId&&currentOrderEnvironment(o)&&pendingNatal(o));
 if(!pending)return null;
 if(pending.provider===provider&&pending.environment===environment&&selectionKey(pending.items)===selectionKey(parsed.items)&&(pending.coupon?.code||'')===(parsed.couponCode||'')&&pending.totalCents===parsed.expectedTotalCents)return pending;
 fail();
}
