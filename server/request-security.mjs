const fail=(message,status)=>{throw Object.assign(Error(message),{status});};

// Large payloads are reserved for the existing image/file workflows.
// Login and telemetry must never allocate the old 36 MB global JSON allowance.
export function requestBodyLimit(route){
 if(route==='admin/upload')return 35_500_000;
 if(['stores/apply','club/profile','club/reviews','club/messages','admin/messages','admin/stores'].includes(route))return 3_100_000;
 if(/^(admin|club)\/(login|setup|forgot-password|reset-password|logout)$/.test(route))return 16_384;
 if(['analytics/event','products/click'].includes(route))return 8_192;
 if(route.startsWith('webhooks/'))return 1_000_000;
 return 262_144;
}
export async function readJsonBody(req,limit=262_144){
 const length=req.headers?.['content-length'];
 if(length!==undefined&&(!/^\d+$/.test(String(length))||Number(length)>limit))fail('Conteúdo muito grande.',413);
 let raw;
 if(req.body!==undefined)raw=typeof req.body==='string'?req.body:JSON.stringify(req.body);
 else{
  const chunks=[];let bytes=0;
  for await(const part of req){const chunk=Buffer.from(part);bytes+=chunk.length;if(bytes>limit)fail('Conteúdo muito grande.',413);chunks.push(chunk);}
  raw=Buffer.concat(chunks).toString('utf8');
 }
 if(Buffer.byteLength(raw||'','utf8')>limit)fail('Conteúdo muito grande.',413);
 const value=raw?JSON.parse(raw):{};
 if(!value||typeof value!=='object'||Array.isArray(value))fail('Envie um objeto JSON válido.',400);
 return value;
}
