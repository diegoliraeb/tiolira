import {natalState,NATAL_COLLECTION_IDS,pendingNatal} from '../lib/natal-promotion.mjs';
import {currentOrderEnvironment} from './payment-environment.mjs';
const fail=()=>{throw Object.assign(Error('Você já tem uma oferta de Natal reservada em um pedido. Acesse Meus pedidos para concluir ou conferir esse pagamento.'),{status:409});};
export function memberNatalState(orders,memberId,data,now=Date.now()){
 const campaigns=NATAL_COLLECTION_IDS.map(id=>natalState(orders.filter(currentOrderEnvironment),data.products,memberId,now,id));
 return {...campaigns[0],campaigns};
}
const selectionKey=items=>JSON.stringify([...new Map(items.map(i=>[i.kind+':'+i.id,{kind:i.kind,id:i.id,quantity:i.quantity||1}])).values()].sort((a,b)=>(a.kind+a.id).localeCompare(b.kind+b.id)));
export function natalReservation(orders,memberId,data,parsed,provider,environment){
 const collections=NATAL_COLLECTION_IDS.filter(id=>parsed.items.some(i=>i.kind==='product'&&data.products.some(p=>p.id===i.id&&p.collection===id)));
 if(!collections.length)return null;
 const pending=orders.find(o=>o.memberId===memberId&&currentOrderEnvironment(o)&&collections.some(id=>pendingNatal(o,id)));
 if(!pending)return null;
 if(pending.provider===provider&&pending.environment===environment&&selectionKey(pending.items)===selectionKey(parsed.items)&&(pending.coupon?.code||'')===(parsed.couponCode||'')&&pending.totalCents===parsed.expectedTotalCents)return pending;
 fail();
}
