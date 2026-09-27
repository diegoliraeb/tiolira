# Integração do banco de dados

O site público já pode ser publicado sem credenciais. O banco definitivo deverá implementar o contrato de `server/store.mjs` ou substituí-lo por um repositório tipado. A interface não deve acessar segredos do banco.

## Entidades

- **Obras**: identificador, slug único, coleção, nome, descrição, resumo, imagens, tamanho, destino de download, disponibilidade, exclusividade, publicação, licença e traduções EN/ES. Arquivo privado separado do catálogo público.
- **Coleções**: nome, descrição, imagem, gratuita/exclusiva, publicação e traduções.
- **Participantes da rede**: nome, cidade, estado/região, país, WhatsApp comercial, site, descrição, região atendida, obras, status de revisão, e-mail privado, consentimento de publicação, consentimento de parcerias, data. Presépio não exige licença paga nem validade. Para obras de outras coleções, autorização e validade são campos administrativos privados.
- **Planos**: nome, descrição, preço exibido, link da plataforma, status e coleções abrangidas. Cobrança e direito de acesso devem ser confirmados pela plataforma escolhida.
- **Configurações**: textos do site e traduções, Instagram, contato, abertura do cadastro.
- **Administrador**: autenticação no servidor, sem cadastro público com poder administrativo. Substituir o adaptador exige preservar verificação de sessão e autorização em todas as mutações.

## Comportamento obrigatório

1. Leitura pública deve excluir e-mail privado, consentimento de parcerias, comprovação de licença, credenciais e caminhos de arquivos privados.
2. Inscrição pública cria apenas `pending`; nunca recebe status de aprovação do formulário.
3. Publicar ou editar exige administrador autenticado e validação de origem.
4. A rede lista somente participantes aprovados com consentimento de publicação.
5. Presépio: gratuito e autorizado para venda física, sem assinatura. Não distribuir arquivos exclusivos do MakerWorld fora da plataforma.
6. Mutações precisam ser atômicas e recusar conflitos de revisão.
7. Preservar consentimentos separados e oferecer correção/remoção por solicitação ao criador.
8. Rascunhos da demonstração não devem ser importados automaticamente para produção. Revisar o JSON exportado antes de qualquer migração.

O adaptador Blob privado opcional usa documentos JSON versionados. Para uma rede grande, o banco relacional poderá oferecer busca indexada por cidade/país e tabelas específicas. O banco será conectado após o usuário informar o serviço escolhido.
