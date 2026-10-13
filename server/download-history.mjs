// Keep per-partner totals independently of the rolling list of recent events.
export function downloadPartners(state){
 if(Array.isArray(state.downloadPartners))return state.downloadPartners;
 const partners=[];
 for(const event of state.recentDownloads||[]){
  if(!event.memberId||!event.productId)continue;
  addPartnerDownload(partners,event);
 }
 return partners;
}

export function addPartnerDownload(partners,event){
 const previous=partners.find(p=>p.productId===event.productId&&p.memberId===event.memberId);
 if(previous){
  previous.downloads++;
  if(event.at<previous.firstAt)previous.firstAt=event.at;
  if(event.at>=previous.lastAt){previous.lastAt=event.at;previous.memberName=event.memberName;}
 }else partners.push({productId:event.productId,memberId:event.memberId,memberName:event.memberName,downloads:1,firstAt:event.at,lastAt:event.at});
}
