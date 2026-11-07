import {handleUploadPresigned} from '@vercel/blob/client';
import {issueSignedToken} from '@vercel/blob';
import {requireAdmin,assertOrigin,rateLimit} from '../../server/auth.mjs';
import {readJsonBody} from '../../server/request-security.mjs';

export const config={api:{bodyParser:false}};

export default async function handler(req,res){
 res.setHeader('X-Robots-Tag','noindex, nofollow');res.setHeader('Cache-Control','private, no-store');res.setHeader('X-Content-Type-Options','nosniff');
 try{
  if(req.method!=='POST')return res.status(405).json({error:'Método não permitido.'});
  if(!process.env.BLOB_STORE_ID&&!process.env.BLOB_READ_WRITE_TOKEN)throw Object.assign(new Error('Conecte um armazenamento Vercel Blob ao projeto e faça um novo deploy.'),{status:503});
  const body=await readJsonBody(req,16_384);
  const response=await handleUploadPresigned({body,request:req,getSignedToken:async pathname=>{
   assertOrigin(req);await requireAdmin(req);await rateLimit(req,'upload-token',120,600_000);
   let rules;
   if(/^models\/[a-f0-9-]{36}\.(stl|3mf|zip|pdf)$/i.test(pathname))rules={allowedContentTypes:['application/octet-stream','application/zip','application/pdf','model/3mf','model/stl','application/vnd.ms-package.3dmanufacturing-3mf'],maximumSizeInBytes:100_000_000};
   else if(/^images\/[a-f0-9-]{36}\.(jpg|jpeg|png|webp)$/i.test(pathname))rules={allowedContentTypes:['image/jpeg','image/png','image/webp'],maximumSizeInBytes:10_000_000};
   else throw Object.assign(new Error('Nome de arquivo inválido.'),{status:400});
   const token=await issueSignedToken({pathname,operations:['put'],...rules});
   return {token,urlOptions:rules};
  }});
  return res.status(200).json(response);
 }catch(error){if(error.retryAfter)res.setHeader('Retry-After',String(error.retryAfter));console.error('Blob upload error',error.name||'Error');return res.status(error.status||400).json({error:error.message||'Não foi possível preparar o upload.'});}
}
