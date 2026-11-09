export const campaignRecipientStatus=r=>({draft:'Rascunho — envio bloqueado',pending:'Aguardando envio',sent:'Enviado ao serviço',failed:'Nova tentativa pendente',review:'Revisão necessária',cancelled:'Cancelado'})[r.status]||r.status;
export function courtesyReportCsv(recipients){
 const cell=value=>'"'+String(value??'').replace(/^[\s]*[=+@-]/,match=>"'"+match).replaceAll('"','""')+'"';
 const rows=[['Cliente','E-mail','Idioma','Situação do envio','Enviado em','Entregue em','Abertura registrada em','Falha de entrega em','Reclamação em','Cupom usado em','Situação do resgate','Obra escolhida','Pedido do resgate'],...recipients.map(r=>[r.name,r.email,r.language,campaignRecipientStatus(r),r.sentAt||r.delivery?.sent,r.delivery?.delivered,r.delivery?.opened,r.delivery?.bounced||r.delivery?.failed,r.delivery?.complained,r.redemption?.at,r.redemption?.status,r.redemption?.works.join(' / '),r.redemption?.orderId])];
 return '\uFEFF'+rows.map(row=>row.map(cell).join(';')).join('\r\n');
}
