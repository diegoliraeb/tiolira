# Compras internacionais com PayPal

O país persistido no cadastro seleciona o checkout: Brasil usa Asaas/BRL; demais países usam PayPal/USD. País desconhecido mantém o caminho legado brasileiro e solicita CPF/CNPJ. Não inferimos nacionalidade pelo idioma nem enviamos IP a geolocalizadores. O parceiro pode corrigir seu país em Meus dados.

## Preços

Regra comercial autorizada: USD = BRL ÷ 6, arredondado ao centavo por item ou pacote. Não é cotação cambial ao vivo. `priceUsdCents` opcional no administrador substitui a regra por peça/coleção. Histórico congela a moeda e os valores cobrados. Relatórios separam receita BRL e USD. Cupons percentuais preservam o percentual; descontos fixos e mínimos seguem a mesma divisão por 6.

## Configuração privada

Criar aplicativo REST da conta recebedora no PayPal Developer. Configurar no ambiente correspondente da hospedagem, nunca em NEXT_PUBLIC ou Git:
- PAYPAL_ENVIRONMENT: sandbox ou production
- PAYPAL_CLIENT_ID e PAYPAL_CLIENT_SECRET
- PAYPAL_MERCHANT_ID: identificador da conta comerciante recebedora
- PAYPAL_WEBHOOK_ID
- SITE_URL: https://www.tiolira.com.br

Webhook HTTPS: `/api/webhooks/paypal`. Eventos: CHECKOUT.ORDER.APPROVED, PAYMENT.CAPTURE.COMPLETED, PAYMENT.CAPTURE.PENDING, PAYMENT.CAPTURE.DENIED, PAYMENT.CAPTURE.REFUNDED, PAYMENT.CAPTURE.REVERSED, CUSTOMER.DISPUTE.CREATED. Este endpoint usa corpo original para verificar a assinatura via PayPal. Nenhum webhook é aceito sem verificação.

## Fluxo e segurança

O servidor calcula o total e cria um pedido CAPTURE em USD, sem solicitar CPF/cartão no site, sem endereço de entrega (arquivos digitais), com merchant_id explícito e referência da compra. O link aprovado precisa pertencer ao PayPal no ambiente correto. Após aprovação, retorno autenticado ou webhook inicia a captura com idempotência. Voltar ao site por si só não aprova uma compra. A liberação exige captura COMPLETED, moeda, valor, referências, conta recebedora e pedido válidos. Pedidos pendentes/em análise não liberam arquivos.

Licenças e aprovação são gravadas atomicamente. Recuperação de create/capture usa a mesma chave de idempotência em uma janela conservadora de uma hora; após ela, resposta incerta exige suporte, sem recriar cobrança automaticamente. Estorno parcial/total, reversão ou disputa assinados suspendem acesso; suspensão não é revertida automaticamente por evento antigo. Pedido pode ser consultado apenas pelo seu comprador. Asaas e PayPal têm isolamento de ambientes independente.

## Validação

`pnpm test` e `pnpm build`. Testes PayPal simulam API: total adulterado, retorno, confirmação, pendência, destinatário/moeda incorretos, idempotência, resposta perdida, estorno, webhook inválido, isolamento, arquivos e licenças. Teste real em Sandbox precisa credenciais próprias e conta compradora de teste. Não declarar produção operacional antes de configurar aplicativo/webhook e completar teste de compra.

Referências oficiais:
- https://developer.paypal.com/api/orders/v2/orders-create
- https://developer.paypal.com/api/orders/v2/orders-capture
- https://developer.paypal.com/api/rest/webhooks/rest/
