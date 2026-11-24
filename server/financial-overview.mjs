import {readRecord} from './store.mjs';
import {asaasConfig} from './asaas.mjs';
import {paypalConfig} from './paypal.mjs';
import {buildFinancialOverview,financeRange} from '../lib/financial-overview.mjs';
export async function financialOverview(filters={},now=Date.now()){
 financeRange(filters,now);
 const [commerce,purchases,legacy]=await Promise.all(['commerce.json','maker-license-purchases.json','maker-subscriptions.json'].map(readRecord));
 return buildFinancialOverview({commerce:commerce?.data,purchases:purchases?.data,legacy:legacy?.data},{asaas:asaasConfig().environment,paypal:paypalConfig().environment},filters,now);
}
