// Only the provider's HTTPS invoice addresses can be opened from the checkout.
export function invoiceUrl(value){
 try{const u=new URL(value);if(u.protocol==='https:'&&!u.username&&!u.password&&['www.asaas.com','asaas.com','sandbox.asaas.com','www.sandbox.asaas.com'].includes(u.hostname))return u.href;}catch{}
 return '';
}
export function cardPaymentUrl(order){
 return order?.billingType==='CREDIT_CARD'&&['pending','overdue'].includes(order.status)?invoiceUrl(order.paymentUrl):'';
}
