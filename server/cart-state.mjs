import {createHash} from 'node:crypto';
import {currentOrderEnvironment} from './payment-environment.mjs';
export const cartKey=c=>createHash('sha256').update(c.memberId+':'+c.cartId).digest('hex');
export function cartState(cart,orders,now=Date.now()){
 if(!cart.items?.length)return 'cleared';
 const relevant=orders.filter(o=>o.memberId===cart.memberId&&currentOrderEnvironment(o)&&Date.parse(o.createdAt)>=Date.parse(cart.createdAt)-5000&&cart.productIds.every(id=>o.productIds?.includes(id)));
 if(relevant.some(o=>o.status==='paid'))return 'paid';
 if(relevant.some(o=>['pending','creating','overdue','review'].includes(o.status)))return 'checkout';
 return now-Date.parse(cart.updatedAt)>=3600000?'abandoned':'active';
}
