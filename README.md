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
- Rede por cidade e obra, sem lojas fictícias. Cadastro gratuito para pessoas e lojas; consentimento separado para futuras parcerias.
- Calculadora com material, energia, depreciação, manutenção, falhas, trabalho, taxas e margem. Salva simulações no navegador.
- Painel demonstrável: editar obras, coleções, planos, traduções e textos; revisar participantes; exportar catálogo JSON e CSV de contatos que aceitaram parcerias.
- Marca TL vetorial em `public/assets/tl-monogram.svg`.

## O que aguarda o banco de dados

Sem armazenamento configurado, `/admin` mostra **uma demonstração pública com apenas o catálogo público**. As alterações são rascunhos locais no navegador e **não alteram o site**. Não cadastre dados privados na demonstração. O formulário público informa que o envio ainda não está ativo; ele não simula um cadastro recebido.

O banco e o serviço de autenticação definitivos serão conectados depois que forem informados. A fronteira de persistência está em `server/store.mjs` e as regras em `server/schema.mjs`. `docs/DADOS.md` descreve as entidades. Nenhuma credencial deve ser colocada no GitHub ou em variáveis `NEXT_PUBLIC_*`.

Há um adaptador opcional já implementado para **Vercel Blob privado**, além de armazenamento local de desenvolvimento. Ele não exige uso desse fornecedor: pode ser substituído pelo banco escolhido. Para utilizá-lo, conecte um Blob **privado**, configure `BLOB_READ_WRITE_TOKEN`, `ADMIN_SETUP_TOKEN` e `ADMIN_SESSION_SECRET` (as duas últimas com pelo menos 32 caracteres aleatórios), faça novo deploy e crie o primeiro administrador em `/admin`. Remova o setup token após a configuração. O login usa senha com scrypt, cookie HttpOnly, validação de origem, limite de tentativas e sessão de 8 horas. Mantenha o token da sessão para o login continuar funcionando.

`LOCAL_DATA_DIR` é somente para desenvolvimento, nunca para a Vercel. O modo real exige todas as chaves e armazenamento persistente. Alterações simultâneas usam revisão para impedir sobrescrita silenciosa.

## Conteúdo e disponibilidade

Origem: catálogo público de https://diegolira.com.br/3d, consultado em 27/09/2026. As descrições foram preservadas em português e traduzidas para inglês e espanhol. Páginas e capas dos 22 modelos foram importadas. Modelos que ainda constavam como “em breve” mantêm esse status; o administrador pode atualizar os links depois do lançamento.

Os downloads próprios de **Padre Cícero** e **Frei** ainda apontam para suas páginas originais. Os arquivos STL/3MF privados não foram fornecidos e não estão no repositório. Foram incluídas também as imagens adicionais recuperadas de Melchior, Maria, Frei e Orgulho de ser arretado. As demais galerias adicionais ainda dependem da migração de mídia; a capa está disponível para todas as obras. Não desligue o site original antes de migrar esses downloads. Não foi alterado nenhum domínio.

As assinaturas ainda não cobram e não foram abertas. O painel aceita o link de uma plataforma externa; essa plataforma deverá proteger os downloads e gerenciar pagamentos. Nunca publique URLs diretas de arquivos pagos. Os detalhes dos planos, preços e termos ainda precisam ser definidos.

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
