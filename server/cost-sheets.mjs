import {z} from 'zod';
import {createHash,randomUUID} from 'node:crypto';
import {readRecord,writeRecord,getCatalog,Conflict} from './store.mjs';
import {artworkDefaults,workshopKeys,calculateArtwork} from '../lib/calculator.mjs';
const productIdSchema=z.string().regex(/^[a-z0-9][a-z0-9-]{0,99}$/);
export const groupItemsSchema=z.array(z.object({productId:productIdSchema,quantity:z.number().int().min(1).max(999)})).min(1).max(100).refine(items=>new Set(items.map(i=>i.productId)).size===items.length,'Obras duplicadas.');
const amount=z.number().finite().min(0).max(1_000_000);
export const valuesSchema=z.object(Object.fromEntries(Object.keys(artworkDefaults).map(k=>[k,amount]))).superRefine((v,ctx)=>{try{calculateArtwork(v);}catch{ctx.addIssue({code:'custom',message:'Confira os valores: taxas + margem e falhas devem ficar abaixo de 100%.'});}});
const profileSchema=z.object(Object.fromEntries(workshopKeys.map(k=>[k,k==='failure'?amount.lt(100):amount])));
const key=member=>'cost-sheets/'+createHash('sha256').update(member.id).digest('hex')+'.json';
const empty=()=>({profile:null,sheets:[]});
export async function costSheets(member){const r=await readRecord(key(member));return {...(r?.data||empty()),revision:r?.etag||null};}
export async function saveCostSheet(member,input){
 const parsed=z.discriminatedUnion('action',[
  z.object({action:z.literal('profile'),revision:z.string().nullable(),profile:profileSchema}),
  z.object({action:z.literal('sheet'),revision:z.string().nullable(),productId:productIdSchema.nullable(),groupId:z.string().uuid().optional(),items:groupItemsSchema.optional(),customId:z.string().uuid().optional(),customName:z.string().trim().min(1).max(100).optional(),values:valuesSchema,channel:z.enum(['direct','card','market']),offer:amount})
 ]).parse(input);
 const current=await costSheets(member);if(current.revision!==parsed.revision)throw new Conflict();
 let next={profile:current.profile,sheets:current.sheets};
 if(parsed.action==='profile')next.profile=parsed.profile;
 else{
  const {data}=await getCatalog(),group=!!parsed.items,custom=parsed.productId===null&&!group;
  if(group&&(parsed.productId!==null||parsed.customId||parsed.customName))throw Object.assign(Error('Ficha de grupo inválida.'),{status:400});
  if(parsed.groupId&&!group)throw Object.assign(Error('Informe as obras do grupo.'),{status:400});
  const available=id=>data.products.find(p=>p.id===id&&p.published&&data.collections.some(c=>c.id===p.collection&&c.published));
  if(group&&parsed.items.some(item=>!available(item.productId)))throw Object.assign(Error('Obra não disponível.'),{status:404});
  const p=group?{id:null,name:parsed.items.map(item=>`${item.quantity} × ${available(item.productId).name}`).join(' · ')}:custom?{id:null,name:parsed.customName}:available(parsed.productId);
  if(custom&&!parsed.customName)throw Object.assign(Error('Informe o nome da peça avulsa.'),{status:400});
  const sheetId=group?(parsed.groupId||randomUUID()):custom?(parsed.customId||randomUUID()):parsed.productId;
  const matches=s=>group?s.groupId===sheetId:custom?s.customId===sheetId:s.productId===parsed.productId;
  if(!p)throw Object.assign(Error('Obra não disponível.'),{status:404});
  if(!next.sheets.some(matches)&&next.sheets.length>=200)throw Object.assign(Error('Limite de 200 fichas por conta.'),{status:400});
  const sheet={...(group?{groupId:sheetId,items:parsed.items}:custom?{customId:sheetId}:{}),productId:p.id,productName:p.name,values:parsed.values,channel:parsed.channel,offer:parsed.offer,updatedAt:new Date().toISOString(),result:calculateArtwork(parsed.values)};
  next.sheets=[sheet,...next.sheets.filter(s=>!matches(s))];
 }
 return {...next,revision:await writeRecord(key(member),next,current.revision)};
}
