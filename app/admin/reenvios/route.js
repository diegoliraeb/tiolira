import {requireAdmin} from '../../../server/auth.mjs';
import {emailRecoveryReport,recoverEmailJob} from '../../../server/email-recovery.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=60;
const headers={'Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'"};
const escape=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const admin=request=>requireAdmin({headers:{cookie:request.headers.get('cookie')||''}});
export async function GET(request){
 try{await admin(request);}catch{return new Response('Entre no admin para continuar.',{status:401,headers});}
 const jobs=await emailRecoveryReport();
 return new Response(`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Recuperar avisos · Tio Lira</title><style>body{font:16px/1.6 system-ui;background:#f5f0e4;color:#25382d;margin:40px auto;max-width:850px;padding:20px}article{background:white;padding:20px;margin:16px 0;border-radius:16px}button{padding:12px 20px;background:#25382d;color:white;border:0;border-radius:24px}small{display:block}</style><a href="/admin">← Administração</a><h1>Recuperar avisos de e-mail</h1><p>Somente os avisos com recuperação autorizada. Envios processados não são repetidos. Códigos de confirmação recebem nova validade de 15 minutos.</p>${jobs.map(j=>`<article><strong>${escape(j.email)}</strong><small>${j.kind==='verification'?'Confirmação de e-mail':'Lembrete de carrinho'} · ${escape(j.status)}</small><p>${escape(j.result)}</p>${j.status==='pending'?`<form method="post"><input type="hidden" name="id" value="${escape(j.id)}"><button>Reenviar ${escape(j.email)}</button></form>`:''}</article>`).join('')}</html>`,{headers:{...headers,'Content-Type':'text/html; charset=utf-8'}});
}
export async function POST(request){
 let actor;try{actor=await admin(request);}catch{return new Response('Não autorizado.',{status:401,headers});}
 if(!['https://www.tiolira.com.br','https://tiolira.com.br'].includes(request.headers.get('origin')))return new Response('Origem inválida.',{status:403,headers});
 if(Number(request.headers.get('content-length')||0)>2048)return new Response('Requisição inválida.',{status:413,headers});
 try{const form=await request.formData();await recoverEmailJob(String(form.get('id')||''),actor.email);}
 catch{return new Response('Não foi possível concluir. Volte e confira o resultado antes de repetir.',{status:409,headers});}
 return new Response(null,{status:303,headers:{...headers,Location:'/admin/reenvios'}});
}
