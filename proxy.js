import {NextResponse} from 'next/server';
// Root layouts cannot read a child segment's params. Carry the path locale to the document.
export function proxy(request){
 const lang=request.nextUrl.pathname.split('/')[1];
 const headers=new Headers(request.headers);
 headers.set('x-tiolira-language',['pt','en','es','fr'].includes(lang)?lang:'pt');
 return NextResponse.next({request:{headers}});
}
export const config={matcher:['/pt/:path*','/en/:path*','/es/:path*','/fr/:path*']};
