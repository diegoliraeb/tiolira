import {asaasConfig} from './asaas.mjs';
import {paypalConfig} from './paypal.mjs';
export const currentOrderEnvironment=o=>o.environment===(o.provider==='paypal'?paypalConfig().environment:asaasConfig().environment);
