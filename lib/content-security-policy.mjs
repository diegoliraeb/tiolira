export function contentSecurityPolicy(nonce,{development=false,https=true}={}){
 if(!/^[A-Za-z0-9+/_=-]{16,128}$/.test(nonce))throw Error('Invalid CSP nonce');
 return ["default-src 'self'",`script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${development?" 'unsafe-eval'":''}`,"style-src 'self' 'unsafe-inline'","img-src 'self' data: blob: https:","font-src 'self' data:",`connect-src 'self' https:${development?' ws:':''}`,"media-src 'self' blob: https:","worker-src 'self' blob:","object-src 'none'","base-uri 'none'","form-action 'self'","frame-ancestors 'none'",...(https?['upgrade-insecure-requests']:[])].join('; ');
}
