# Tio Lira — estúdio de criação 3D

Prévia em **React 19 + Next.js 16 (App Router)**, preparada para importar na Vercel. Português, inglês e espanhol, com 22 obras do catálogo público original e a nova marca TL em SVG.

## Criar a prévia na Vercel

1. Importe o repositório `diegoliraeb/tiolira` no painel da Vercel.
2. Selecione a branch `main`, diretório raiz `./` e framework **Next.js**.
3. Mantenha os comandos automáticos de instalação/build. Node.js **24.x**.
4. Clique em Deploy. Para o catálogo público, não são necessárias variáveis; uploads do Clube exigem a configuração do Blob abaixo.

A página inicial redireciona para `/pt`. Também existem `/en`, `/es`, `/admin`, `/{idioma}/calculadora` e `/{idioma}/produto/{slug}`. Os caminhos antigos `/3d`, `/3d/produto/*`, `/3d/calculadora` e `/3d/admin` redirecionam para os equivalentes novos.

## O que está funcionando

- Catálogo com busca, filtros, páginas individuais, imagens e descrições nos três idiomas.
- Presépio gratuito e autorização do criador para vender **peças físicas**, sem assinatura. Arquivos digitais não podem ser revendidos ou redistribuídos.
- Arquivos gratuitos hospedados no site exigem cadastro e login no Clube; links oficiais do MakerWorld continuam levando diretamente para a plataforma.
- Rede por cidade e obra, sem lojas fictícias. Cadastro gratuito para pessoas e lojas; consentimento separado para futuras parcerias. Cadastro sem seleção de peças, com escolha Sim/Não para publicação e aprovação automática ao escolher Sim. Busca por peça ou coleção completa (todas as peças já lançadas); participantes sem catálogo também aparecem, com aviso para consultar disponibilidade. O pedido escolhido segue na mensagem de orçamento do WhatsApp.
- Calculadora com material, energia, depreciação, manutenção, falhas, trabalho, taxas e margem. Salva simulações no navegador.
- Painel demonstrável: editar obras, coleções, planos, traduções e textos; revisar participantes; exportar catálogo JSON e CSV de contatos que aceitaram parcerias.
- Marca TL vetorial em `public/assets/tl-monogram.svg`.

## PostgreSQL Neon e administração

O site agora usa **PostgreSQL Neon** quando `DATABASE_URL` (ou `POSTGRES_URL`) está configurada. O driver oficial faz consultas HTTPS adequadas às funções da Vercel. O projeto `tiolira` já foi vinculado à integração Neon nos ambientes Production e Preview.

```sh
pnpm db:migrate
pnpm test:db
```

A migração cria o schema isolado `tiolira`, a tabela `records` e importa o catálogo inicial apenas se ele ainda não existir. Não sobrescreve obras, cadastros nem administrador existentes. A tabela armazena JSONB com revisão; gravações concorrentes são comparadas atomicamente pelo PostgreSQL. O comando de verificação cria e remove somente um registro temporário próprio.

Na primeira migração são gerados um segredo de sessão e um hash do código de configuração, guardados no banco. O código original é salvo **apenas no arquivo local ignorado** `.local-data/admin-setup.txt`. O primeiro administrador deve abrir `/admin`, informar esse código e escolher seu próprio e-mail e senha. Nenhuma senha padrão é criada. Uma conta existente impede novas configurações, mesmo que o código seja reutilizado. A autenticação usa scrypt, cookies HttpOnly, validação de origem, limite de tentativas e sessão de 8 horas.

O cadastro gratuito fica ativo quando o banco e a configuração de segurança estão disponíveis. O cadastro exige a escolha explícita de publicação: **Sim** salva `consent: true` e aprova automaticamente (`approved`); **Não** salva `consent: false` e mantém o perfil `pending`, fora da busca pública. O consentimento para contatos sobre futuras parcerias é independente. Perfis existentes não são aprovados retroativamente no login. E-mail, consentimento de parcerias e dados de autorização ficam privados. Nunca coloque a conexão do banco em variáveis `NEXT_PUBLIC_*` ou no GitHub.

Sem banco ou armazenamento configurado, `/admin` continua mostrando uma demonstração pública com somente o catálogo público. Rascunhos ficam no navegador e não alteram o site. Na versão conectada, a demonstração é substituída pelo login real; rascunhos locais não são importados automaticamente.

Os adaptadores de armazenamento local e Vercel Blob privado foram preservados para compatibilidade, mas **DATABASE_URL tem prioridade**. Blob só é necessário se forem hospedados arquivos privados por esse serviço. As imagens importadas continuam em `public/assets` e os modelos exclusivos permanecem no MakerWorld.

Para habilitar uploads no painel, abra o projeto na Vercel, entre em **Storage → Create Database → Blob**, crie um armazenamento **Private** e conecte-o aos ambientes Production e Preview. A Vercel adiciona `BLOB_READ_WRITE_TOKEN`; faça um novo deploy depois de selecionar os ambientes. O administrador poderá enviar modelos do Clube de até 100 MB e até 20 fotos por galeria, com 10 MB por foto.

Para um novo banco ou uma branch Neon de preview sem o schema, execute a migração nesse ambiente antes do deploy. As variáveis `ADMIN_SESSION_SECRET` e `ADMIN_SETUP_TOKEN` são opcionais e sobrepõem a configuração do banco; mantenha-as privadas caso escolha usá-las.

## Conteúdo e disponibilidade

Origem: catálogo público de https://diegolira.com.br/3d, consultado em 27/09/2026. As descrições foram preservadas em português e traduzidas para inglês e espanhol. Páginas e capas dos 22 modelos foram importadas. Modelos que ainda constavam como “em breve” mantêm esse status; o administrador pode atualizar os links depois do lançamento.

Os downloads próprios de **Padre Cícero** e **Frei** ainda apontam para suas páginas originais. Os arquivos STL/3MF privados não foram fornecidos e não estão no repositório. Foram incluídas também as imagens adicionais recuperadas de Melchior, Maria, Frei e Orgulho de ser arretado. As demais galerias adicionais ainda dependem da migração de mídia; a capa está disponível para todas as obras. Não desligue o site original antes de migrar esses downloads. Não foi alterado nenhum domínio.

As assinaturas ainda não cobram e não foram abertas. O painel aceita o link de uma plataforma externa; essa plataforma deverá proteger os downloads e gerenciar pagamentos. Nunca publique URLs diretas de arquivos pagos. Os detalhes dos planos, preços e termos ainda precisam ser definidos.

O cadastro aceita logo opcional em PNG, JPG ou WebP, até 2 MB e 16 megapixels. A imagem é decodificada no servidor, convertida para WebP de até 512 px e salva em um registro separado do catálogo no banco conectado; não depende de Vercel Blob. Logos de cadastros pendentes são visíveis apenas no painel autenticado. A publicação acompanha a aprovação da loja; o administrador pode trocar ou remover a logo. O site destaca o benefício de criações selecionadas exclusivas para lojas cadastradas; a distribuição desses arquivos ainda será definida, sem ativar assinaturas.

O painel Rede de Lojas tem filtros combinados por situação, região brasileira (ou Exterior), estado, cidade e nome. Endereços usam seletores encadeados de país, estado e cidade. A área atendida pode abranger todo o país, um estado, uma cidade ou várias cidades de estados diferentes. A rede pública agora usa o endereço cadastrado para o mapa e os filtros; a área atendida continua aparecendo no cartão da loja. Isso evita contar uma loja com entrega nacional em todos os estados. Cadastros antigos continuam sendo encontrados pelo nome do estado e da cidade.

As localidades são snapshots servidos pelo próprio site, sem enviar dados de compradores ou lojistas a serviços externos. Brasil: 27 UFs e 5.571 municípios do IBGE. Outros países: Countries States Cities Database, com atribuição e ODbL em `public/geography/`. A base comunitária pode ter lacunas; localidades ausentes mostram uma orientação de contato. A API valida a relação entre país, estado e município, e grava os nomes canônicos. Os registros existentes são preservados, sem migração destrutiva.

A aprovação automática na rede depende da autorização de publicação informada no cadastro. Não exige assinatura nem comprovante para o presépio. Obras de outras coleções só aparecem no diretório após registrar a autorização comercial correspondente. O consentimento para parcerias é privado e separado do consentimento de publicação na rede.

## Desenvolvimento

```sh
corepack pnpm install
corepack pnpm dev
# http://127.0.0.1:8766
corepack pnpm test
corepack pnpm build
```

A prévia funciona sem `.env.local`. Para testar persistência local, use as variáveis de `.env.example`, um diretório local e segredos próprios de teste. Não reutilize senhas pessoais em testes.

## Estrutura

- `app/`: rotas, páginas e estilos adicionais.
- `components/`: componentes React da vitrine, calculadora, rede e administração.
- `data/catalog.json`: catálogo inicial e traduções.
- `lib/i18n.js`: textos da interface nos três idiomas.
- `lib/calculator.mjs`: fórmula de precificação.
- `pages/api/[...route].js`: API Node do Next.js.
- `server/`: validação, autenticação, adaptador e handlers.
- `tests/`: validação de regras, privacidade, autenticação, persistência e cálculo.

Publicação inicial autorizada no repositório do próprio criador. Imagens e modelos pertencem a Diego Lira; não há concessão de redistribuição dos arquivos digitais neste repositório.

### Ordem do catálogo e cliques

As obras disponíveis aparecem antes das indisponíveis; dentro de cada grupo, a ordem é pelo total de cliques, depois pela ordem editorial. Obras marcadas como `soon` ou sem link/arquivo recebem o selo traduzido “Em breve”.

Cliques na imagem ou em “Conhecer a obra” são registrados por `POST /api/products/click`. A contagem começa com esta implementação e não importa estatísticas do MakerWorld. `analytics/product-clicks.json` guarda os totais separadamente do catálogo, usando o mesmo armazenamento configurado (Neon em produção). Cliques repetidos da mesma origem/navegador na mesma obra são deduplicados por 30 minutos com HMAC, sem gravar o IP em texto. Robôs identificados são ignorados. Nenhuma migração adicional é necessária.

## Área do parceiro: cupons, licenças e recuperação de senha

O Clube é a área do parceiro, com uma única conta. Os formulários do Clube e da rede usam o mesmo cadastro. Perfis comerciais só aparecem na rede com autorização explícita; contas antigas do Clube podem autorizar o uso do perfil no próprio painel. Parceiros que já estavam na rede definem a primeira senha usando o e-mail cadastrado em **Definir ou recuperar senha**. A recuperação vincula a conta ao perfil existente sem alterar aprovação, logo ou obras; a senha só é definida após confirmar o link recebido. Inscrever novamente um e-mail já cadastrado não permite assumir a conta. Um envio interrompido do perfil para revisão é retomado no próximo acesso.

A área `/{idioma}/clube` reúne peças disponíveis (com links diretos do MakerWorld ou downloads protegidos), cupons e licenças. Os dois formulários usam a mesma escolha de publicação; a área oferece acesso à rede para receber indicações por cidade.

Em **Administração → Cupons de descontos**, cadastre fornecedor, código, condições, link HTTPS e validade opcional. Os cupons são privados para parceiros autenticados; os inativos e vencidos não são exibidos. A data final considera o fim do dia no horário de Brasília. Nenhum fornecedor ou desconto fictício é cadastrado automaticamente.

Em **Obras**, a opção **Permitir que parceiros obtenham licença gratuita para vender as peças impressas** autoriza a emissão para aquela obra. O presépio já tem essa autorização. Somente obras publicadas, disponíveis e gratuitas (`maker` ou `site`) podem emitir licenças. O parceiro seleciona a peça e gera um código persistente e único para o par conta/obra. Repetir a operação recupera o mesmo código; a API ignora qualquer identidade de parceiro enviada pelo navegador e usa a sessão autenticada. O histórico guarda nome do parceiro, obra, emissão e termos vigentes, mesmo se o catálogo mudar. A autorização se refere a peças físicas, sem redistribuição dos arquivos digitais.

Os dados usam o armazenamento já configurado, sem nova migração: `partner-coupons.json` e `club-licenses/<member-id>.json`. Hashes e dados de recuperação ficam privados em `club-members.json` e não entram na resposta da área do parceiro.

O fluxo **Esqueci minha senha** está integrado à [API de envio do Resend](https://resend.com/docs/api-reference/emails/send-email). Para ativar o envio, configure no ambiente do site `RESEND_API_KEY`, `EMAIL_FROM` (remetente de um domínio verificado) e `SITE_URL` (origem HTTPS oficial). Não salve essas credenciais no repositório. Sem configuração, a interface informa que a recuperação por e-mail não está disponível; não simula um envio bem-sucedido.

O link vence em 30 minutos, pode ser usado uma única vez e carrega o segredo no fragmento da URL, removido assim que a tela abre. O banco guarda somente seu hash. Ao trocar a senha, as sessões antigas são invalidadas. Há limite de tentativas e intervalo entre envios. Testes usam um serviço de envio simulado, sem mandar e-mails reais.

### Ativar os e-mails na hospedagem

1. Crie sua conta no Resend e adicione um domínio ou subdomínio de envio que você controla. Siga a [verificação de domínio](https://resend.com/docs/dashboard/domains/introduction), copiando os registros DNS fornecidos para o painel onde seu domínio é administrado. Aguarde o estado verificado.
2. Crie uma [chave de API](https://resend.com/docs/dashboard/api-keys/introduction) para envio, restrita ao domínio escolhido. Guarde a chave diretamente no painel de hospedagem; não a envie em conversas nem a coloque em arquivos públicos.
3. No projeto do site na Vercel, configure as variáveis de ambiente: `RESEND_API_KEY` com essa chave, `EMAIL_FROM` com um remetente do domínio verificado (formato `Tio Lira <remetente@seu-dominio.com>`) e `SITE_URL` com o endereço HTTPS atual do site. Use valores apropriados para cada ambiente.
4. Faça uma nova publicação para carregar as variáveis. Com uma conta de teste cadastrada no Clube, use **Esqueci minha senha**, confira a chegada do e-mail e conclua a troca da senha. Até esse teste real, a entrega de e-mails ainda não está validada.

Não é necessário escolher fornecedores de filamento para ativar a área: a seção de cupons permanece vazia até cadastrar ofertas reais em **Administração → Cupons de descontos**.

### Menu do parceiro e licença das coleções

A área usa menu lateral com Meu cadastro, Coleções (filtro por coleção), Cupons de desconto e Minhas licenças. O formulário Meu cadastro atualiza nome, logo, localização, contatos, descrição e área atendida no registro privado e no perfil da rede. O e-mail de acesso, status de aprovação, obras autorizadas e licenças não podem ser alterados por esse formulário. Atualizações interrompidas da rede são retomadas no próximo acesso.

A opção **Coleção gratuita — licença de venda automática para parceiros** no administrador emite um código por parceiro e coleção publicada no próximo acesso à área. O Presépio Tio Lira já é gratuito. As licenças da coleção ficam no mesmo registro privado das licenças individuais, que continuam válidas e disponíveis no histórico. Alterações posteriores na coleção não apagam documentos já emitidos. Somente peças disponibilizadas gratuitamente são cobertas; não há permissão para revender ou redistribuir os arquivos digitais.

Os e-mails de recuperação são enviados em HTML e texto, com logo PNG, cabeçalho e rodapé Tio Lira, botão e link alternativo. Os links continuam expirando após 30 minutos, com uso único.

## Compras e integração Asaas

A área do parceiro oferece **Loja e carrinho**, pedidos e arquivos comprados. Peças pagas usam arquivos privados, liberados após confirmação de pagamento; a licença para vender os impressos é emitida automaticamente por peça após a compra confirmada. O administrador acompanha vendas avulsas, peças incluídas em coleções e downloads iniciados. A integração usa cobranças Asaas com Pix e boleto no site, e cartão preenchido diretamente na página hospedada pelo Asaas, com confirmação por webhook.

Veja [configuração, cadastro da coleção e validação em sandbox](docs/asaas-compras.md). A integração só deve ser ativada após configurar as variáveis privadas e o webhook e concluir os testes reais de homologação.

## Mapa da Rede de Lojas

No bloco `#lojas`, os filtros permanecem à esquerda e o mapa do Brasil à direita. As 27 UFs exibem contagens das lojas do catálogo público (aprovadas e com consentimento), agrupadas pelo endereço, em quatro faixas de cor. Ao abrir ou limpar filtros, nenhuma lista geral é exibida: é preciso escolher estado, região ou um país estrangeiro. Clicar no mapa sincroniza o estado e limpa região/cidade anteriores. Região, estado, cidade e peça/coleção se combinam; as contagens do mapa acompanham a peça/coleção. Estados sem lojas continuam selecionáveis e mostram o estado vazio. Ao clicar no estado ou aplicar filtros de localização, o mapa dá lugar a uma lista compacta. Cada parceiro pode ser expandido para ver descrição, entrega, orçamento e Instagram. O botão “Voltar para o mapa” preserva os filtros. A cada seleção ou busca, a ordem é sorteada com Fisher–Yates; abrir e fechar detalhes mantém essa ordem. Somente um parceiro fica expandido por vez.

A geometria simplificada do IBGE é servida junto do código, sem mapas externos, API keys ou geolocalização. O mapa funciona com teclado (Tab, Enter/Espaço) e possui os seletores como alternativa em telas pequenas. Traduções em português, inglês e espanhol. Testes de contagem, filtros e visibilidade: `tests/store-directory.test.mjs`.

### Aviso de compra aprovada

Novas compras aprovadas geram um aviso transacional pelo Resend, usando `RESEND_API_KEY`, `EMAIL_FROM` e `SITE_URL` já usados na recuperação de senha. O e-mail tem versões HTML/texto e abre a compra na área autenticada (`/pt/clube?pedido=…#compras`), onde ficam os arquivos e as licenças. O destinatário é o e-mail privado gravado no pedido. Compras antigas já aprovadas não recebem disparos retroativos.

A notificação é registrada junto com a aprovação e as licenças. O conteúdo enviado é congelado na primeira tentativa e usa uma chave de idempotência por pedido no Resend. Falha de envio não desfaz pagamento ou licença; o webhook separado de e-mail retorna erro temporário para nova tentativa pelo Asaas, inclusive quando o evento de pagamento já foi registrado. A fila principal de pagamentos não é bloqueada por falhas do Resend. Ative o webhook independente pelo botão **Ativar avisos de compra por e-mail**, no painel de vendas; ele usa o domínio oficial de `SITE_URL`, o e-mail operacional do webhook principal e o mesmo token privado. Checkout e consulta manual preservam a confirmação da compra mesmo se o e-mail falhar. Tentativas com resposta incerta há mais de 23 horas exigem verificação no Resend para evitar duplicação após a expiração da chave do provedor. Acompanhe os estados em **Vendas e downloads**; “enviado ao serviço de e-mail” significa aceite do Resend, não confirmação de chegada na caixa de entrada. Verifique a fila independente de avisos por e-mail caso o Resend fique indisponível por muito tempo.

### Capa e galeria das obras

Em **Obras → Editar → Fotos da galeria**, a primeira imagem é a capa. **Usar como capa** move a foto escolhida para o início, preservando as demais. Remover a capa promove a próxima imagem; remover a última deixa a obra sem imagem. O envio da primeira foto define a capa automaticamente. São permitidas 21 fotos no total (a antiga capa mais as 20 fotos já aceitas), com até 10 MB por envio.

Na primeira leitura do catálogo após a publicação, as capas antigas são incluídas no início das galerias, sem duplicação ou exclusão de fotos. A atualização é persistida com comparação de revisão e repetida em caso de edição concorrente; leituras seguintes não alteram a revisão. O catálogo inicial e rascunhos locais recebem a mesma normalização. As vitrines continuam usando `image`, sincronizado com `gallery[0]`.

### Parceiros por download

Em **Vendas e downloads → Por peça**, clique na quantidade de downloads para ver os parceiros, e-mail, número de downloads por parceiro e data do último download. Os dados são restritos à administração autenticada em `GET /api/admin/downloads?productId=…`. Contam entregas iniciadas de arquivos próprios, sem presumir conclusão nem incluir cliques externos do MakerWorld.

`commerce.json` mantém os totais por obra e parceiro em `downloadPartners`, gravados atomicamente com o contador e a lista dos 500 eventos recentes. Registros antigos são agrupados a partir do histórico ainda disponível; no próximo download, essa base é persistida junto do novo evento. Downloads anteriores ao histórico preservado continuam no total e aparecem como sem identificação disponível. Não são atribuídos por inferência a compradores.

## Cartão no checkout hospedado do Asaas

Ao escolher cartão, a loja cria a cobrança sem enviar dados do cartão, valida o `invoiceUrl` retornado pelo Asaas e redireciona o comprador. O formulário local de cartão foi removido. Pedidos pendentes oferecem **Preencher cartão e pagar no Asaas**, sempre retomando a mesma cobrança; pedidos em análise ou pagos não oferecem um novo pagamento.

Com `SITE_URL` configurada para a origem HTTPS oficial, o retorno é ativado por padrão: a cobrança inclui `callback.successUrl` para `/{idioma}/clube?pedido={id}&retorno=asaas#compras` e retorno automático. Cobranças pendentes antigas recebem o mesmo retorno ao serem retomadas pelo site, sem gerar outra cobrança. O domínio deve estar cadastrado na conta Asaas. `ASAAS_PAYMENT_REDIRECT_ENABLED=false` desabilita o retorno; nesse caso, ou sem uma origem válida, o checkout permanece disponível, mas o retorno é manual por Meus pedidos. Ao retornar, a interface consulta a cobrança imediatamente e repete a consulta até seis vezes, a cada três segundos, enquanto aguarda aprovação; depois continua acompanhando o webhook. A confirmação atualiza também o catálogo de downloads para exibir os arquivos e as licenças na mesma tela. A navegação de retorno não aprova pedidos: a confirmação continua pela API/webhook, validando comprador, referência e valor antes de liberar os arquivos e licenças. Pix, boleto, descontos e recuperação de respostas incertas mantêm o fluxo existente.


## Página inicial Movimento

A página inicial usa o catálogo real, com Presépio Tio Lira em destaque e Caminho de Nazaré na seção Sagrada Família. A navegação pelas capas seleciona a coleção no catálogo; busca, disponibilidade e carregamento de mais obras permanecem disponíveis. Clube, mapa da rede, cadastro de parceiros, calculadora, páginas das peças e checkout mantêm suas rotas e componentes.

As seis capas aprovadas estão em `public/assets/collections`, em WebP. `lib/collection-covers.mjs` aplica cada capa somente enquanto a imagem original da coleção coincidir: uma nova imagem salva pelo administrador prevalece. Nenhum dado do catálogo é regravado por essa apresentação. As fontes locais incluem suas licenças OFL.

As ondas e os efeitos respeitam redução de movimento e podem ser pausados. O desenho para quando sai da tela ou a aba fica oculta. Textos novos estão disponíveis em português, inglês e espanhol. Os seletores de países usam rótulos estáticos nos três idiomas para evitar diferenças de hidratação entre versões de ICU no servidor e no navegador.

## Indicadores do site e carrinhos

**Admin → Acessos e conversão** reúne séries de 7/30/90 dias (horário de Maceió), origem aproximada das sessões, dispositivos, idiomas, ranking de obras, carrinhos sem finalizar e pedidos aguardando pagamento. As exportações CSV respeitam o mesmo período e distinguem métricas do período de totais históricos.

- A coleta própria começa nesta versão; não importa nem reconstrói acessos antigos do Google Analytics. Cliques existentes e downloads permanecem acumulados. Vendas por período usam a data de criação do pedido e sua situação atual, separando BRL/USD. A conversão é pedidos pagos / pedidos criados no período, não visitantes / compradores.
- `POST /api/analytics/event` aceita somente páginas públicas conhecidas e detalhes de obras publicadas. Ignora bots identificados, deduplica eventos e registra sessões por dia. A sessão temporária é renovada após 30 minutos sem atividade e armazenada na aba; os identificadores são persistidos no servidor apenas como HMAC diário. O payload não inclui URLs de referência completos, parâmetros, tokens de recuperação ou IPs. Fontes são categorias fixas. DNT/GPC e bloqueadores podem reduzir a coleta. O admin não entra nas visitas.
- `POST /api/club/cart-activity` exige a sessão do comprador e calcula os valores no servidor. As sequências descartam snapshots duplicados ou atrasados. A captura não impede compras quando falha. Um carrinho não vazio, sem pedido correspondente e sem alterações por pelo menos uma hora é indicado como possível abandono. Um pagamento iniciado fica separado, e compras confirmadas não aparecem como abandono. Um carrinho esvaziado deixa a lista. Lembretes de carrinho podem ser enviados automaticamente após 6 horas, conforme a configuração abaixo.
- `GET /api/admin/analytics` exige sessão de admin. Dados privados de carrinhos não entram no catálogo nem no relatório público. Pedidos de teste e produção permanecem separados. O recurso não altera pagamentos, arquivos, licenças ou os contadores antigos.
- Usa os registros existentes do armazenamento: `analytics/started.json`, `analytics/days/YYYY-MM-DD.json` e `analytics/carts.json`, sem migração. A retenção de snapshots de carrinhos é de até 90 dias / 5.000 carrinhos. O painel avisa se a coleta diária atingir o limite de 5.000 sessões ou 10.000 eventos na janela de deduplicação de uma hora. Relatórios históricos de acessos estão disponíveis nos últimos 90 dias.


### Lembretes de carrinho

- `vercel.json` agenda `GET /api/cron/cart-reminders` a cada 5 minutos em produção. A chamada exige `Authorization: Bearer $CRON_SECRET`; configure esse segredo somente na hospedagem. Reutiliza `RESEND_API_KEY`, `EMAIL_FROM` e `SITE_URL` do serviço de e-mail existente. Não executa envios em deployments Preview.
- Um lembrete após **6 horas sem alteração**, para o carrinho mais recente do membro, com até 30 dias. Carrinhos vazios, com pedido pendente/pago, produtos já adquiridos ou indisponíveis e clientes que desativaram avisos são excluídos. Nenhum desconto é criado automaticamente.
- O botão **Enviar lembrete** em Admin → Acessos e conversão → Carrinhos abandonados permite envio manual antes das 6 horas (a lista identifica abandono após 1 hora). Ambos compartilham o limite de um envio por carrinho e um por membro a cada 24 horas. O envio manual exige admin, mesma origem e rate limit.
- `analytics/cart-reminders.json` guarda os jobs, opt-outs e o último processamento. Lease atômico e chave idempotente no Resend evitam duplicatas entre agendador, botão e reentregas. O payload é congelado nas tentativas e removido após sucesso. Uma tentativa ambígua com 23 horas exige revisão no provedor; não dispara outra mensagem automaticamente. “Enviado ao provedor” não confirma entrega/leitura.
- O link assinado no fragmento da URL dura 30 dias, exige a conta destinatária e recupera a seleção/cupom com validação de disponibilidade e preços atuais. Não concede login, licença nem download. Pedidos já existentes abrem a compra correspondente. Tokens de recuperação e cancelamento têm finalidades distintas. O token não é incluído nos eventos de acesso nem no `page_location` do Google Analytics.
- O cancelamento abre uma página traduzida e exige um clique explícito. Não altera e-mails de pagamento nem compras, arquivos ou licenças. Mensagens e telas de recuperação/cancelamento têm português, inglês, espanhol e francês.
- `tests/cart-reminders.test.mjs` usa destinatários `.invalid` e provedor simulado: limite de 6 horas, envio manual, concorrência, retries, bloqueio pós-compra, opt-out, propriedade do link, coleções, cupons inválidos, idiomas e proteção das rotas. Nenhuma mensagem real é disparada pelos testes.

- **Enviar um teste para minha conta**, no painel de lembretes, exige um membro existente e envia uma peça disponível com assunto `[TESTE]`. Usa o mesmo remetente, template, assinatura e verificação de propriedade do link. O carrinho de teste fica isolado no job, sem criar abandono fictício, pedido ou conta. O endpoint `POST /api/admin/cart-reminders/test` exige administrador e limite de frequência; segue opt-out e deduplicação.

### Referências de impressão e peças avulsas

A Área do Parceiro usa `data/print-estimates.json` para preencher filamento e horas por obra. A página pública e o detalhe do parceiro exibem os mesmos totais através de `PrintEstimate`. Cada registro é associado ao ID, caminho do arquivo e URL publicados: uma troca de arquivo invalida a referência anterior. Não há estimativas inventadas para obras sem perfil validado.

`scripts/import-print-estimates.py manifest.json output.json` importa referências de projetos Bambu Studio completos. O manifesto local relaciona ID, 3MF e, opcionalmente, todos os G-codes. O importador exige todas as bandejas, soma o peso de todos os filamentos e o tempo estimado total. Nos arquivos em que o cabeçalho omite o peso, aceita o `used_g` do `slice_info.config` do próprio arquivo, conferindo a concordância do tempo. Arquivos e caminhos locais do manifesto não devem ser publicados. O JSON de saída contém apenas a referência necessária ao site; não contém modelos digitais nem credenciais.

Os custos da oficina continuam sendo informados pelo parceiro em BRL. Selecionar uma obra carrega a referência; abrir uma ficha salva recupera seus valores pessoais. Peças avulsas têm nome e identificador próprios, ficam na mesma conta privada e não alteram catálogo, pedidos ou licenças. O servidor recalcula os resultados e valida os números antes de salvar.

Validação adicional do importador: `python3 tests/print-importer.test.py`.

A calculadora começa com a seleção vazia e aceita grupos de obras com quantidades de 1 a 999 por obra. O filamento e o tempo são somados a partir dos perfis completos; adicionar, remover ou alterar quantidades substitui eventuais ajustes manuais desses dois campos pelas referências. Trabalho manual, embalagem e outros custos são informados como totais do conjunto. Fichas de grupo usam `groupId` e `items`, preservando as fichas individuais e avulsas existentes.

Nos grupos, o detalhamento avulso usa o perfil de cada obra para ratear filamento e tempo (inclusive ajustes manuais aos totais). Trabalho manual, embalagem e demais custos informados para o conjunto são divididos igualmente por unidade. Cada preço avulso usa a mesma margem, taxas, reserva para falhas e arredondamento da calculadora. A soma dos preços avulsos pode diferir do preço do conjunto, arredondado uma única vez. Se faltarem referências em um grupo misto, o detalhamento não é inventado.
