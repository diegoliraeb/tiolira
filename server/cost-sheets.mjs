import {z} from 'zod';
import {createHash,randomUUID} from 'node:crypto';
import {readRecord,writeRecord,getCatalog,Conflict} from './store.mjs';
import {artworkDefaults,workshopKeys,calculateArtwork} from '../lib/calculator.mjs';
const amount=z.number().finite().min(0).max(1_000_000);
const valuesSchema=z.object(Object.fromEntries(Object.keys(artworkDefaults).map(k=>[k,amount]))).superRefine((v,ctx)=>{try{calculateArtwork(v);}catch{ctx.addIssue({code:'custom',message:'Confira os valores: taxas + margem e falhas devem ficar abaixo de 100%.'});}});
const profileSchema=z.object(Object.fromEntries(workshopKeys.map(k=>[k,k==='failure'?amount.lt(100):amount])));
const key=member=>'cost-sheets/'+createHash('sha256').update(member.id).digest('hex')+'.json';
const empty=()=>({profile:null,sheets:[]});
export async function costSheets(member){const r=await readRecord(key(member));return {...(r?.data||empty()),revision:r?.etag||null};}
export async function saveCostSheet(member,input){
 const parsed=z.discriminatedUnion('action',[
  z.object({action:z.literal('profile'),revision:z.string().nullable(),profile:profileSchema}),
  z.object({action:z.literal('sheet'),revision:z.string().nullable(),productId:z.string().regex(/^[a-z0-9][a-z0-9-]{0,99}$/).nullable(),customId:z.string().uuid().optional(),customName:z.string().trim().min(1).max(100).optional(),values:valuesSchema,channel:z.enum(['direct','card','market']),offer:amount})
 ]).parse(input);
 const current=await costSheets(member);if(current.revision!==parsed.revision)throw new Conflict();
 let next={profile:current.profile,sheets:current.sheets};
 if(parsed.action==='profile')next.profile=parsed.profile;
 else{
  const {data}=await getCatalog(),custom=parsed.productId===null,p=custom?{id:null,name:parsed.customName}:data.products.find(p=>p.id===parsed.productId&&p.published&&data.collections.some(c=>c.id===p.collection&&c.published));
  if(custom&&!parsed.customName)throw Object.assign(Error('Informe o nome da peça avulsa.'),{status:400});
  const sheetId=custom?(parsed.customId||randomUUID()):parsed.productId;
  const matches=s=>custom?s.customId===sheetId:s.productId===parsed.productId;
  if(!p)throw Object.assign(Error('Obra não disponível.'),{status:404});
  if(!next.sheets.some(matches)&&next.sheets.length>=200)throw Object.assign(Error('Limite de 200 fichas por conta.'),{status:400});
  const sheet={...(custom?{customId:sheetId}:{}),productId:p.id,productName:p.name,values:parsed.values,channel:parsed.channel,offer:parsed.offer,updatedAt:new Date().toISOString(),result:calculateArtwork(parsed.values)};
  next.sheets=[sheet,...next.sheets.filter(s=>!matches(s))];
 }
 return {...next,revision:await writeRecord(key(member),next,current.revision)};
}
