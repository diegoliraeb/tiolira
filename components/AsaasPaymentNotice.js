'use client';
import {useEffect,useState} from 'react';
export function PaymentLock(){return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/></svg>}
export default function AsaasPaymentNotice({compact=false}){
 const [https,setHttps]=useState(null);
 useEffect(()=>setHttps(window.location.protocol==='https:'),[]);
 return <section className={`asaas-payment-notice${compact?' compact':''}`} aria-label="Processamento do pagamento pelo Asaas">
  <div className="asaas-provider-heading"><span className="asaas-provider-icon"><PaymentLock/></span><div><span>Pagamento processado por</span><strong>Asaas</strong></div><a href="https://www.asaas.com/sobre-nos" target="_blank" rel="noopener noreferrer">Conheça o Asaas ↗</a></div>
  <p>Você compra de <strong>Tio Lira</strong>. O Asaas processa o pagamento do seu cartão.</p>
  {!compact&&<><ul className="asaas-payment-assurances"><li><PaymentLock/><span>{https===true?'Conexão criptografada (HTTPS)':https===false?'Use HTTPS para pagar com cartão':'Proteção dos dados de pagamento'}</span></li><li><span aria-hidden="true">✓</span><span>Número do cartão e código de segurança não ficam salvos na loja</span></li><li><span aria-hidden="true">✓</span><span>Compra única, sem assinatura</span></li></ul><details className="asaas-data-help"><summary>Como meus dados são usados?</summary><p>Os dados deste formulário são enviados pela loja ao Asaas para processar esta compra. As informações do titular e do endereço de cobrança são usadas na validação do pagamento. A loja não armazena o número do cartão nem o código de segurança.</p><a href="https://docs.asaas.com/docs/pci-dss-1" target="_blank" rel="noopener noreferrer">Saiba mais sobre a segurança no Asaas ↗</a></details></>}
 </section>;
}
