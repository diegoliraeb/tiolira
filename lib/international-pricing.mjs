// Commercial price rule chosen by the owner, not a live foreign-exchange quote.
export const USD_BRL_DIVISOR=6;
export function internationalBuyer(member){
 const code=String(member?.countryCode||'').toUpperCase();
 if(/^[A-Z]{2}$/.test(code))return code!=='BR';
 const country=String(member?.country||'').trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 return Boolean(country&&!['brasil','brazil','br'].includes(country));
}
export function usdPriceCents(item){
 if(!(item.priceCents>0))return 0;
 if(Number.isSafeInteger(item.priceUsdCents)&&item.priceUsdCents>0)return item.priceUsdCents;
 return item.priceCents>0?Math.max(1,Math.round(item.priceCents/USD_BRL_DIVISOR)):0;
}
export function marketCatalog(data,currency){
 if(currency!=='USD')return data;
 return {...data,products:data.products.map(p=>({...p,priceCents:usdPriceCents(p)})),collections:data.collections.map(c=>({...c,priceCents:usdPriceCents(c)}))};
}
export const formatMoney=(cents,currency='BRL',locale='pt-BR')=>new Intl.NumberFormat(locale,{style:'currency',currency}).format((cents||0)/100);
export function paypalApprovalUrl(value,environment){
 try{const u=new URL(value);const hosts=environment==='production'?['www.paypal.com','paypal.com']:environment==='sandbox'?['www.sandbox.paypal.com','sandbox.paypal.com']:['www.paypal.com','paypal.com','www.sandbox.paypal.com','sandbox.paypal.com'];
 if(u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&hosts.includes(u.hostname)&&['/checkoutnow','/webapps/hermes'].includes(u.pathname)&&u.searchParams.has('token'))return u.href;}catch{}
 return '';
}
export const paypalPaymentUrl=order=>order?.provider==='paypal'&&['pending','overdue'].includes(order.status)?paypalApprovalUrl(order.paymentUrl):'';
