# Promoção Instagram — um download de Noel

Campanha `instagram-noeis-2026-11`. O participante escolhe **um único modelo do Brasileirão ou da Champions**, nas coleções `noeis-brasileirao` e `35b06e0a-ada0-4df9-93e5-4ce39766915a`.

## Ativação

A campanha começa em rascunho, sem post e sem emitir cupons. Em **Admin → Promoção Instagram**, selecione o perfil proprietário do post, informe o link publicado, confira o período e ative. O servidor resolve o post pela API oficial antes de aceitar a ativação. O prazo padrão termina em 30/11/2026 às 23:59:59 de Maceió.

A página pública é `/pt/promocao`, com atalho `/promocao`. O login retorna à mesma página; a lista de progresso consulta cada requisito sem emitir cupom. A emissão faz uma nova consulta. A página `/pt/privacidade-instagram` descreve os dados e o canal de solicitação de exclusão.

## Participação

1. Entrar na área do parceiro e abrir **Promoção Instagram**.
2. Confirmar o email com o código recebido (15 minutos; cinco tentativas).
3. Informar o @ e enviar o código individual `CUPOM …` pelo Direct aos dois perfis. Apenas informar um nome não comprova posse. O código vence em 30 minutos.
4. Seguir @tiolira e @tiolira3d e comentar dois @ distintos no post definido. Curtida não é exigida.
5. Conferir as regras, obter o cupom pessoal e escolher um modelo para download.

O servidor consulta os seguidores e o comentário antes de emitir. A Meta fornece autor, texto e post; a aplicação conta os @. Não se comprova amizade nem existência das contas mencionadas apenas pelo texto. Autor, perfil vinculado e post precisam coincidir. O próprio participante e os dois perfis da marca não contam como convidados.

## Unicidade e resgate

O registro privado `instagram-promotion.json` mantém vínculos por IDs estáveis da Meta (diferentes em cada conta profissional), histórico de proprietários e cupons por campanha, conta, email normalizado e Instagram. Alterações do @ não apagam o histórico. A mesma identidade não pode ser reutilizada por outro cadastro. A emissão usa atualização atômica e retorna o mesmo cupom em tentativas repetidas.

O resgate grava consumo do cupom, pedido gratuito, licença e acesso ao arquivo na mesma atualização atômica de `commerce.json`. É permitido um modelo total, não um por coleção. O cupom pessoal não funciona no carrinho comum. Modelos indisponíveis ou já adquiridos são rejeitados.

## Configuração privada

Além do banco existente, configure apenas no servidor (nunca `NEXT_PUBLIC_`):

- `RESEND_API_KEY`, `EMAIL_FROM`, `SITE_URL` para confirmação de email.
- `META_APP_SECRET`, `META_WEBHOOK_VERIFY_TOKEN`.
- `META_TIOLIRA_ACCESS_TOKEN`, `META_TIOLIRA3D_ACCESS_TOKEN`.

Callback: `https://www.tiolira.com.br/api/instagram/webhook`. Ative `messages` e `comments` no objeto Instagram do app e em `subscribed_apps` de ambos os perfis. O POST exige HMAC-SHA256 válido; falhas transitórias retornam erro para nova entrega. Não são enviadas respostas automáticas pelo Direct.

Tokens atuais expiram em janeiro de 2027; renovar antes de reutilizar a integração. O app ainda está em desenvolvimento: conferir acesso de produção e permissões/revisão da Meta antes de divulgar para participantes externos.

Comentários recebidos pelo webhook mantêm apenas IDs para consulta posterior. A emissão relê o comentário na Meta, incluindo exclusão/ocultação, com busca complementar limitada a 500 comentários. Se não conseguir confirmar, não libera cupom. Uma campanha grande precisa acompanhar esse limite e o recebimento de eventos.

O piloto `TESTE CUPOM` continua disponível, sem emitir benefícios, em registros privados `instagram-tests/…`. Seguidores desconhecidos ou erros nunca contam como aprovação.

## Validação

`node --test tests/instagram-promotion.test.mjs tests/instagram-webhook.test.mjs tests/cart-coupons.test.mjs tests/partner-navigation.test.mjs`

Cobertura: email, posse por dois Directs, identidade/conta/email repetidos, concorrência, comentário e seguidores, assinatura do webhook, autenticação, CSRF e resgate atômico. Fluxo visual exercitado localmente com Meta e email simulados. Consulta real da relação de seguidores validada com @tiolirapescador; validação completa do comentário da campanha depende do post ainda não publicado.
