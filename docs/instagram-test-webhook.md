# Promoção Instagram — um download de Noel

Campanha `instagram-noeis-2026-11`. Um único modelo disponível do Brasileirão OU da Champions. Página pública `/pt/promocao`, atalho `/promocao`; administração em Promoção Instagram.

## Regras atuais

Email confirmado, Instagram comprovado por **uma conversa com @tiolira3d**, seguir @tiolira3d, comentar dois @ distintos no post da campanha. Seguir @tiolira e curtir o post são convites; não bloqueiam o cupom. Não contar o próprio perfil nem os perfis da marca nas menções.

A campanha começa em rascunho. O administrador informa um post de **@tiolira3d**, confere datas e ativa. Padrão até 30/11/2026 23:59:59 de Maceió. O banner usa Flamengo (Noel Mengão), São Paulo, Barcelona e Arsenal do catálogo.

## Confirmação simplificada

1. A pessoa confirma seu email pelo código de oito dígitos (15 minutos, cinco tentativas). A mensagem HTML usa a identidade Tio Lira e inclui texto alternativo.
2. Informa o @ no site. Se houver comentário elegível nesse post de @tiolira3d e dentro de sete dias, o servidor envia uma resposta privada com código individual. A pessoa **responde** ao Direct; somente receber a mensagem não comprova posse nem libera consulta de perfil.
3. Sem comentário elegível ou se a resposta privada já foi usada/ficou incerta, o site fornece uma mensagem para a pessoa iniciar a conversa com @tiolira3d. Nunca inicia conversa arbitrária apenas pelo @.
4. O webhook assinado recebe a resposta, confere o autor e vincula o ID estável ao cadastro. O código vence em 30 minutos. Uma reserva atômica evita respostas privadas duplicadas para o mesmo comentário, inclusive em concorrência/timeout.
5. A lista de progresso mostra cada requisito. A emissão relê seguidores e comentário na Meta; informação indisponível não aprova.

## Unicidade e resgate

`instagram-promotion.json` mantém desafios com hash, vínculos e histórico de IDs, reservas de respostas privadas e cupons. Alterar @ ou email não apaga benefícios já emitidos. A mesma identidade não pode ser vinculada a outro cadastro. IDs antigos de ambos os perfis permanecem no histórico; novos vínculos usam @tiolira3d.

O cupom é pessoal e não funciona no carrinho comum. Consumo, pedido gratuito, licença e acesso ao arquivo são gravados atomicamente em `commerce.json`. Uma única escolha total; tentativas repetidas retornam o mesmo pedido. Modelos indisponíveis ou já adquiridos não podem ser resgatados.

## Ambiente

Banco existente e credenciais privadas de servidor: `RESEND_API_KEY`, `EMAIL_FROM`, `SITE_URL`, `META_APP_SECRET`, `META_WEBHOOK_VERIFY_TOKEN`, `META_TIOLIRA_ACCESS_TOKEN`, `META_TIOLIRA3D_ACCESS_TOKEN`. Nunca usar prefixo NEXT_PUBLIC_.

Callback `https://www.tiolira.com.br/api/instagram/webhook`. messages/comments assinados no app e nas duas contas. App Meta publicado em 10/11/2026. Tokens atuais expiram em janeiro de 2027. @tiolira permanece conectado para o piloto e futuras funcionalidades; a promoção exige só @tiolira3d.

Privacidade e canal de exclusão em `/pt/privacidade-instagram`, cadastrados na Meta. O texto do comentário e os nomes dos amigos não são persistidos pelo módulo da promoção; só IDs para reconsulta. Não se comprova amizade ou existência de contas mencionadas apenas pelo texto. Busca complementar limitada a 500 comentários; em caso de limite, falha sem emitir cupom.

## Verificação

`node --test tests/instagram-promotion.test.mjs tests/instagram-webhook.test.mjs tests/cart-coupons.test.mjs tests/partner-navigation.test.mjs`

O teste real de seguidores já confirmou @tiolirapescador nos dois perfis. Antes de abrir a campanha, publicar/vincular o post e validar o novo fluxo completo com comentário e confirmação de Direct em conta externa.
