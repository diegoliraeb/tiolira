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

## Mapa da Rede de Lojas

No bloco `#lojas`, os filtros permanecem à esquerda e o mapa do Brasil à direita. As 27 UFs exibem contagens das lojas do catálogo público (aprovadas e com consentimento), agrupadas pelo endereço, em quatro faixas de cor. Ao abrir ou limpar filtros, nenhuma lista geral é exibida: é preciso escolher estado, região ou um país estrangeiro. Clicar no mapa sincroniza o estado e limpa região/cidade anteriores. Região, estado, cidade e peça/coleção se combinam; as contagens do mapa acompanham a peça/coleção. Estados sem lojas continuam selecionáveis e mostram o estado vazio. Os botões de orçamento e Instagram e as informações de entrega permanecem nos cartões.

A geometria simplificada do IBGE é servida junto do código, sem mapas externos, API keys ou geolocalização. O mapa funciona com teclado (Tab, Enter/Espaço) e possui os seletores como alternativa em telas pequenas. Traduções em português, inglês e espanhol. Testes de contagem, filtros e visibilidade: `tests/store-directory.test.mjs`.
