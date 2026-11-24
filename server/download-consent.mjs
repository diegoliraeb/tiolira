import {randomBytes} from 'node:crypto';
import {DOWNLOAD_CONSENT_VERSION,downloadConsentCopies,downloadLanguage} from '../lib/download-consent.mjs';
import {assertOrigin} from './auth.mjs';
import {authorizeProductDownload,serveProductDownload} from './product-download.mjs';
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export async function readDownloadAcceptance(req){
 assertOrigin(req);
 if(!/^application\/x-www-form-urlencoded(?:;|$)/i.test(req.headers['content-type']||''))fail('Formato de confirmação inválido.',415);
 if(req.headers['content-length']!==undefined&&(!/^\d+$/.test(String(req.headers['content-length']))||Number(req.headers['content-length'])>4096))fail('Confirmação muito grande.',413);
 let raw='';if(req.body!==undefined){if(typeof req.body!=='string'&&!Buffer.isBuffer(req.body))fail('Confirmação inválida.');raw=String(req.body);}else{for await(const part of req){raw+=Buffer.from(part).toString('utf8');if(Buffer.byteLength(raw)>4096)fail('Confirmação muito grande.',413);}}
 if(Buffer.byteLength(raw)>4096)fail('Confirmação muito grande.',413);
 const fields=new URLSearchParams(raw);
 if(['accepted','version','lang'].some(k=>fields.getAll(k).length!==1)||fields.get('accepted')!=='yes'||fields.get('version')!==DOWNLOAD_CONSENT_VERSION||!Object.hasOwn(downloadConsentCopies,fields.get('lang')))fail('Leia e aceite as condições antes de baixar o arquivo.');
 return {version:DOWNLOAD_CONSENT_VERSION,acceptedAt:new Date().toISOString(),lang:fields.get('lang')};
}
export function downloadConsentHtml({product,file,lang='pt',nonce}){
 const c=downloadConsentCopies[lang],traced=/\.3mf$/i.test(file.filePath);
 const action='/api/download?'+new URLSearchParams({id:product.id,profile:file.id,lang});
 return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${esc(traced?c.title:c.plainTitle)} · Tio Lira</title><style>
 *{box-sizing:border-box}body{margin:0;background:#f4f0e5;color:#243d2c;font:16px/1.6 system-ui,-apple-system,sans-serif}main{max-width:700px;margin:40px auto;padding:28px 36px;background:#fffdf7;border:1px solid #ded8c9;border-radius:24px;box-shadow:0 12px 40px #243d2c0a}.brand{display:flex;align-items:center;gap:12px;font-size:20px;font-weight:650;color:inherit;text-decoration:none}.brand img{width:44px;height:44px;object-fit:contain}.eyebrow{font-size:11px;letter-spacing:.16em;margin:28px 0 8px;color:#6a715e}h1{font-size:clamp(27px,5vw,38px);line-height:1.15;letter-spacing:-.035em;margin:0 0 18px}.piece{padding:12px 16px;background:#f1edde;border-radius:12px;overflow-wrap:anywhere}.piece strong,.piece small{display:block}.piece small{font-size:13px;color:#68705f}p{margin:16px 0}.check{display:flex;align-items:flex-start;gap:12px;padding:16px;background:#edf2e8;border:1px solid #c8d5bd;border-radius:12px;margin:24px 0 18px;cursor:pointer}.check input{flex:none;width:21px;height:21px;margin:3px 0;accent-color:#254931}.actions{display:flex;gap:12px;justify-content:flex-end}.button{display:inline-flex;justify-content:center;align-items:center;min-height:48px;padding:10px 22px;border:1px solid #254931;border-radius:28px;font:600 15px/1.4 system-ui;text-decoration:none;color:#254931;background:transparent;cursor:pointer}.primary{background:#254931;color:#fff}button:disabled{opacity:.45;cursor:not-allowed}a:focus-visible,button:focus-visible,input:focus-visible{outline:3px solid #bd6b38;outline-offset:4px}#status{font-size:14px;color:#68705f;margin-bottom:0}footer{font-size:12px;text-align:center;color:#68705f;padding-top:20px}@media(max-width:600px){main{margin:12px;padding:24px 20px;border-radius:18px}.actions{flex-direction:column-reverse}.button{width:100%}.check{padding:14px}}
 </style></head><body><main><a class="brand" href="/${lang}/clube"><img src="/assets/tl-monogram-3d-icon.png" alt="">Tio Lira</a><p class="eyebrow">${c.before}</p><h1>${esc(traced?c.title:c.plainTitle)}</h1><div class="piece"><strong>${esc(product.name)}</strong><small>${esc(file.name)}</small></div>${traced?`<p>${esc(c.intro)}</p>`:''}<p>${esc(c.use)} <strong>${esc(c.restriction)}</strong></p><p>${traced?esc(c.trace)+' ':''}${esc(c.legal)}</p><form method="post" action="${esc(action)}"><input type="hidden" name="version" value="${DOWNLOAD_CONSENT_VERSION}"><input type="hidden" name="lang" value="${lang}"><label class="check"><input id="accepted" name="accepted" type="checkbox" value="yes" required><span>${esc(c.agree)}</span></label><div class="actions"><a class="button" href="/${lang}/clube#inicio">${c.cancel}</a><button class="button primary" id="download" type="submit" disabled>${c.download}</button><noscript><button class="button primary" type="submit">${c.download}</button></noscript></div><p id="status" role="status" aria-live="polite"></p></form><footer>tiolira.com.br</footer></main><script nonce="${nonce}">const check=document.getElementById('accepted'),button=document.getElementById('download');const sync=()=>{button.disabled=!check.checked};check.addEventListener('change',sync);window.addEventListener('pageshow',()=>{check.checked=false;sync()});document.querySelector('form').addEventListener('submit',()=>{document.getElementById('status').textContent=${JSON.stringify(c.wait)};button.disabled=true;setTimeout(sync,45000)});</script></body></html>`;
}
export async function handleDownloadConsent({req,res,url,member,data},deps={}){
 const args={member,data,productId:url.searchParams.get('id'),profileId:url.searchParams.get('profile'),res};
 if(req.method==='POST'){
  const acceptance=await readDownloadAcceptance(req);
  return (deps.download||serveProductDownload)({...args,acceptance},deps);
 }
 const {product,file}=await (deps.authorize||authorizeProductDownload)(args,deps),lang=downloadLanguage(req,url),nonce=randomBytes(18).toString('base64');
 res.setHeader('Content-Type','text/html; charset=utf-8');res.setHeader('Cache-Control','private, no-store');res.setHeader('Referrer-Policy','same-origin');
 res.setHeader('Content-Security-Policy',`default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'`);
 res.statusCode=200;return res.end(downloadConsentHtml({product,file,lang,nonce}));
}
