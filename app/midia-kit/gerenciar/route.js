import {randomUUID,randomBytes} from 'node:crypto';
import {isMediaKitAdmin,mediaKitDenied,mediaKitHeaders} from '../../../server/media-kit-access.mjs';
import {stageMediaKit,publishMediaKit,activeMediaKit} from '../../../server/media-kit-storage.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=60;
export async function GET(request){
 if(!await isMediaKitAdmin(request))return mediaKitDenied();
 const edition=randomUUID(),nonce=randomBytes(18).toString('base64'),active=await activeMediaKit();
 return new Response(`<!doctype html><html lang="pt-BR"><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Atualizar mídia kit · Tio Lira</title><style>body{font:16px/1.6 system-ui;margin:40px auto;padding:20px;max-width:720px;background:#f6f1e8;color:#25382d}button,a{font:inherit}button{padding:12px 20px;margin-top:20px;background:#25382d;color:white;border:0;border-radius:24px}input{display:block;margin:20px 0;max-width:100%}pre{white-space:pre-wrap;font:13px/1.5 system-ui}</style></head><body><a href="/admin">← Administração</a><h1>Mídia kit reservado</h1><p>${active?'Há uma edição publicada. Ela será mantida até o novo envio terminar.':'Envie a apresentação para ativar o link reservado.'}</p><p>Selecione content.json, o PDF e as imagens da edição. Cada arquivo deve ter até 4 MB. Os arquivos ficam no armazenamento privado.</p><form id="upload"><label>Arquivos da apresentação<input type="file" id="files" name="files" multiple accept=".json,.jpg,.png,.pdf" required></label><button id="submit" type="submit">Enviar e publicar apresentação</button></form><pre id="status" role="status"></pre><a href="/midia-kit">Abrir link reservado →</a><script nonce="${nonce}">document.getElementById('upload').addEventListener('submit',async function(e){e.preventDefault();const button=document.getElementById('submit'),status=document.getElementById('status');button.disabled=true;status.textContent='Iniciando envio privado…';try{for(const file of document.getElementById('files').files){const data=new FormData();data.set('edition','${edition}');data.set('file',file);const r=await fetch('/midia-kit/gerenciar',{method:'POST',body:data});const j=await r.json();if(!r.ok)throw Error(j.error||'Falha no envio');status.textContent+='\nEnviado: '+file.name;}const data=new FormData();data.set('edition','${edition}');data.set('action','publish');const r=await fetch('/midia-kit/gerenciar',{method:'POST',body:data});const j=await r.json();if(!r.ok)throw Error(j.error||'Falha na publicação');status.textContent+='\nApresentação publicada com sucesso. O link reservado está pronto.';}catch(err){status.textContent+='\n'+err.message;}finally{button.disabled=false;}});</script></body></html>`,{headers:{...mediaKitHeaders,'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':`default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}'; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'`}});
}
export async function POST(request){
 if(!await isMediaKitAdmin(request))return mediaKitDenied();
 const origin=request.headers.get('origin');
 // Only same-origin admin forms may upload or publish a private edition.
 if(!origin||!['https://www.tiolira.com.br','https://tiolira.com.br',...(process.env.NODE_ENV!=='production'?['http://127.0.0.1:8774']:[])].includes(origin))return new Response('Origem não permitida.',{status:403,headers:mediaKitHeaders});
 try{
  if(Number(request.headers.get('content-length')||0)>4100000)throw new Error('Arquivo muito grande.');
  const form=await request.formData(),edition=String(form.get('edition')||'');
  if(form.get('action')==='publish')await publishMediaKit(edition);
  else {const file=form.get('file');if(!file||typeof file.arrayBuffer!=='function')throw new Error('Selecione um arquivo.');await stageMediaKit(edition,file);}
  return Response.json({ok:true},{headers:mediaKitHeaders});
 }catch(e){return Response.json({error:e.message||'Não foi possível atualizar.'},{status:400,headers:mediaKitHeaders});}
}
