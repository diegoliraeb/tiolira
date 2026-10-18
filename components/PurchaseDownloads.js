'use client';
import PrintProfiles from './PrintProfiles';
import {feedbackCopy,feedbackLink} from '../lib/feedback-copy.mjs';
import {shopText} from '../lib/shop-fr.mjs';
export default function PurchaseDownloads({lang='pt',order,products,compact=false}){
 if(order.status!=='paid')return null;
 const pieces=[...new Map(order.items.flatMap(item=>item.products).map(p=>[p.id,p])).values()];
 return <section className="purchase-downloads" aria-label={shopText(lang,"Arquivos e licenças desta compra")}>
  {!compact&&<><div className="purchase-ready" role="status"><span aria-hidden="true">✓</span><div><strong>{shopText(lang,"Tudo pronto para imprimir e vender")}</strong><p>{shopText(lang,"O pagamento foi confirmado e sua licença de venda foi emitida automaticamente.")}</p></div></div><div className="purchase-next-steps"><div><b>1</b><span><strong>{shopText(lang,"Baixe os arquivos")}</strong><small>{shopText(lang,"Salve os modelos para impressão 3D.")}</small></span></div><div><b>2</b><span><strong>{shopText(lang,"Guarde sua licença")}</strong><small>{shopText(lang,"Baixe o PDF que autoriza a venda das peças impressas.")}</small></span></div></div></>}
  <div className="purchase-download-list">{pieces.map(piece=>{const product=products.find(p=>p.id===piece.id),license=order.licenses?.find(l=>l.productId===piece.id);return <article className="purchase-download-row" key={piece.id}>
   <div className="purchase-download-product">{product?.image?<img src={product.image} alt=""/>:<span className="purchase-download-placeholder" aria-hidden="true">3D</span>}<div><h4>{piece.name}</h4><small>{license?shopText(lang,"Licença de venda incluída"):shopText(lang,"Compra confirmada")}</small></div></div>
   <div className="purchase-download-actions">{product?.printProfiles?.length?null:product?.downloadUrl?<a className="button primary" href={product.downloadUrl} aria-label={shopText(lang,"Baixar arquivos de {0}",piece.name)}>{shopText(lang,"Baixar arquivos")} <span aria-hidden="true">↓</span></a>:<p className="field-help">{shopText(lang,"Arquivo indisponível no momento. Entre em contato com o Tio Lira.")}</p>}{license?<a className="button outline" href={license.downloadUrl} aria-label={shopText(lang,"Baixar licença de venda de {0} em PDF",piece.name)}>{shopText(lang,"Baixar licença (PDF)")} <span aria-hidden="true">↓</span></a>:<a className="text-link" href="#licencas">{shopText(lang,"Consultar licença de venda →")}</a>}<a className="text-link" href={feedbackLink(lang,piece.id,'review')}>{feedbackCopy(lang).review} ★</a><a className="text-link" href={feedbackLink(lang,piece.id)}>{feedbackCopy(lang).contact} ↗</a></div>
   <PrintProfiles profiles={product?.printProfiles} lang={lang} paid/>
  </article>})}</div>
  <p className="purchase-license-note">{shopText(lang,"A licença permite vender as peças físicas impressas. Os arquivos digitais não podem ser revendidos ou compartilhados.")}</p>
  {!compact&&<p className="field-help">{shopText(lang,"Você pode voltar a estes downloads em")} <strong>{shopText(lang,"Meus arquivos")}</strong> {shopText(lang,"ou")} <strong>{shopText(lang,"Meus pedidos")}</strong>.</p>}
 </section>;
}
