import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {downloadConsentHtml,handleDownloadConsent,readDownloadAcceptance} from '../server/download-consent.mjs';
import {DOWNLOAD_CONSENT_VERSION,downloadConsentCopies,downloadLanguage} from '../lib/download-consent.mjs';
const member={id:'subscriber'},product={id:'piece',name:'Noel <Flamengo>',slug:'noel',collection:'collection',access:'paid',includedInSubscription:true,published:true,filePath:'models/noel.3mf'},file={id:'fine',name:'A1 0,20 mm',filePath:'models/noel.3mf'},data={products:[product],collections:[{id:'collection',published:true}]};
const url=new URL('https://example.test/api/download?id=piece&profile=original');
const fields={accepted:'yes',version:DOWNLOAD_CONSENT_VERSION,lang:'pt'};
const request=(method='POST',body=new URLSearchParams(fields).toString(),origin='https://example.test')=>({method,body,headers:{host:'example.test',origin,'content-type':'application/x-www-form-urlencoded',referer:'https://example.test/en/clube'}});
const response=()=>({headers:{},setHeader(k,v){this.headers[k]=v},end(html){this.html=html}});
test('GET shows required agreement in the caller language and never generates or reads a file',async()=>{
 const res=response();let downloads=0;
 await handleDownloadConsent({req:request('GET'),res,url,member,data},{hasAccess:async()=>true,download:async()=>downloads++,readBlob:async()=>assert.fail('Must not read Blob before acceptance')});
 assert.equal(downloads,0);assert.equal(res.statusCode,200);assert.match(res.html,/Personal, traceable file/);assert.match(res.html,/Noel &lt;Flamengo&gt;/);assert.match(res.html,/name="accepted"[^>]*required/);assert.match(res.html,/id="download"[^>]*disabled/);assert.match(res.html,/method="post"/);assert.equal(res.headers['Cache-Control'],'private, no-store');assert.match(res.headers['Content-Security-Policy'],/form-action 'self'/);
});
test('POST requires checked acceptance, current version, valid language, bounded body and same origin',async()=>{
 for(const body of ['',new URLSearchParams({...fields,accepted:'no'}).toString(),new URLSearchParams({...fields,version:'old'}).toString(),new URLSearchParams({...fields,lang:'invalid'}).toString(),new URLSearchParams({...fields,lang:'constructor'}).toString(),new URLSearchParams(fields)+'&accepted=yes'])await assert.rejects(readDownloadAcceptance(request('POST',body)),{status:400});
 await assert.rejects(readDownloadAcceptance(request('POST',undefined,'https://other.test')),{status:403});
 await assert.rejects(readDownloadAcceptance(request('POST','x'.repeat(4097))),{status:413});
 const invalid=request();invalid.headers['content-type']='application/json';await assert.rejects(readDownloadAcceptance(invalid),{status:415});
 const stream=Readable.from(['accepted=yes&version='+DOWNLOAD_CONSENT_VERSION+'&lang=pt']);stream.headers=request().headers;
 assert.equal((await readDownloadAcceptance(stream)).version,DOWNLOAD_CONSENT_VERSION);
});
test('accepted POST passes server timestamp and language to the original download authorization flow',async()=>{
 let seen;await handleDownloadConsent({req:request(),res:response(),url,member,data},{download:async args=>{seen=args}});
 assert.equal(seen.member,member);assert.equal(seen.productId,'piece');assert.equal(seen.profileId,'original');assert.equal(seen.acceptance.version,DOWNLOAD_CONSENT_VERSION);assert.equal(seen.acceptance.lang,'pt');assert.ok(Date.now()-Date.parse(seen.acceptance.acceptedAt)<2000);
 // Acceptance never grants access by itself.
 await assert.rejects(handleDownloadConsent({req:request(),res:response(),url,member,data},{hasAccess:async()=>false,subscription:async()=>({active:false}),readBlob:async()=>assert.fail('Unauthorized Blob read')}),{status:403});
});
test('non-3MF formats do not promise a cryptographic tracking code; all supported languages have complete copy',()=>{
 const html=downloadConsentHtml({product,file:{...file,filePath:'models/test.stl'},lang:'pt',nonce:'test'});assert.match(html,/Não é permitido compartilhar/);assert.doesNotMatch(html,/assinatura criptográfica|código único|código pode ajudar/);
 for(const lang of ['pt','en','es','fr']){assert.deepEqual(Object.keys(downloadConsentCopies[lang]),Object.keys(downloadConsentCopies.pt));assert.match(downloadConsentHtml({product,file,lang,nonce:'test'}),new RegExp('lang="'+lang+'"'));}
 assert.equal(downloadLanguage({headers:{host:'example.test',referer:'https://evil.test/fr/clube'}},url),'pt');
});
