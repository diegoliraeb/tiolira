import {NextResponse} from 'next/server';
import {contentSecurityPolicy} from './lib/content-security-policy.mjs';
// Root layouts cannot read a child segment's params. Carry the path locale to the document.
export function proxy(request){
 const lang=request.nextUrl.pathname.split('/')[1];
 const headers=new Headers(request.headers);
 headers.set('x-tiolira-language',['pt','en','es','fr'].includes(lang)?lang:'pt');
 const nonce=Buffer.from(crypto.randomUUID()).toString('base64');
 const policy=contentSecurityPolicy(nonce,{development:process.env.NODE_ENV==='development',https:request.nextUrl.protocol==='https:'});
 // Always replace incoming headers; never trust a client-supplied nonce or policy.
 headers.set('x-tiolira-nonce',nonce);headers.set('Content-Security-Policy',policy);
 const response=NextResponse.next({request:{headers}});
 response.headers.set('Content-Security-Policy',policy);
 return response;
}
export const config={matcher:['/','/admin','/pt/:path*','/en/:path*','/es/:path*','/fr/:path*']};
