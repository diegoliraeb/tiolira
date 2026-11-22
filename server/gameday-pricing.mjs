import {getCatalog} from './store.mjs';

// Compatibility for an already queued cron request. NFL BRL prices are now fixed,
// including the bundle; neither future FX quotes nor stale jobs may overwrite them.
export async function refreshGamedayPrices(){
 await getCatalog();
 return {changed:0,mode:'fixed-brl'};
}
