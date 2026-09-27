const config = {
 poweredByHeader: false,
 async redirects() { return [
 {source:'/3d',destination:'/pt',permanent:false},
 {source:'/3d/produto/:slug',destination:'/pt/produto/:slug',permanent:false},
 {source:'/3d/calculadora',destination:'/pt/calculadora',permanent:false},
 {source:'/3d/admin',destination:'/admin',permanent:false}
 ]; },
 async headers() { return [{source:'/:path*',headers:[{key:'X-Content-Type-Options',value:'nosniff'},{key:'X-Frame-Options',value:'DENY'},{key:'Referrer-Policy',value:'strict-origin-when-cross-origin'}]},{source:'/admin',headers:[{key:'X-Robots-Tag',value:'noindex, nofollow'}]}]; }
};
export default config;
