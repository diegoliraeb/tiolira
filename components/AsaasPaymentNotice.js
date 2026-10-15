'use client';
import {shopText} from '../lib/shop-fr.mjs';
export function PaymentLock(){return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/></svg>}
export default function AsaasPaymentNotice({lang='pt',compact=false}){
 return <section className={`asaas-payment-notice${compact?' compact':''}`} aria-label={shopText(lang,"Processamento do pagamento pelo Asaas")}>
  <div className="asaas-provider-heading"><span className="asaas-provider-icon"><PaymentLock/></span><div><span>{shopText(lang,"Pagamento processado por")}</span><strong>Asaas</strong></div><a href="https://www.asaas.com/sobre-nos" target="_blank" rel="noopener noreferrer">{shopText(lang,"Conheça o Asaas ↗")}</a></div>
  <p>{shopText(lang,"Você compra de")} <strong>Tio Lira</strong> {shopText(lang,"e preenche os dados do cartão diretamente na página do")} <strong>Asaas</strong>.</p>
  {!compact&&<><ul className="asaas-payment-assurances"><li><PaymentLock/><span>{shopText(lang,"Pagamento na página HTTPS do Asaas")}</span></li><li><span aria-hidden="true">✓</span><span>{shopText(lang,"Número do cartão e código de segurança são preenchidos somente no Asaas")}</span></li><li><span aria-hidden="true">✓</span><span>{shopText(lang,"Compra única, sem assinatura")}</span></li></ul><details className="asaas-data-help"><summary>{shopText(lang,"Como meus dados são usados?")}</summary><p>{shopText(lang,"A loja envia seu nome, e-mail, CPF/CNPJ e os dados do pedido ao Asaas para gerar a cobrança. Você informa o cartão e os dados do titular diretamente no Asaas. Após a confirmação do pagamento, a loja libera os arquivos e as licenças da compra.")}</p><a href="https://www.asaas.com/sobre-nos" target="_blank" rel="noopener noreferrer">{shopText(lang,"Conheça o processamento no Asaas ↗")}</a></details></>}
 </section>;
}
