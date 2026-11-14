import {randomUUID,createHash} from 'node:crypto';
import {instagramPostUrl} from './instagram-promotion-rules.mjs';
export const CLUB_ACCOUNT='17841400549300615';
export const CLUB_KEY='instagram-whatsapp-club.json';
export const clubDefaults=()=>({active:false,version:'draft',postUrl:'https://www.instagram.com/p/DeXgxjJJUXM/',mediaId:'',inviteUrl:'https://chat.whatsapp.com/DneG0504G4y4tpTuDY8Aag',startsAt:null});
export const clubKeyword=text=>typeof text==='string'&&/^[\s!.,🧩]*clube[\s!.,🧩]*$/iu.test(text.normalize('NFKC'));
const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
const id=value=>/^\d{1,30}$/.test(String(value||''));
export const clubMessage=config=>`Opa! Tio Lira por aqui! 🧩\n\nAqui está seu convite para o Clube Tio Lira 3D no WhatsApp:\n${config.inviteUrl}\n\nNovidades, dicas de impressão e montagem e arquivos gratuitos selecionados para nossa turma. Toque no link e escolha entrar. Te espero lá!`;
export function createInstagramClub({readRecord,updateRecord,api,now=Date.now}){
 const config=async()=>(await readRecord(CLUB_KEY))?.data||clubDefaults();
 async function admin(){const c=await config();return {config:c,connected:api.ready(),message:clubMessage(c),recent:(await readRecord('instagram-club-report.json'))?.data?.recent||[]};}
 async function configure(input){
  if(typeof input.active!=='boolean')fail('Informe se a automação está ativa.');
  const postUrl=instagramPostUrl(input.postUrl);
  if(!postUrl)fail('Informe o link do Reels de @tiolira.');
  const inviteUrl=String(input.inviteUrl||'').trim();
  if(!/^https:\/\/chat\.whatsapp\.com\/[A-Za-z0-9]{20,32}$/.test(inviteUrl))fail('Informe um convite válido do WhatsApp.');
  const previous=await config();
  if(input.version!==previous.version)fail('Os dados mudaram. Atualize antes de salvar.',409);
  const mediaId=input.active?await api.resolvePost(CLUB_ACCOUNT,postUrl):previous.postUrl===postUrl?previous.mediaId:'';
  if(input.active&&!id(mediaId))fail('Não foi possível confirmar a publicação.');
  const version=randomUUID();
  await updateRecord(CLUB_KEY,current=>{
   const c=current||clubDefaults();if(c.version!==input.version)fail('Os dados mudaram. Atualize antes de salvar.',409);
   return {active:input.active,postUrl,inviteUrl,mediaId,version,startsAt:input.active&&(!c.active||c.mediaId!==mediaId)?new Date(now()).toISOString():c.startsAt};
  });return admin();
 }
 async function report(event){await updateRecord('instagram-club-report.json',current=>{const previous=current?.recent?.find(e=>e.key===event.key);const latest=event.status==='reserved'&&previous&&previous.status!=='reserved'?previous:event;return {recent:[latest,...(current?.recent||[]).filter(e=>e.key!==event.key)].slice(0,100)};});}
 async function receive(payload){
  if(payload?.object!=='instagram')return;
  const c=await config();if(!c.active||!c.mediaId)return;
  for(const entry of payload.entry||[]){
   if(String(entry.id)!==CLUB_ACCOUNT)continue;
   for(const change of entry.changes||[]){
    const v=change?.value;
    if(change.field!=='comments'||String(v?.media?.id)!==c.mediaId||!id(v?.id)||!clubKeyword(v?.text)||v?.hidden||v?.is_deleted||v?.verb==='remove')continue;
    const comment=await api.readComment(String(v.id));
    const sender=String(comment?.from?.id||''),stamp=Date.parse(comment?.timestamp);
    if(String(comment?.id)!==String(v.id)||!id(sender)||sender===CLUB_ACCOUNT||comment.from?.username?.toLowerCase()==='tiolira'||comment.hidden||comment.is_hidden||!clubKeyword(comment.text)||!Number.isFinite(stamp)||stamp<Date.parse(c.startsAt)||stamp>now()+60_000||now()-stamp>7*86400_000)continue;
    const latest=await config();if(!latest.active||latest.version!==c.version)return;
    const key=createHash('sha256').update(`${CLUB_ACCOUNT}:${c.mediaId}:${sender}`).digest('hex');
    const recordKey=`instagram-club-delivery/${key}.json`,attempt=randomUUID();
    const reservation=await updateRecord(recordKey,current=>current||{attempt,status:'reserved',at:new Date(now()).toISOString(),commentId:String(comment.id),mediaId:c.mediaId});
    if(reservation.attempt!==attempt){await report({key,...reservation});continue;}
    let result;
    try{const sent=await api.sendPrivateReply(String(comment.id),clubMessage(c));result={...reservation,status:'sent',messageId:sent.messageId};}
    catch{result={...reservation,status:'unconfirmed'};}
    // An uncertain send is never retried automatically: Meta may have accepted it.
    await updateRecord(recordKey,current=>current?.attempt===attempt?result:current);
    await report({key,...result});
   }
  }
 }
 return {admin,configure,receive};
}
