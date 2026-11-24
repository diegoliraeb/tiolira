import {subscriberPurchaseCopy} from '../lib/subscriber-purchase.mjs';
export default function SubscriberPurchaseBadge({product,lang='pt',owned=false}){
 if(!product?.subscriberPurchaseOnly)return null;
 const copy=subscriberPurchaseCopy[lang]||subscriberPurchaseCopy.pt;
 return <div className="subscriber-purchase-notice"><span className="subscriber-purchase-badge">{copy.badge}</span>{!owned&&<p className="subscriber-purchase-requirement">{copy.requirement}</p>}</div>;
}
