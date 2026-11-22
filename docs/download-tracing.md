# Identificação das cópias 3MF

Todos os downloads diretos `.3mf` em `/api/download` (compra, assinatura ou
acesso gratuito autorizado, incluindo perfis alternativos) recebem um código
aleatório e assinatura HMAC SHA-256 em `tiolira:Trace`, com `preserve="1"`.
O original privado no Blob é somente lido. Malhas, coordenadas, configurações e
G-code não são modificados. Apenas o XML principal é recomprimido; as outras
entradas ZIP são copiadas comprimidas, byte a byte.

Um registro privado por emissão em `download-traces/<id>.json` guarda o
cadastro, obra, perfil, data, hash do original e segredo individual de assinatura.
O arquivo não inclui nome, e-mail ou telefone. Preservar esses registros nos
backups de `tiolira.records`/armazenamento privado: sem eles não existe consulta.

No admin, **Negócio → Rastrear arquivo 3MF**, o seletor analisa o ZIP localmente
com leitura por intervalos. Só a identificação é enviada à API autenticada,
protegida por origem, limite de corpo e limite de consultas. A resposta não
expõe o segredo. A biblioteca de leitura não extrai caminhos para o disco.

A emissão falha sem entregar um original sem código quando houver erro de
validação, processamento ou persistência. Arquivos temporários são privados e
removidos após o envio ou erro. `streamed` significa envio concluído pelo servidor,
não prova de que o usuário salvou a cópia. `prepared` e `interrupted` indicam
conclusão não confirmada. Não há cache público da resposta personalizada.

Limites: ZIP de um único volume, sem criptografia ou diretório ZIP64, até 2 GiB;
XML principal até 128 MiB. Entradas de malhas externas não são descomprimidas.
Esses limites, disco temporário e duração da função devem ser considerados ao
subir modelos excepcionalmente grandes. O procedimento não identifica cópias
antigas, downloads no MakerWorld, STL, fotos ou arquivos cujo código foi removido.
Um código válido pode ser transplantado para outro arquivo: a consulta vincula
uma emissão a uma conta e **não prova autoria de vazamento**. Não bloqueia contas.

Validação: testes de autorização, assinatura adulterada, código desconhecido,
duplicidade, CRC, dados malformados, falha de armazenamento e preservação de
geometria/configurações. Teste local com arquivos reais de 3,8 MB e 82 MB e
inspeção independente com Python ZIP/CRC. A leitura do navegador também aceita
o metadado preservado pelo Bambu quando ele remove a declaração de namespace
ao salvar novamente. Artefatos e identidades de teste não são publicados.
