'use client';
export default function PurchaseDownloads({order,products,compact=false}){
 if(order.status!=='paid')return null;
 const pieces=[...new Map(order.items.flatMap(item=>item.products).map(p=>[p.id,p])).values()];
 return <section className="purchase-downloads" aria-label="Arquivos e licenças desta compra">
  {!compact&&<><div className="purchase-ready" role="status"><span aria-hidden="true">✓</span><div><strong>Tudo pronto para imprimir e vender</strong><p>O pagamento foi confirmado e sua licença de venda foi emitida automaticamente.</p></div></div><div className="purchase-next-steps"><div><b>1</b><span><strong>Baixe os arquivos</strong><small>Salve os modelos para impressão 3D.</small></span></div><div><b>2</b><span><strong>Guarde sua licença</strong><small>Baixe o PDF que autoriza a venda das peças impressas.</small></span></div></div></>}
  <div className="purchase-download-list">{pieces.map(piece=>{const product=products.find(p=>p.id===piece.id),license=order.licenses?.find(l=>l.productId===piece.id);return <article className="purchase-download-row" key={piece.id}>
   <div className="purchase-download-product">{product?.image?<img src={product.image} alt=""/>:<span className="purchase-download-placeholder" aria-hidden="true">3D</span>}<div><h4>{piece.name}</h4><small>{license?'Licença de venda incluída':'Compra confirmada'}</small></div></div>
   <div className="purchase-download-actions">{product?.downloadUrl?<a className="button primary" href={product.downloadUrl} aria-label={`Baixar arquivos de ${piece.name}`}>Baixar arquivos <span aria-hidden="true">↓</span></a>:<p className="field-help">Arquivo indisponível no momento. Entre em contato com o Tio Lira.</p>}{license?<a className="button outline" href={license.downloadUrl} aria-label={`Baixar licença de venda de ${piece.name} em PDF`}>Baixar licença (PDF) <span aria-hidden="true">↓</span></a>:<a className="text-link" href="#licencas">Consultar licença de venda →</a>}</div>
  </article>})}</div>
  <p className="purchase-license-note">A licença permite vender as peças físicas impressas. Os arquivos digitais não podem ser revendidos ou compartilhados.</p>
  {!compact&&<p className="field-help">Você pode voltar a estes downloads em <strong>Meus arquivos</strong> ou <strong>Meus pedidos</strong>.</p>}
 </section>;
}
