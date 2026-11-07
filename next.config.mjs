const config = {
 poweredByHeader: false,
 images:{dangerouslyAllowSVG:false,dangerouslyAllowLocalIP:false},
 outputFileTracingIncludes: {'/api/*':['./public/geography/*.json','./public/assets/tl-monogram-3d-icon.png']},
 async redirects() { return [
 {source:'/3d',destination:'/pt',permanent:true},
 {source:'/3d/produto/:slug',destination:'/pt/produto/:slug',permanent:true},
 {source:'/3d/calculadora',destination:'/pt/calculadora',permanent:true},
 {source:'/3d/admin',destination:'/admin',permanent:true}
 ]; },
 async headers() { return [{source:'/:path*',headers:[{key:'X-Content-Type-Options',value:'nosniff'},{key:'X-Frame-Options',value:'DENY'},{key:'Referrer-Policy',value:'strict-origin-when-cross-origin'},{key:'Permissions-Policy',value:'camera=(), microphone=(), geolocation=()'}]},{source:'/admin',headers:[{key:'X-Robots-Tag',value:'noindex, nofollow'}]},{source:'/:lang(pt|en|es|fr)/clube',headers:[{key:'X-Robots-Tag',value:'noindex, nofollow'}]},{source:'/:lang(pt|en|es|fr)/lembretes',headers:[{key:'X-Robots-Tag',value:'noindex, nofollow'}]}]; }
};
export default config;
