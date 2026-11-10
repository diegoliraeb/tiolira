# Teste de seguidores por webhook

Endpoint: `/api/instagram/webhook` (GET para verificação da Meta, POST para eventos assinados).

Este piloto processa somente mensagens de entrada `TESTE CUPOM` recebidas por
@tiolira ou @tiolira3d. Não emite cupons, não envia mensagens e não modifica
o cadastro de parceiros. O corpo da mensagem não é persistido.

## Configuração no servidor

Defina somente como segredos do ambiente do servidor, nunca `NEXT_PUBLIC_`:

- `META_APP_SECRET`: chave do app Meta 2411384412934986.
- `META_WEBHOOK_VERIFY_TOKEN`: valor aleatório exclusivo para a verificação do callback.
- `META_TIOLIRA_ACCESS_TOKEN`: token com acesso à conta 17841400549300615.
- `META_TIOLIRA3D_ACCESS_TOKEN`: token com acesso à conta 17841433509773548.

O armazenamento privado existente (`DATABASE_URL`) recebe registros isolados em
`instagram-tests/<id-da-conta>/<id-do-remetente>.json`. Os registros incluem o ID
da interação, data, nome de usuário quando disponível e resultado da consulta.
Um resultado `follows: null` ou erro 230 não significa que a pessoa não segue:
significa que não foi possível verificar. Não use esse estado para emitir cupom.

Depois de publicar e verificar o callback HTTPS no objeto Instagram da Meta,
assine o campo `messages` e inscreva o app nas duas contas. A conta participante
deve enviar uma nova mensagem para cada perfil depois da configuração. Use o
`sender.id` recebido pelo webhook para a consulta de `is_user_follow_business`.

O POST exige HMAC-SHA256 válido sobre os bytes originais. Ecos, mensagens comuns,
destinatários inconsistentes e contas não autorizadas são ignorados. O GET não
expõe dados; apenas responde ao desafio quando o token de verificação confere.
Falhas de persistência retornam 503 para permitir nova entrega da Meta. Eventos
repetidos ou anteriores ao último registro não substituem o resultado mais novo.

## Validação

`node --test tests/instagram-webhook.test.mjs`

Os testes cobrem desafio, assinatura/adulteração, tamanho, eventos ignorados,
privacidade do registro, falha de persistência e tratamento de resultado falso
ou desconhecido. O teste ao vivo ainda precisa do callback publicado e de uma
nova interação de @tiolirapescador com os dois perfis.

Este endpoint não substitui a integração da promoção: ainda são necessários
email confirmado, prova da posse do Instagram, comentário elegível, restrições
únicas por campanha/conta/email/Instagram e emissão atômica do cupom.
