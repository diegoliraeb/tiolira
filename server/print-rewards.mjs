import {randomUUID,createHash} from 'node:crypto';
import sharp from 'sharp';
import {z} from 'zod';
import {getCatalog,readRecord,writeRecord,updateRecord,Conflict} from './store.mjs';
import {memberAccessIds,canPurchaseProduct} from './commerce.mjs';
import {PRINT_REWARDS_KEY,emptyPrintRewards} from './print-rewards-access.mjs';
import {PRINT_ANGLES,PRINT_REWARD_TERMS} from '../lib/print-rewards.mjs';

const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
const id=z.string().regex(/^[a-z0-9][a-z0-9-]{0,99}$/);
const uuid=z.string().uuid();
const eligible=(p,data,config)=>config.collectionIds.includes(p.collection)&&canPurchaseProduct(p,data)&&!data.collections.find(c=>c.id===p.collection)?.comingSoon;
const photoUrl=(claimId,angle)=>`/api/club/print-rewards/photo?claimId=${claimId}&angle=${angle}`;
const view=c=>({id:c.id,productId:c.productId,productName:c.productName,collectionId:c.collectionId,collectionName:c.collectionName,image:c.image,status:c.status,version:c.version,createdAt:c.createdAt,submittedAt:c.submittedAt,reviewedAt:c.reviewedAt,feedback:c.feedback||'',photos:PRINT_ANGLES.filter(([a])=>c.photos[a]).map(([angle,label])=>({angle,label,url:photoUrl(c.id,angle)+`&v=${c.photos[angle].id}`})),downloadUrl:`/api/download?id=${encodeURIComponent(c.productId)}`,licenseUrl:`/api/club/licenses/download?code=${encodeURIComponent(c.license.code)}`});
const editable=c=>['printing','changes'].includes(c.status);
function ownedClaim(state,member,claimId){const c=state?.claims.find(c=>c.id===claimId&&c.memberId===member.id);if(!c)fail('Participação não encontrada.',404);return c;}
function checkVersion(c,version){if(c.version!==version)throw new Conflict();}
function complete(c){return PRINT_ANGLES.every(([a])=>c.photos[a])&&new Set(Object.values(c.photos).map(p=>p.hash)).size===5;}

export async function printRewardsDashboard(member){
 const [{data},record,owned]=await Promise.all([getCatalog(),readRecord(PRINT_REWARDS_KEY),memberAccessIds(member)]),s=record?.data||emptyPrintRewards(),claims=s.claims.filter(c=>c.memberId===member.id),active=claims.find(c=>c.status!=='approved');
 const products=data.products.filter(p=>eligible(p,data,s.config)&&!owned.has(p.id)).map(p=>({id:p.id,name:p.name,collectionId:p.collection,image:p.image}));
 return {enabled:s.config.enabled,canClaim:s.config.enabled&&!active&&products.length>0,collections:data.collections.filter(c=>s.config.collectionIds.includes(c.id)&&c.published&&!c.comingSoon).map(c=>({id:c.id,name:c.name})),products,claims:claims.slice().reverse().map(view),terms:PRINT_REWARD_TERMS};
}
export async function claimPrintReward(member,input){
 const parsed=z.object({productId:id,requestId:uuid,acceptTerms:z.literal(true)}).parse(input),{data}=await getCatalog(),owned=await memberAccessIds(member),now=new Date().toISOString();
 await updateRecord(PRINT_REWARDS_KEY,old=>{
  const s=old||emptyPrintRewards(),existing=s.claims.find(c=>c.memberId===member.id&&c.requestId===parsed.requestId);
  if(existing){if(existing.productId!==parsed.productId)fail('Esta escolha já foi utilizada.',409);return s;}
  if(!s.config.enabled)fail('A promoção está pausada.',409);
  if(s.claims.some(c=>c.memberId===member.id&&c.status!=='approved'))fail('Aguarde a aprovação das cinco fotos antes de escolher outra peça.',409);
  const p=data.products.find(p=>p.id===parsed.productId);
  if(!p||!eligible(p,data,s.config))fail('Escolha uma peça paga das coleções participantes.',409);
  if(owned.has(p.id)||s.claims.some(c=>c.memberId===member.id&&c.productId===p.id))fail('Você já possui esta peça. Escolha outra.',409);
  const claimId=randomUUID();
  s.claims.push({id:claimId,requestId:parsed.requestId,memberId:member.id,memberName:member.name,productId:p.id,productName:p.name,collectionId:p.collection,collectionName:data.collections.find(c=>c.id===p.collection).name,image:p.image,status:'printing',photos:{},createdAt:now,version:randomUUID(),terms:PRINT_REWARD_TERMS,consentedAt:now,history:[],license:{source:'print-reward',code:`TL-FOTO-${claimId.toUpperCase()}`,grantId:claimId,memberId:member.id,partnerName:member.name,productId:p.id,productName:p.name,issuedAt:now,status:'active',terms:'Autorizada a impressão e venda das peças físicas desta obra pelo parceiro identificado. Modelo digital recebido na promoção Imprima, fotografe e ganhe do Tio Lira 3D. Licença pessoal e intransferível. Não autoriza revender, compartilhar ou redistribuir os arquivos digitais.',productTerms:p.license||''}});return s;
 });
 return printRewardsDashboard(member);
}
export async function uploadPrintRewardPhoto(member,input){
 const parsed=z.object({claimId:uuid,version:uuid,angle:z.enum(PRINT_ANGLES.map(([a])=>a)),photo:z.string().max(2_800_000)}).parse(input);
 const current=ownedClaim((await readRecord(PRINT_REWARDS_KEY))?.data,member,parsed.claimId);checkVersion(current,parsed.version);
 if(!editable(current))fail('Este envio já está em análise ou aprovado.',409);
 const match=/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(parsed.photo);
 if(!match)fail('Envie uma foto JPG, PNG ou WebP de até 2 MB.');
 const bytes=Buffer.from(match[2],'base64');if(!bytes.length||bytes.length>2*1024*1024)fail('Envie uma foto de até 2 MB.');
 let encoded;
 try{const image=sharp(bytes,{limitInputPixels:30_000_000,failOn:'warning'}),meta=await image.metadata();if(!['jpeg','png','webp'].includes(meta.format)||(meta.pages||1)>1||Math.min(meta.width,meta.height)<600)throw Error();encoded=await image.rotate().resize({width:2400,height:2400,fit:'inside',withoutEnlargement:true}).webp({quality:90}).toBuffer();if(encoded.length>2*1024*1024)throw Error();}catch{fail('Use uma foto nítida JPG, PNG ou WebP, com pelo menos 600 pixels em cada lado e até 2 MB.');}
 const hash=createHash('sha256').update(encoded).digest('hex');
 if(Object.entries(current.photos).some(([a,p])=>a!==parsed.angle&&p.hash===hash))fail('Esta foto já foi enviada. Fotografe outro ângulo da peça.');
 const photoId=randomUUID();await writeRecord(`print-reward-photos/${photoId}.json`,{base64:encoded.toString('base64')},null);
 await updateRecord(PRINT_REWARDS_KEY,s=>{const c=ownedClaim(s,member,parsed.claimId);checkVersion(c,parsed.version);if(!editable(c))fail('Este envio já está em análise ou aprovado.',409);c.photos[parsed.angle]={id:photoId,hash};c.version=randomUUID();return s;});
 return printRewardsDashboard(member);
}
export async function submitPrintReward(member,input){
 const p=z.object({claimId:uuid,version:uuid,confirmPrinted:z.literal(true),acceptPhotoUse:z.literal(true)}).parse(input);
 await updateRecord(PRINT_REWARDS_KEY,s=>{const c=ownedClaim(s,member,p.claimId);if(c.status==='pending'&&c.submittedVersion===p.version)return s;checkVersion(c,p.version);if(!editable(c))fail('Este envio já foi concluído.',409);if(!complete(c))fail('Envie as cinco fotos, uma de cada ângulo, sem repetir imagens.');c.submittedVersion=p.version;c.status='pending';c.submittedAt=new Date().toISOString();c.confirmPrinted=true;c.photoConsent={text:PRINT_REWARD_TERMS,at:c.submittedAt};c.version=randomUUID();return s;});
 return printRewardsDashboard(member);
}
export async function adminPrintRewards(){
 const [record,{data}]=await Promise.all([readRecord(PRINT_REWARDS_KEY),getCatalog()]),s=record?.data||emptyPrintRewards();
 return {config:s.config,collections:data.collections.filter(c=>!c.free&&c.published&&!c.comingSoon).map(c=>({id:c.id,name:c.name,count:data.products.filter(p=>p.collection===c.id&&canPurchaseProduct(p,data)).length})),claims:s.claims.slice().reverse().map(c=>({...view(c),memberName:c.memberName,memberId:c.memberId,photoConsent:c.photoConsent||null,history:c.history})),counts:{pending:s.claims.filter(c=>c.status==='pending').length,approved:s.claims.filter(c=>c.status==='approved').length,photos:s.claims.filter(c=>c.status==='approved').length*5}};
}
export async function configurePrintRewards(admin,input){
 const p=z.object({enabled:z.boolean(),collectionIds:z.array(id).max(100),version:uuid.nullable()}).parse(input),{data}=await getCatalog();
 if(p.enabled&&!p.collectionIds.length)fail('Marque pelo menos uma coleção participante.');
 if(p.collectionIds.some(id=>!data.collections.some(c=>c.id===id&&!c.free&&c.published&&!c.comingSoon)))fail('Escolha coleções pagas publicadas e disponíveis.');
 if(p.enabled&&!data.products.some(x=>eligible(x,data,p)))fail('As coleções selecionadas precisam ter peças pagas com arquivos disponíveis.');
 await updateRecord(PRINT_REWARDS_KEY,old=>{const s=old||emptyPrintRewards();if(s.config.version!==p.version)throw new Conflict();s.config={enabled:p.enabled,collectionIds:[...new Set(p.collectionIds)],version:randomUUID(),updatedAt:new Date().toISOString(),updatedBy:admin.email};return s;});
 return adminPrintRewards();
}
export async function reviewPrintReward(admin,input){
 const p=z.object({claimId:uuid,version:uuid,decision:z.enum(['approved','changes']),feedback:z.string().trim().max(2000).default('')}).parse(input);
 if(p.decision==='changes'&&!p.feedback)fail('Informe o que o parceiro precisa corrigir.');
 await updateRecord(PRINT_REWARDS_KEY,s=>{
  const c=s?.claims.find(c=>c.id===p.claimId);if(!c)fail('Participação não encontrada.',404);
  if(c.reviewedVersion===p.version&&c.status===p.decision)return s;
  checkVersion(c,p.version);if(c.status!=='pending')fail('Apenas envios aguardando aprovação podem ser revisados.',409);
  if(p.decision==='approved'&&(!complete(c)||!c.photoConsent||!c.confirmPrinted))fail('O envio precisa conter cinco fotos e as confirmações do parceiro.');
  const now=new Date().toISOString();c.history.push({decision:p.decision,feedback:p.feedback,at:now,by:admin.email});c.reviewedVersion=p.version;c.status=p.decision;c.feedback=p.feedback;c.reviewedAt=now;c.version=randomUUID();return s;
 });return adminPrintRewards();
}
export async function printRewardPhoto({claimId,angle},{memberId,admin=false}={}){
 uuid.parse(claimId);z.enum(PRINT_ANGLES.map(([a])=>a)).parse(angle);
 const s=(await readRecord(PRINT_REWARDS_KEY))?.data,c=s?.claims.find(c=>c.id===claimId&&(admin||c.memberId===memberId));
 if(!c?.photos[angle])fail('Foto não encontrada.',404);
 const r=await readRecord(`print-reward-photos/${c.photos[angle].id}.json`);if(!r)fail('Foto não encontrada.',404);
 return {bytes:Buffer.from(r.data.base64,'base64'),filename:`${c.productId}-${angle}.webp`};
}
