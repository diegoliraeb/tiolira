export const languages = ['pt','en','es'];
export const localeNames = {pt:'Português',en:'English',es:'Español'};
export function localized(item,lang){return {...item,...item.translations?.[lang]};}
const rows={
 logoLabel:['Logo da loja (opcional)','Shop logo (optional)','Logo de la tienda (opcional)'],logoHelp:['Envie PNG, JPG ou WebP de até 2 MB. A logo será exibida após a aprovação do cadastro.','Upload a PNG, JPG or WebP up to 2 MB. Your logo will appear once your listing is approved.','Envía un PNG, JPG o WebP de hasta 2 MB. El logo aparecerá tras la aprobación del registro.'],logoPreview:['Prévia da logo da loja','Shop logo preview','Vista previa del logo'],removeLogo:['Remover logo','Remove logo','Quitar logo'],logoOf:['Logo de','Logo of','Logo de'],logoError:['Não foi possível usar essa imagem. Envie uma logo PNG, JPG ou WebP válida de até 2 MB e 16 megapixels.','This image could not be used. Upload a valid PNG, JPG or WebP logo up to 2 MB and 16 megapixels.','No se pudo utilizar esta imagen. Envía un logo PNG, JPG o WebP válido de hasta 2 MB y 16 megapíxeles.'],
 networkBenefitTitle:['Sua loja faz parte da criação.','Your shop is part of the creative journey.','Tu tienda forma parte de la creación.'],networkBenefit:['Além de conectar compradores e vendedores, a Rede de Lojas oferece às lojas cadastradas algumas criações do Tio Lira com exclusividade. O cadastro é gratuito.','Beyond connecting buyers and sellers, the Maker Network gives registered shops exclusive access to selected Tio Lira creations. Registration is free.','Además de conectar compradores y vendedores, la Red de Tiendas ofrece a las tiendas registradas algunas creaciones de Tio Lira en exclusiva. El registro es gratuito.'],

 storeCountOne:['participante encontrado','maker found','participante encontrado'],
 locationSources:['Localidades','Location data','Localidades'],
 selectCountry:['Selecione o país','Select a country','Selecciona el país'],selectState:['Selecione o estado','Select a state / region','Selecciona el estado / región'],selectCity:['Selecione a cidade','Select a city','Selecciona la ciudad'],
 locationError:['Não foi possível carregar as localidades.','Could not load locations.','No se pudieron cargar las localidades.'],locationMissing:['Esta localidade ainda não está disponível na base. Entre em contato com o Tio Lira para cadastrar seu endereço.','This location is not in our database yet. Contact Tio Lira to register your address.','Esta localidad aún no está disponible. Contacta con Tio Lira para registrar tu dirección.'],retry:['Tentar novamente','Try again','Volver a intentar'],
 deliveryScope:['Para onde você vende?','Where do you sell?','¿Dónde vendes?'],wholeCountry:['Todo o país','Entire country','Todo el país'],oneState:['Um estado','One state / region','Un estado / región'],oneCity:['Uma cidade','One city','Una ciudad'],severalCities:['Selecionar várias cidades','Select multiple cities','Seleccionar varias ciudades'],deliveryPrefix:['Atendimento —','Service area —','Atención —'],citiesHelp:['Selecione o estado e a cidade. Você pode adicionar cidades de estados diferentes.','Select a state and city. You can add cities from different states.','Selecciona el estado y la ciudad. Puedes añadir ciudades de distintos estados.'],chooseDeliveryCity:['Adicione pelo menos uma cidade à área atendida.','Add at least one city to your service area.','Añade al menos una ciudad a tu zona de atención.'],remove:['Remover','Remove','Quitar'],clearFilters:['Limpar filtros','Clear filters','Limpiar filtros'],storeCount:['participantes encontrados','makers found','participantes encontrados'],storeSearchHelp:['Busque pela sua localização para encontrar quem atende sua cidade.','Search your location to find makers serving your city.','Busca tu ubicación para encontrar quién atiende tu ciudad.'],

 buyPhysical:['Quero comprar a peça física','I want to buy a physical piece','Quiero comprar la pieza física'],
 completeCollection:['coleção completa','complete collection','colección completa'],
 registrationReview:['Recebemos suas informações. Seu cadastro aguarda revisão e aparecerá na Rede de Lojas após a aprovação. Não é necessário enviar novamente.','We received your information. Your listing is awaiting review and will appear in the maker network once approved. You do not need to submit it again.','Recibimos tus datos. Tu registro está pendiente de revisión y aparecerá en la red tras su aprobación. No necesitas enviarlo de nuevo.'],
 registrationError:['Confira os dados e tente novamente. Seu cadastro ainda não foi confirmado.','Check your details and try again. Your registration has not been confirmed yet.','Revisa tus datos e inténtalo de nuevo. Tu registro aún no se ha confirmado.'],
 registrationLimit:['Muitas tentativas. Aguarde antes de tentar novamente.','Too many attempts. Please wait before trying again.','Demasiados intentos. Espera antes de volver a intentarlo.'],
 registrationClosed:['Os cadastros estão temporariamente fechados. Tente novamente mais tarde.','Registration is temporarily closed. Please try again later.','El registro está cerrado temporalmente. Inténtalo más tarde.'],
 whatsappHelp:['Inclua o código do país e DDD. Exemplo: 55 82 99999-9999.','Include the country and area codes. Example: 55 82 99999-9999.','Incluye el código de país y de área. Ejemplo: 55 82 99999-9999.'],
 confirmAvailability:['Consulte a disponibilidade da peça ou coleção diretamente com este participante.','Ask this maker about availability of the piece or collection.','Consulta la disponibilidad de la pieza o colección con este participante.'],
 collectionSearchNote:['Você pode pedir uma peça ou a coleção completa. Participantes sem catálogo informado também aparecem: confirme a disponibilidade ao pedir orçamento.','You can request a piece or the full collection. Makers without a listed catalog also appear: confirm availability when requesting a quote.','Puedes pedir una pieza o la colección completa. También aparecen participantes sin catálogo: confirma la disponibilidad al pedir presupuesto.'],
 studio:['ESTÚDIO DE CRIAÇÃO 3D','3D DESIGN STUDIO','ESTUDIO DE CREACIÓN 3D'],
collections:['Coleções','Collections','Colecciones'],works:['Obras','Models','Obras'],stores:['Rede de lojas','Maker network','Red de tiendas'],club:['Clube Tio Lira','Tio Lira Club','Club Tio Lira'],clubAccessTitle:["Seja um parceiro Tio Lira", "Become a Tio Lira partner", "Conviértete en socio de Tio Lira"],clubAccessIntro:["Cadastre-se gratuitamente para aproveitar os benefícios de ser parceiro e levar nossas criações a mais pessoas.", "Join for free to enjoy partner benefits and bring our creations to more people.", "Regístrate gratis para disfrutar los beneficios de ser socio y llevar nuestras creaciones a más personas."],clubArea:["Área do parceiro", "Partner area", "Área del socio"],clubAreaIntro:["Suas coleções, cupons de descontos e licenças para vender as peças impressas, em um só lugar.", "Your collections, discount coupons and licenses to sell physical prints, all in one place.", "Tus colecciones, cupones de descuento y licencias para vender piezas impresas, en un solo lugar."],clubWelcome:['BEM-VINDO AO CLUBE','WELCOME TO THE CLUB','BIENVENIDO AL CLUB'],clubLibraryEyebrow:['BIBLIOTECA DO CLUBE','CLUB LIBRARY','BIBLIOTECA DEL CLUB'],clubLibraryTitle:["Coleções e peças disponíveis", "Available collections and models", "Colecciones y piezas disponibles"],clubFiles:['arquivos','files','archivos'],clubNoFiles:["Novas peças estarão disponíveis em breve.", "New models will be available soon.", "Pronto habrá nuevas piezas disponibles."],clubLogin:['Entrar','Log in','Iniciar sesión'],clubRegister:['Criar cadastro','Create account','Crear cuenta'],clubLoginTitle:['Entre no Clube','Log in to the Club','Inicia sesión en el Club'],clubRegisterTitle:['Crie seu cadastro gratuito','Create your free account','Crea tu cuenta gratuita'],clubLoginIntro:["Entre para acessar os benefícios e as oportunidades para parceiros.", "Log in to access partner benefits and opportunities.", "Entra para acceder a los beneficios y oportunidades para socios."],clubRegisterIntro:["Faça parte do Clube e aproveite os benefícios para quem imprime e vende.", "Join the Club and enjoy benefits for makers who print and sell.", "Únete al Club y disfruta los beneficios para quienes imprimen y venden."],clubBenefitOne:["Receba indicações de quem quer comprar ao participar da nossa rede de parceiros.", "Receive buyer referrals by joining our partner network.", "Recibe recomendaciones de compradores al participar en nuestra red de socios."],clubBenefitTwo:["Cupons de descontos em materiais e filamentos dos principais fornecedores.", "Discount coupons for materials and filaments from leading suppliers.", "Cupones de descuento en materiales y filamentos de los principales proveedores."],clubBenefitThree:["Coleções gratuitas selecionadas e licença para vender as peças impressas autorizadas.", "Selected free collections and licenses to sell authorized physical prints.", "Colecciones gratuitas seleccionadas y licencia para vender las piezas impresas autorizadas."],clubPassword:['Senha (mínimo 12 caracteres)','Password (at least 12 characters)','Contraseña (mínimo 12 caracteres)'],clubConsent:["Aceito criar minha conta de parceiro no Clube Tio Lira.", "I agree to create my Tio Lira Club partner account.", "Acepto crear mi cuenta de socio en el Club Tio Lira."],clubRegisterSubmit:['Criar conta e entrar','Create account and enter','Crear cuenta y entrar'],clubLoginSubmit:['Entrar no Clube','Log in to the Club','Iniciar sesión en el Club'],clubLogout:['Sair','Log out','Cerrar sesión'],clubWait:['Aguarde...','Please wait...','Espera...'],clubRegistered:['Cadastro criado. Sua área está pronta.','Account created. Your area is ready.','Cuenta creada. Tu área está lista.'],clubError:['Não foi possível concluir o acesso.','Could not complete access.','No se pudo completar el acceso.'],clubUnavailable:['O Clube ainda não está disponível. Tente novamente mais tarde.','The Club is not available yet. Please try again later.','El Club todavía no está disponible. Inténtalo más tarde.'],about:['O criador','The creator','El creador'],
 gift:['UM PRESENTE FEITO DE FÉ E AFETO','A GIFT OF FAITH AND LOVE','UN REGALO DE FE Y CARIÑO'],
 clubDownloadLogin:['Entrar no Clube para baixar','Log in to download','Inicia sesión para descargar'],downloadNativity:['Explorar o presépio gratuito','Explore the free nativity','Explorar el belén gratuito'],sell:['Quero imprimir para vender','I want to print and sell','Quiero imprimir para vender'],
 madeBy:['Modelado por Diego Lira.','Designed by Diego Lira.','Diseñado por Diego Lira.'],fromBrazil:['Do Nordeste do Brasil, para a sua loja.','From Northeast Brazil, to your shop.','Del nordeste de Brasil, para tu tienda.'],
 christmas:['Um Natal para criar.','A Christmas to create.','Una Navidad para crear.'],memories:['E guardar na memória.','And remember forever.','Y guardar en la memoria.'],
 original:['MODELOS AUTORAIS','ORIGINAL MODELS','MODELOS ORIGINALES'],freeNativity:['PRESÉPIO GRATUITO','FREE NATIVITY','BELÉN GRATUITO'],nextCollections:['COLEÇÕES EXCLUSIVAS A CAMINHO','EXCLUSIVE COLLECTIONS COMING','NUEVAS COLECCIONES EXCLUSIVAS'],
 universe:['UM UNIVERSO DE POSSIBILIDADES','A WORLD OF POSSIBILITIES','UN MUNDO DE POSIBILIDADES'],collectionTitle:['Cada coleção, uma história.','Every collection tells a story.','Cada colección, una historia.'],explore:['Explorar a coleção','Explore the collection','Explorar la colección'],
 catalogEyebrow:['DA IDEIA À IMPRESSÃO','FROM IDEA TO PRINT','DE LA IDEA A LA IMPRESIÓN'],catalogTitle:['Sua próxima impressão começa aqui.','Your next print starts here.','Tu próxima impresión empieza aquí.'],search:['Buscar uma peça...','Search for a model...','Buscar una pieza...'],all:['Todas as obras','All models','Todas las obras'],available:['Só disponíveis','Available now','Solo disponibles'],results:['obras encontradas','models found','obras encontradas'],digital:['Arquivos digitais para impressão 3D','Digital files for 3D printing','Archivos digitales para impresión 3D'],more:['Explorar mais obras','Explore more models','Explorar más obras'],none:['Nenhuma peça encontrada. Tente outro nome.','No models found. Try another name.','No hay resultados. Prueba otro nombre.'],
 free:['Gratuito','Free','Gratis'],maker:['Grátis no MakerWorld','Free on MakerWorld','Gratis en MakerWorld'],soon:['Em breve','Coming soon','Próximamente'],members:['Coleção exclusiva','Exclusive collection','Colección exclusiva'],details:['Conhecer a obra','View model','Ver obra'],download:['Baixar gratuitamente','Download for free','Descargar gratis'],makerDownload:['Baixar no MakerWorld','Download on MakerWorld','Descargar en MakerWorld'],originalPage:['Baixar no site original','Download on original site','Descargar en el sitio original'],notReleased:['Lançamento em preparação.','Release in preparation.','Lanzamiento en preparación.'],back:['Voltar ao catálogo','Back to catalog','Volver al catálogo'],size:['Dimensões de referência','Reference dimensions','Dimensiones de referencia'],instructions:['Sobre esta criação','About this creation','Sobre esta creación'],license:['Licença de uso','Usage license','Licencia de uso'],render:['Imagens ilustrativas de apresentação dos modelos.','Illustrative presentation images of the models.','Imágenes ilustrativas de presentación de los modelos.'],
 physicalLicense:['O presépio é gratuito, inclusive para imprimir e vender as peças físicas. Não é preciso assinar o clube. Os arquivos digitais não podem ser revendidos ou redistribuídos. Os downloads exclusivos permanecem no MakerWorld.','The nativity is free, including permission to print and sell physical pieces. No club subscription is needed. Digital files must not be resold or redistributed. Exclusive downloads remain on MakerWorld.','El belén es gratuito, incluido el permiso para imprimir y vender las piezas físicas. No necesitas suscribirte al club. No se pueden revender ni redistribuir los archivos digitales. Las descargas exclusivas permanecen en MakerWorld.'],
 otherLicense:['Consulte a licença específica na página do modelo antes de vender impressões. Arquivos digitais não podem ser revendidos ou compartilhados.','Check the model’s specific license before selling prints. Digital files must not be resold or shared.','Consulta la licencia específica del modelo antes de vender impresiones. No se pueden revender ni compartir los archivos digitales.'],
 shopEyebrow:['A CRIAÇÃO CONECTA PESSOAS','CREATIVITY CONNECTS PEOPLE','LA CREATIVIDAD CONECTA PERSONAS'],shopTitle:['Encontre quem imprime perto de você.','Find a maker near you.','Encuentra quién imprime cerca de ti.'],shopIntro:['Não tem impressora? Encontre uma pessoa ou loja, peça um orçamento e combine sua peça diretamente.','No printer? Find a maker or shop, request a quote and arrange your piece directly.','¿No tienes impresora? Encuentra una persona o tienda, pide presupuesto y acuerda tu pieza directamente.'],city:['Cidade','City','Ciudad'],state:['Estado / região','State / region','Estado / región'],country:['País','Country','País'],piece:['Qual peça você procura?','Which model are you looking for?','¿Qué pieza buscas?'],find:['Encontrar quem imprime','Find makers','Buscar quién imprime'],join:['Cadastrar gratuitamente','Join for free','Registrarme gratis'],noStores:['Nossa rede está começando. Seja um dos primeiros a participar.','Our network is just getting started. Be one of the first to join.','Nuestra red está empezando. Sé de los primeros en participar.'],noMatch:['Ainda não há participantes para esta busca.','No makers match this search yet.','Aún no hay participantes para esta búsqueda.'],quote:['Pedir orçamento','Request a quote','Pedir presupuesto'],disclaimer:['Preço, prazo, entrega e pagamento são combinados diretamente com o vendedor.','Price, timing, delivery and payment are arranged directly with the seller.','Precio, plazo, entrega y pago se acuerdan directamente con el vendedor.'],
 joinTitle:['Sua impressora. Novas conexões.','Your printer. New connections.','Tu impresora. Nuevas conexiones.'],joinIntro:['Cadastro gratuito para pessoas e lojas. Você pode vender as peças físicas do presépio sem assinatura. Os cadastros passam por uma revisão antes de aparecer na rede.','Free registration for individuals and shops. You can sell physical nativity prints without subscribing. Applications are reviewed before appearing in the network.','Registro gratuito para personas y tiendas. Puedes vender las piezas físicas del belén sin suscripción. Revisamos los registros antes de publicarlos en la red.'],
 name:['Seu nome ou nome da loja','Your name or shop name','Tu nombre o el de tu tienda'],email:['E-mail privado','Private email','Correo privado'],whatsapp:['WhatsApp comercial com código do país','Business WhatsApp with country code','WhatsApp comercial con código de país'],website:['Site ou Instagram (opcional)','Website or Instagram (optional)','Sitio web o Instagram (opcional)'],delivery:['Região atendida / envio','Service area / shipping','Zona de atención / envíos'],description:['Conte um pouco sobre seu trabalho','Tell us about your work','Cuéntanos sobre tu trabajo'],models:['Quais peças você imprime?','Which models do you print?','¿Qué piezas imprimes?'],consent:['Autorizo a publicação do nome, logo, cidade, contato comercial e informações do meu trabalho na rede. Meu e-mail fica privado.','I consent to publishing my name, logo, city, business contact and work information in the network. My email stays private.','Autorizo la publicación de mi nombre, logo, ciudad, contacto comercial e información de mi trabajo. Mi correo permanece privado.'],partnership:['Quero receber contatos do Tio Lira sobre futuras parcerias (opcional).','I would like Tio Lira to contact me about future partnerships (optional).','Quiero que Tio Lira me contacte sobre futuras colaboraciones (opcional).'],submit:['Enviar cadastro gratuito','Submit free application','Enviar registro gratuito'],sent:['Cadastro enviado com sucesso!','Registration submitted successfully!','¡Registro enviado con éxito!'],previewForm:['Prévia: o cadastro será ativado quando o banco de dados for conectado. Nenhum dado deste formulário é enviado ou armazenado agora.','Preview: registration will open when the database is connected. No information from this form is sent or stored now.','Vista previa: el registro se activará al conectar la base de datos. No se envían ni guardan datos de este formulario ahora.'],
 exclusiveTitle:['Muita coisa boa ainda vai ganhar forma.','Wonderful things are taking shape.','Muchas cosas bonitas están tomando forma.'],exclusiveNote:['O presépio continua gratuito. As futuras coleções exclusivas terão suas próprias condições, apresentadas antes da abertura das assinaturas.','The nativity stays free. Future exclusive collections will have their own terms, announced before subscriptions open.','El belén sigue siendo gratuito. Las futuras colecciones exclusivas tendrán sus propias condiciones, anunciadas antes de abrir las suscripciones.'],clubFeatures:[['Coleções autorais selecionadas','Licença para vender peças físicas','Arquivos digitais sem direito de revenda','Novidades para acompanhar de perto'],['Selected original collections','License to sell physical prints','No resale rights for digital files','New releases to look forward to'],['Colecciones originales seleccionadas','Licencia para vender piezas físicas','Sin reventa de archivos digitales','Novedades para seguir de cerca']],updates:['Acompanhar novidades','Follow the updates','Seguir las novedades'],
 aboutEyebrow:['PRAZER, EU SOU O TIO LIRA.','HELLO, I’M TIO LIRA.','HOLA, SOY TIO LIRA.'],aboutTitle:['A tecnologia é 3D. A inspiração é a vida.','The technology is 3D. The inspiration is life.','La tecnología es 3D. La inspiración es la vida.'],instagram:['Bastidores no Instagram','Behind the scenes on Instagram','Entre bastidores en Instagram'],
 faqTitle:['Boas perguntas. Respostas simples.','Good questions. Simple answers.','Buenas preguntas. Respuestas sencillas.'],faq:[[
['O presépio é mesmo gratuito?','Sim! É um presente de carinho e atenção a todos. Você pode baixar as peças já lançadas e acompanhar as próximas. Não é necessário assinar o clube.'],['Posso imprimir o presépio para vender?','Sim. Tio Lira autoriza a venda das peças físicas do presépio, sem assinatura. A revenda ou redistribuição dos arquivos digitais não é permitida.'],['Preciso ter uma loja para me cadastrar?','Não. Pessoas que imprimem em casa e lojas podem se cadastrar gratuitamente. Você informa sua cidade e seu contato comercial para receber pedidos.'],['Por que alguns arquivos estão no MakerWorld?','Alguns modelos são exclusivos dessa plataforma. O site leva você à página oficial, onde estão o arquivo e as instruções.'],['As assinaturas já estão abertas?','Ainda não. Várias coleções exclusivas estão chegando. Catálogo, preços e regras serão anunciados antes da abertura.']],
[['Is the nativity really free?','Yes! It is a gift of care and affection for everyone. Download the released models and follow the next ones. No subscription is required.'],['Can I print the nativity to sell?','Yes. Tio Lira allows the sale of physical nativity prints without a subscription. Reselling or redistributing digital files is not allowed.'],['Do I need a shop to join?','No. Home makers and shops can register for free. Provide your city and business contact to receive inquiries.'],['Why are some files on MakerWorld?','Some models are exclusive to that platform. This site links to the official model page with files and instructions.'],['Are subscriptions open?','Not yet. Several exclusive collections are coming. The catalog, prices and terms will be announced before opening.']],
[['¿El belén es realmente gratuito?','¡Sí! Es un regalo de cariño para todos. Descarga las piezas publicadas y sigue las próximas. No requiere suscripción.'],['¿Puedo imprimir el belén para vender?','Sí. Tio Lira autoriza la venta de piezas físicas del belén sin suscripción. No se permite revender ni redistribuir los archivos digitales.'],['¿Necesito una tienda para registrarme?','No. Personas que imprimen en casa y tiendas pueden registrarse gratis. Indica tu ciudad y contacto comercial para recibir pedidos.'],['¿Por qué hay archivos en MakerWorld?','Algunos modelos son exclusivos de esa plataforma. Este sitio enlaza a la página oficial con archivos e instrucciones.'],['¿Ya están abiertas las suscripciones?','Todavía no. Están llegando varias colecciones exclusivas. Anunciaremos catálogo, precios y condiciones antes de abrir.']]],
 calculator:['Calculadora de impressão','Print cost calculator','Calculadora de impresión'],footer:['Feito de fé, afeto e criatividade brasileira.','Made of faith, love and Brazilian creativity.','Hecho de fe, cariño y creatividad brasileña.'],rights:['Criações autorais.','Original creations.','Creaciones originales.'],admin:['Administração','Administration','Administración'],close:['Fechar','Close','Cerrar'],loading:['Carregando...','Loading...','Cargando...'],error:['Não foi possível enviar. Tente novamente.','Could not send. Please try again.','No se pudo enviar. Inténtalo de nuevo.']
};
rows.physicalLicense=['O presépio é gratuito, inclusive para imprimir e vender as peças físicas. O cadastro no Clube é gratuito e necessário para baixar arquivos hospedados no site; os links do MakerWorld continuam diretos. Os arquivos digitais não podem ser revendidos ou redistribuídos.','The nativity is free, including permission to print and sell physical pieces. Club registration is free and required to download files hosted on this site; MakerWorld links remain direct. Digital files must not be resold or redistributed.','El belén es gratuito, incluido el permiso para imprimir y vender las piezas físicas. El registro en el Club es gratuito y necesario para descargar archivos alojados en este sitio; los enlaces de MakerWorld siguen siendo directos. No se pueden revender ni redistribuir los archivos digitales.'];
Object.assign(rows,{
 "clubForgot": [
  "Esqueci minha senha",
  "Forgot password",
  "Olvidé mi contraseña"
 ],
 "clubForgotIntro": [
  "Informe o e-mail do seu cadastro para receber um link de alteração de senha.",
  "Enter your account email to receive a password reset link.",
  "Introduce el correo de tu cuenta para recibir un enlace para cambiar la contraseña."
 ],
 "clubSendReset": [
  "Enviar link por e-mail",
  "Email reset link",
  "Enviar enlace por correo"
 ],
 "clubResetSent": [
  "Se houver uma conta com esse e-mail, você receberá um link para alterar a senha. Confira também a caixa de spam.",
  "If an account exists with this email, you will receive a password reset link. Please also check spam.",
  "Si existe una cuenta con este correo, recibirás un enlace para cambiar la contraseña. Revisa también el spam."
 ],
 "clubResetTitle": [
  "Crie uma nova senha",
  "Create a new password",
  "Crea una nueva contraseña"
 ],
 "clubResetIntro": [
  "Escolha uma senha de pelo menos 12 caracteres. O link vale por 30 minutos e só pode ser usado uma vez.",
  "Choose a password of at least 12 characters. The link lasts 30 minutes and can only be used once.",
  "Elige una contraseña de al menos 12 caracteres. El enlace dura 30 minutos y solo se puede usar una vez."
 ],
 "clubConfirmPassword": [
  "Confirme a nova senha",
  "Confirm new password",
  "Confirma la nueva contraseña"
 ],
 "clubPasswordMismatch": [
  "As senhas não conferem.",
  "Passwords do not match.",
  "Las contraseñas no coinciden."
 ],
 "clubSavePassword": [
  "Salvar nova senha",
  "Save new password",
  "Guardar nueva contraseña"
 ],
 "clubResetDone": [
  "Senha alterada. Entre com sua nova senha.",
  "Password updated. Log in with your new password.",
  "Contraseña actualizada. Entra con tu nueva contraseña."
 ],
 "clubCoupons": [
  "Cupons de descontos",
  "Discount coupons",
  "Cupones de descuento"
 ],
 "clubCouponsIntro": [
  "Benefícios em materiais e filamentos para suas próximas impressões.",
  "Savings on materials and filaments for your next prints.",
  "Beneficios en materiales y filamentos para tus próximas impresiones."
 ],
 "clubNoCoupons": [
  "Em breve, cupons de desconto para comprar filamentos. As ofertas disponíveis aparecerão aqui.",
  "Filament discount coupons are coming soon. Available offers will appear here.",
  "Pronto habrá cupones de descuento para comprar filamentos. Las ofertas disponibles aparecerán aquí."
 ],
 "clubCouponStore": [
  "Acessar fornecedor",
  "Visit supplier",
  "Visitar proveedor"
 ],
 "clubCouponExpires": [
  "Válido até",
  "Valid until",
  "Válido hasta"
 ],
 "clubCopy": [
  "Copiar código",
  "Copy code",
  "Copiar código"
 ],
 "clubCopied": [
  "Código copiado.",
  "Code copied.",
  "Código copiado."
 ],
 "clubCopyError": [
  "Selecione o código e copie manualmente.",
  "Select the code and copy it manually.",
  "Selecciona el código y cópialo manualmente."
 ],
 "clubLicenses": [
  "Obter licença para venda",
  "Get a sales license",
  "Obtener licencia de venta"
 ],
 "clubLicensesIntro": [
  "Escolha uma peça para acessar o download e gerar sua licença. O código é exclusivo do seu cadastro para aquela peça e ficará salvo aqui.",
  "Choose a model to download and generate your license. Your code is unique to your account and that model, and stays saved here.",
  "Elige una pieza para descargar y generar tu licencia. El código es exclusivo de tu cuenta y esa pieza, y se guarda aquí."
 ],
 "clubLicenseGenerate": [
  "Gerar minha licença de venda",
  "Generate my sales license",
  "Generar mi licencia de venta"
 ],
 "clubLicenseView": [
  "Ver peça e licença",
  "View model and license",
  "Ver pieza y licencia"
 ],
 "clubLicenseCode": [
  "Seu código de licença",
  "Your license code",
  "Tu código de licencia"
 ],
 "clubLicenseIssued": [
  "Licença emitida em",
  "License issued on",
  "Licencia emitida el"
 ],
 "clubLicensePartner": [
  "Parceiro",
  "Partner",
  "Socio"
 ],
 "clubLicenseTerms": [
  "A licença permite vender as peças físicas desta obra. É pessoal e intransferível e não autoriza revender ou compartilhar os arquivos digitais.",
  "The license allows sales of physical prints of this model. It is personal and non-transferable and does not allow reselling or sharing digital files.",
  "La licencia permite vender las piezas físicas de esta obra. Es personal e intransferible y no autoriza revender ni compartir archivos digitales."
 ],
 "clubNoLicenses": [
  "Ainda não há peças disponíveis para gerar licença.",
  "No models are available for licensing yet.",
  "Todavía no hay piezas disponibles para generar una licencia."
 ],
 "clubMyLicenses": [
  "Minhas licenças emitidas",
  "My issued licenses",
  "Mis licencias emitidas"
 ],
 "clubReferrals": [
  "Receba indicações de compradores",
  "Receive buyer referrals",
  "Recibe recomendaciones de compradores"
 ],
 "clubReferralsIntro": [
  "Para aparecer nas buscas por cidade, envie também seu cadastro à rede de parceiros. As informações passam por revisão antes da publicação.",
  "To appear in city searches, also apply to the partner network. Details are reviewed before publication.",
  "Para aparecer en búsquedas por ciudad, envía también tu registro a la red de socios. Los datos se revisan antes de publicarlos."
 ],
 "clubJoinNetwork": [
  "Participar da rede de parceiros",
  "Join the partner network",
  "Participar en la red de socios"
 ]
});
export const dictionaries=Object.fromEntries(languages.map((lang,i)=>[lang,Object.fromEntries(Object.entries(rows).map(([key,value])=>[key,value[i]]))]));
