# Carrinho da área do parceiro

O parceiro entra em `/pt/clube#compras`, adiciona peças ou a coleção e conclui o pagamento dentro do site pela API Asaas. O Pix exibe QR Code e Copia e Cola; o boleto exibe a linha digitável; o cartão é processado pelo formulário do próprio site. Pix, boleto e cartão usam cobranças avulsas; não existe recorrência nem armazenamento de números de cartão no site. Os preços são calculados pelo servidor, em centavos. Quando a coleção está no carrinho, suas peças avulsas são removidas do total. Os preços de cada peça e coleção podem ser alterados pelo administrador; pedidos já criados conservam seus valores.

## Preparar o Folclore Brasileiro Parte 1

Os arquivos definitivos serão enviados pelo criador depois desta implementação. Não foi escolhido nenhum pacote local nem alterado o catálogo online.

1. Em **Admin → Obras**, cadastre ou edite Saci, Curupira, Boitatá, Cuca e Mula sem Cabeça na coleção correta.
2. Selecione **Venda avulsa / carrinho**. O campo inicia com **R$ 14,90**. Envie o arquivo privado de cada personagem com o upload existente. Não use links públicos para os arquivos pagos.
3. Em **Admin → Coleções**, mantenha a coleção como não gratuita, configure **R$ 49,90** (há um botão com esse valor) e desmarque **Em preparação** quando os cinco arquivos estiverem prontos.
4. Publique as cinco peças. A coleção só pode ser comprada se todas as suas peças publicadas tiverem arquivo privado e preço válido.

O pedido da coleção guarda os IDs e nomes das peças incluídas naquele momento; adicionar novas peças ao catálogo não modifica compras anteriores. Mantenha a Parte 1 em uma coleção própria. Quem já possui uma peça pode comprar a coleção pelo valor integral, com confirmação explícita de que não existe abatimento. Não é permitido comprar novamente uma peça já adquirida.

## Configuração privada na hospedagem

Comece no ambiente Sandbox, com chave e webhook da conta de testes. Sandbox e produção têm configurações independentes.

| Variável | Valor |
| --- | --- |
| `ASAAS_ENVIRONMENT` | `sandbox` nos testes; `production` apenas após validar |
| `ASAAS_API_KEY` | Chave privada da conta correspondente |
| `ASAAS_WEBHOOK_TOKEN` | Token exclusivo gerado para o webhook, com 32–255 caracteres, diferente da chave de API |

Mantenha essas variáveis privadas na Vercel. Nunca use prefixo `NEXT_PUBLIC_`, cole a chave no chat ou salve-a no Git. Banco de dados e Vercel Blob privados continuam sendo os já utilizados pelo site. Faça novo deploy para carregar as variáveis.

No Asaas, em **Integrações → Webhooks**, configure a URL final HTTPS do ambiente:

`https://tiolira.com.br/api/webhooks/asaas`

Em Preview/Sandbox, substitua o domínio pelo endereço público do ambiente de teste. Não aponte o Sandbox para a produção. Defina o mesmo token de `ASAAS_WEBHOOK_TOKEN` e envio sequencial. Habilite eventos de cobrança: `PAYMENT_UPDATED`, `PAYMENT_AWAITING_RISK_ANALYSIS`, `PAYMENT_REPROVED_BY_RISK_ANALYSIS`, `PAYMENT_CREDIT_CARD_CAPTURE_REFUSED`, `PAYMENT_CONFIRMED`, `PAYMENT_RECEIVED`, `PAYMENT_OVERDUE`, `PAYMENT_DELETED`, `PAYMENT_RESTORED`, `PAYMENT_REFUNDED`, `PAYMENT_PARTIALLY_REFUNDED`, `PAYMENT_REFUND_IN_PROGRESS`, `PAYMENT_CHARGEBACK_REQUESTED`, `PAYMENT_CHARGEBACK_DISPUTE` e `PAYMENT_AWAITING_CHARGEBACK_REVERSAL`.

A conta Asaas também precisa estar habilitada para receber pelas três formas. O site cria o cliente com CPF/CNPJ informado no carrinho e notificações automáticas desativadas; nenhuma mensagem de cobrança é enviada por esta implementação.

## Confirmar antes de ativar vendas

- Fazer uma compra de uma peça no Sandbox por cada modalidade e uma compra da coleção.
- Conferir nos logs do Asaas o recebimento do webhook com HTTP 200.
- Confirmar acesso antes/depois do pagamento e ausência de acesso em outra conta.
- Repetir o envio do mesmo evento: não deve gerar outra venda.
- Simular estorno e confirmar suspensão dos downloads correspondentes.
- Verificar o relatório **Vendas e downloads** no admin.

Sem chave e webhook, a loja informa que pagamentos estão em preparação e bloqueia a compra. A URL de retorno ou o clique em “Consultar pagamento” não são prova de pagamento: a aplicação consulta o Asaas e confere cliente, referência, ID e valor. Pedidos pagos no Sandbox não autorizam downloads em produção.

## Checkout dentro do site e licença automática

O cartão é encaminhado pelo servidor à API apenas em memória. Número, CVV, dados do titular e tokens devolvidos pelo Asaas não são gravados em banco, sessão, URLs ou logs da aplicação. Não habilite captura de corpos de requisição em ferramentas de logs ou gravação de sessão nesta página. A captura direta exige HTTPS em produção e cumprimento dos requisitos aplicáveis ao processamento de cartão; valide a habilitação da conta com o Asaas. O timeout da API de cartão é de 65 segundos e a função tem limite de 90 segundos. O IP vem da conexão/proxy confiável, nunca do corpo enviado pelo navegador. Esta versão processa crédito à vista, sem cartão salvo ou recorrência.

A confirmação verificada (`CONFIRMED` ou `RECEIVED`) gera, na mesma transação do pedido, uma licença de venda de impressos por peça. A coleção de cinco gera cinco licenças. Elas aparecem em **Minhas licenças**, sem ação manual de emissão; os códigos permanecem estáveis nos reenvios de webhook. Estorno ou cancelamento suspendem as licenças do pedido. Licenças gratuitas existentes seguem seu fluxo original.

A interface acompanha o webhook consultando o estado local do pedido a cada 12 segundos enquanto a aba está visível. **Atualizar pagamento** faz conciliação pela API. Nenhuma navegação para fora é necessária; o boleto é pago com a linha digitável no banco do comprador.

## Operação e relatório

`commerce.json` é um registro privado do armazenamento existente (Neon em produção), atualizado com comparação de revisão para concorrência. Guarda pedidos e itens imutáveis, eventos já processados, contadores e as 500 entregas de download mais recentes. Não guarda CPF/CNPJ nem cartão. A liberação é derivada dos pedidos confirmados, sem URLs públicas dos modelos.

O admin mostra pedidos, compradores, situação e vendas por peça. O valor de uma coleção é distribuído igualmente entre suas peças, com os centavos restantes atribuídos na ordem do pedido; a soma é sempre igual ao total cobrado. Os valores são brutos, sem descontar taxas Asaas. Estornos e chargebacks retiram o pedido dos totais ativos e suspendem seu acesso. A suspensão é conservadora, inclusive em estorno parcial, e não é revertida automaticamente por notificações atrasadas.

Downloads contam entregas iniciadas pelo servidor após conferir a autorização e localizar o arquivo no Blob. Não significam que o usuário concluiu a transferência, nem incluem o MakerWorld. Os contadores começam com esta versão; não há importação de downloads antigos.

## Resposta inconclusiva / conciliação

O site grava a intenção antes de enviar a cobrança e não repete automaticamente um POST de pagamento após timeout. O parceiro usa **Consultar pagamento**; a cobrança é localizada pela referência externa do pedido. Pedidos em conferência sem cobrança encontrada exigem conferência no Asaas antes de qualquer reemissão. Não exclua manualmente a intenção só para tentar novamente. O cliente Asaas é reutilizado por referência de parceiro e documento do pagador.

O armazenamento único atende o volume inicial da loja. Para alto volume, migrar pedidos, eventos e downloads para tabelas próprias indexadas, mantendo os mesmos controles de concorrência e autorização.

## Referências verificadas

- [Cartão direto pela API](https://docs.asaas.com/reference/criar-cobranca-com-cartao-de-credito)
- [QR Code Pix](https://docs.asaas.com/reference/obter-qr-code-para-pagamentos-via-pix)
- [Linha digitável do boleto](https://docs.asaas.com/reference/obter-linha-digitavel-do-boleto)
- [Criar cobrança](https://docs.asaas.com/reference/criar-nova-cobranca)
- [Criar cliente](https://docs.asaas.com/reference/criar-novo-cliente)
- [Eventos de cobrança](https://docs.asaas.com/docs/webhook-para-cobrancas)
- [Idempotência de webhooks](https://docs.asaas.com/docs/como-implementar-idempotencia-em-webhooks)
- [Configurar webhook](https://docs.asaas.com/docs/criar-novo-webhook-pela-aplicacao-web)
