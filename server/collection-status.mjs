import {z} from 'zod';
import {updateRecord,Conflict} from './store.mjs';
const schema=z.object({id:z.string().min(1).max(120),comingSoon:z.boolean(),expectedComingSoon:z.boolean()});
// Patch only this field on the newest catalog, preserving concurrent uploads.
export async function setCollectionPreparation(input){
 const parsed=schema.parse(input);
 await updateRecord('catalog.json',old=>{
  const collection=old?.collections?.find(c=>c.id===parsed.id);
  if(!collection)throw Object.assign(Error('Coleção não encontrada.'),{status:404});
  const current=Boolean(collection.comingSoon);
  if(current===parsed.comingSoon)return old;
  if(current!==parsed.expectedComingSoon)throw new Conflict();
  collection.comingSoon=parsed.comingSoon;
  old.updatedAt=new Date().toISOString();
  return old;
 });
 return {ok:true};
}
