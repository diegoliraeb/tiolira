# Tio Lira — estúdio de criação 3D

Prévia em **React 19 + Next.js 16 (App Router)**, preparada para importar na Vercel. Português, inglês e espanhol, com 22 obras do catálogo público original e a nova marca TL em SVG.

## Criar a prévia na Vercel

1. Importe o repositório `diegoliraeb/tiolira` no painel da Vercel.
2. Selecione a branch `main`, diretório raiz `./` e framework **Next.js**.
3. Mantenha os comandos automáticos de instalação/build. Node.js **24.x**.
4. Clique em Deploy. **Não são necessárias variáveis de ambiente para esta prévia.**

A página inicial redireciona para `/pt`. Também existem `/en`, `/es`, `/admin`, `/{idioma}/calculadora` e `/{idioma}/produto/{slug}`. Os caminhos antigos `/3d`, `/3d/produto/*`, `/3d/calculadora` e `/3d/admin` redirecionam para os equivalentes novos.

## O que está funcionando

- Catálogo com busca, filtros, páginas individuais, imagens e descrições nos três idiomas.
- Presépio gratuito e autorização do criador para vender **peças físicas**, sem assinatura. Arquivos digitais não podem ser revendidos ou redistribuídos.
- Links oficiais de download; modelos exclusivos permanecem no MakerWorld.
- Rede por cidade e obra, sem lojas fictícias. Cadastro gratuito para pessoas e lojas; consentimento separado para futuras parcerias. Cadastro sem seleção de peças, com confirmação explícita e revisão antes da publicação. Busca por peça ou coleção completa (todas as peças já lançadas); participantes sem catálogo também aparecem, com aviso para consultar disponibilidade. O pedido escolhido segue na mensagem de orçamento do WhatsApp.
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

O cadastro gratuito fica ativo quando o banco e a configuração de segurança estão disponíveis. Cada inscrição entra como `pending`; o administrador revisa antes de publicar. E-mail, consentimento de parcerias e dados de autorização ficam privados. Nunca coloque a conexão do banco em variáveis `NEXT_PUBLIC_*` ou no GitHub.

Sem banco ou armazenamento configurado, `/admin` continua mostrando uma demonstração pública com somente o catálogo público. Rascunhos ficam no navegador e não alteram o site. Na versão conectada, a demonstração é substituída pelo login real; rascunhos locais não são importados automaticamente.

Os adaptadores de armazenamento local e Vercel Blob privado foram preservados para compatibilidade, mas **DATABASE_URL tem prioridade**. Blob só é necessário se forem hospedados arquivos privados por esse serviço. As imagens importadas continuam em `public/assets` e os modelos exclusivos permanecem no MakerWorld.

Para um novo banco ou uma branch Neon de preview sem o schema, execute a migração nesse ambiente antes do deploy. As variáveis `ADMIN_SESSION_SECRET` e `ADMIN_SETUP_TOKEN` são opcionais e sobrepõem a configuração do banco; mantenha-as privadas caso escolha usá-las.

## Conteúdo e disponibilidade

Origem: catálogo público de https://diegolira.com.br/3d, consultado em 27/09/2026. As descrições foram preservadas em português e traduzidas para inglês e espanhol. Páginas e capas dos 22 modelos foram importadas. Modelos que ainda constavam como “em breve” mantêm esse status; o administrador pode atualizar os links depois do lançamento.

Os downloads próprios de **Padre Cícero** e **Frei** ainda apontam para suas páginas originais. Os arquivos STL/3MF privados não foram fornecidos e não estão no repositório. Foram incluídas também as imagens adicionais recuperadas de Melchior, Maria, Frei e Orgulho de ser arretado. As demais galerias adicionais ainda dependem da migração de mídia; a capa está disponível para todas as obras. Não desligue o site original antes de migrar esses downloads. Não foi alterado nenhum domínio.

As assinaturas ainda não cobram e não foram abertas. O painel aceita o link de uma plataforma externa; essa plataforma deverá proteger os downloads e gerenciar pagamentos. Nunca publique URLs diretas de arquivos pagos. Os detalhes dos planos, preços e termos ainda precisam ser definidos.

O cadastro aceita logo opcional em PNG, JPG ou WebP, até 2 MB e 16 megapixels. A imagem é decodificada no servidor, convertida para WebP de até 512 px e salva em um registro separado do catálogo no banco conectado; não depende de Vercel Blob. Logos de cadastros pendentes são visíveis apenas no painel autenticado. A publicação acompanha a aprovação da loja; o administrador pode trocar ou remover a logo. O site destaca o benefício de criações selecionadas exclusivas para lojas cadastradas; a distribuição desses arquivos ainda será definida, sem ativar assinaturas.

O painel Rede de Lojas tem filtros combinados por situação, região brasileira (ou Exterior), estado, cidade e nome. Endereços usam seletores encadeados de país, estado e cidade. A área atendida pode abranger todo o país, um estado, uma cidade ou várias cidades de estados diferentes. A busca pública considera essa área; cadastros antigos sem área estruturada continuam sendo encontrados pelo endereço.

As localidades são snapshots servidos pelo próprio site, sem enviar dados de compradores ou lojistas a serviços externos. Brasil: 27 UFs e 5.571 municípios do IBGE. Outros países: Countries States Cities Database, com atribuição e ODbL em `public/geography/`. A base comunitária pode ter lacunas; localidades ausentes mostram uma orientação de contato. A API valida a relação entre país, estado e município, e grava os nomes canônicos. Os registros existentes são preservados, sem migração destrutiva.

A aprovação na rede serve para revisar as informações do cadastro. Não exige assinatura nem comprovante para o presépio. Obras de outras coleções só aparecem no diretório após registrar a autorização comercial correspondente. O consentimento para parcerias é privado e separado do consentimento de publicação na rede.

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
