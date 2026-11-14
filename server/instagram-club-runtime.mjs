import {readRecord,updateRecord} from './store.mjs';
import {createInstagramClub} from './instagram-club.mjs';
import {instagramClubApi} from './instagram-club-api.mjs';
export const instagramClub=createInstagramClub({readRecord,updateRecord,api:instagramClubApi()});
export async function receiveInstagramFeatures(payload,receivers){
 const results=await Promise.allSettled(receivers.map(receive=>receive(payload)));
 if(results.some(r=>r.status==='rejected'))throw Error('instagram_receiver_failed');
}
