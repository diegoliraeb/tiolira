// Editorial translations for recently published models. Saved admin translations
// take precedence in i18n.js. These entries contain display text only.
import teams from '../data/gameday-teams.json' with {type:'json'};

export const catalogTranslations={};
export const catalogNameTranslations={
 '6172a405-5f85-43ba-a543-feddc42fe79d':{en:'Holy Family Sculpture — The Garden of Nazareth',es:'Escultura de la Sagrada Familia — El Jardín de Nazaret',fr:'Sculpture de la Sainte Famille — Le Jardin de Nazareth'},
 '595262a3-7013-4579-8483-0a1d51a9e811':{en:'Holy Family Sculpture — A Child Shall Lead Them',es:'Escultura de la Sagrada Familia — Un Niño los Guiará',fr:'Sculpture de la Sainte Famille — Un Enfant les Guidera'},
 'ebadc230-ef99-4001-a8f8-20deecb23f94':{en:'Holy Family Sculpture — The Reunion Embrace',es:'Escultura de la Sagrada Familia — El Abrazo del Reencuentro',fr:'Sculpture de la Sainte Famille — L’Étreinte des Retrouvailles'}
};
// Repair only exact untranslated paragraphs in older saved French descriptions.
// Any later editorial change is left intact.
const frenchParagraphs={
 '6172a405-5f85-43ba-a543-feddc42fe79d':[
  'Uma flor compartilhada entre Maria e Jesus, sob o olhar atento de José: um encontro de carinho e simplicidade no jardim de Nazaré.',
  'Une fleur partagée entre Marie et Jésus, sous le regard attentif de Joseph : un moment de tendresse et de simplicité dans le jardin de Nazareth.'
 ],
 '595262a3-7013-4579-8483-0a1d51a9e811':[
  'Inspirada em Isaías 11,6, Um Menino os Guiará apresenta Jesus entre um bezerro e um leão em paz, acompanhado de Maria e José. A composição simboliza a paz messiânica anunciada pelo profeta; não representa um episódio histórico da Sagrada Família.',
  'Inspirée d’Isaïe 11,6, Un Enfant les Guidera présente Jésus entre un veau et un lion en paix, accompagné de Marie et Joseph. La composition symbolise la paix messianique annoncée par le prophète ; elle ne représente pas un épisode historique de la Sainte Famille.'
 ],
 'ebadc230-ef99-4001-a8f8-20deecb23f94':[
  'Maria e José acolhem Jesus em um abraço que transforma o reencontro em uma imagem de união e ternura.',
  'Marie et Joseph accueillent Jésus dans une étreinte qui transforme les retrouvailles en une image d’union et de tendresse.'
 ]
};
export function repairCatalogParagraphs(id,lang,value){
 const pair=lang==='fr'&&frenchParagraphs[id];
 return pair&&typeof value==='string'?value.split('\n\n').map(p=>p===pair[0]?pair[1]:p).join('\n\n'):value;
}
const langs=['en','es','fr'];
function add(id,names,descriptions,sizes,summaries){
 catalogTranslations[id]=Object.fromEntries(langs.map((lang,i)=>[lang,{
  name:names[i],description:descriptions[i],summary:summaries?.[i]||descriptions[i].split('\n\n')[0],
  ...(sizes?{size:sizes[i]}:{})
 }]));
}
const familyName=(titles)=>titles.map((title,i)=>`${['Holy Family Sculpture','Escultura de la Sagrada Familia','Sculpture de la Sainte Famille'][i]} — ${title}`);
const height16=['16 cm tall','16 cm de altura','16 cm de hauteur'];
const digitalEnd=[
 'Digital download; no physical sculpture is included. Illustrative mockup showing an ivory finish.',
 'Producto digital para descargar; no incluye una escultura física. Imagen ilustrativa del acabado en marfil.',
 'Téléchargement numérique ; aucune sculpture physique incluse. Mise en scène illustrative d’une finition ivoire.'
];

// Four conceptual sculptures share the same verified preparation instructions.
const conceptual=[
 ['41c4987f-e629-4e0c-9ee8-0897c057cb31',['The Space That Unites','El Vacío que Une','Le Vide qui Unit'],[
  'A conceptual interpretation of the Holy Family: the forms of Mary and Joseph outline the presence of Baby Jesus in the empty space between them.',
  'Una interpretación conceptual de la Sagrada Familia: las formas de María y José dibujan la presencia del Niño Jesús en el espacio vacío entre ambos.',
  'Une interprétation conceptuelle de la Sainte Famille : les formes de Marie et Joseph dessinent la présence de l’Enfant Jésus dans l’espace vide qui les sépare.'
 ],'8 h 11 min','144.4'],
 ['0d2b40f5-b36f-4b22-9d63-63d9b119aae0',['Seed of Nazareth','Semilla de Nazaret','Graine de Nazareth'],[
  'Gentle curves surround Baby Jesus like a seed sheltered by the love of Mary and Joseph.',
  'Curvas suaves envuelven al Niño Jesús como una semilla protegida por el amor de María y José.',
  'Des courbes douces enveloppent l’Enfant Jésus comme une graine protégée par l’amour de Marie et Joseph.'
 ],'10 h 13 min','170.8'],
 ['47cfa37c-791f-4d9a-9c59-71cdc1db8ae3',['Three in One','Tres en Uno','Trois en Un'],[
  'Three figures meet in continuous lines, forming a delicate composition about the unity of the Holy Family.',
  'Tres figuras se encuentran en líneas continuas y forman una delicada composición sobre la unión de la Sagrada Familia.',
  'Trois figures se rejoignent en lignes continues, formant une composition délicate sur l’unité de la Sainte Famille.'
 ],'8 h 24 min','151.8'],
 ['c098edfe-8c1f-4c15-91cf-6b1c094e7582',['The Boat of Hope','La Barca de la Esperanza','La Barque de l’Espérance'],[
  'The Holy Family sheltered in a boat on gentle waves: a symbolic composition of protection, faith and hope.',
  'La Sagrada Familia acogida en una barca sobre olas suaves: una composición simbólica de protección, fe y esperanza.',
  'La Sainte Famille accueillie dans une barque sur de douces vagues : une composition symbolisant la protection, la foi et l’espérance.'
 ],'12 h 37 min','233.7']
];
for(const [id,names,intros,time,grams] of conceptual)add(id,familyName(names),[
 `${intros[0]}\n\nDigital 3MF file for 3D printing. Reference height: 16 cm. You can scale the model up or down in your slicer; after changing the scale, slice again and check the supports.\n\nProfile: Bambu Lab A1 mini, 0.4 mm nozzle, 0.16 mm layers and regular or Matte PLA. Suggested color: ivory.\nEstimated print time: ${time}.\nEstimated filament use: ${grams} g of PLA, including supports.\n\nSupports have been revised and configured on the build plate only. Check the slicer preview before printing. Remove supports carefully to preserve the details.\n\nTime and material use are slicer estimates and vary with the printer, filament and settings. ${digitalEnd[0]}`,
 `${intros[1]}\n\nArchivo digital 3MF para impresión 3D. Altura de referencia: 16 cm. Puedes ampliar o reducir el modelo en el laminador; al cambiar la escala, vuelve a laminar y revisa los soportes.\n\nPerfil: Bambu Lab A1 mini, boquilla de 0,4 mm, capas de 0,16 mm y PLA normal o Matte. Color sugerido: marfil.\nTiempo estimado de impresión: ${time}.\nConsumo estimado: ${grams.replace('.',',')} g de PLA, incluidos los soportes.\n\nSoportes revisados y configurados solo en la placa. Comprueba la vista previa del laminador antes de imprimir. Retíralos con cuidado para conservar los detalles.\n\nEl tiempo y el consumo son estimaciones del laminador y varían según la impresora, el filamento y los ajustes. ${digitalEnd[1]}`,
 `${intros[2]}\n\nFichier numérique 3MF pour impression 3D. Hauteur de référence : 16 cm. Vous pouvez agrandir ou réduire le modèle dans le logiciel de tranchage ; après tout changement d’échelle, relancez le tranchage et vérifiez les supports.\n\nProfil : Bambu Lab A1 mini, buse de 0,4 mm, couches de 0,16 mm et PLA classique ou Matte. Couleur suggérée : ivoire.\nTemps d’impression estimé : ${time}.\nConsommation estimée : ${grams.replace('.',',')} g de PLA, supports compris.\n\nSupports révisés et configurés uniquement sur le plateau. Vérifiez l’aperçu du tranchage avant l’impression. Retirez-les délicatement pour préserver les détails.\n\nLe temps et la consommation sont des estimations du logiciel de tranchage et varient selon l’imprimante, le filament et les réglages. ${digitalEnd[2]}`
],height16);

// Biblical compositions with two profiles. All quantities come from the catalog.
const dual=[
 ['0bac6b22-3eca-4ce9-b306-4bc28009069c',['The Home of the Promise','El Hogar de la Promesa','Le Foyer de la Promesse'],[
  'Inspired by Matthew 2:19–23, The Home of the Promise interprets the Holy Family’s return and the building of a new home in Nazareth. The open doorway and the closeness of Mary, Joseph and Jesus evoke welcome, trust and a new beginning.',
  'Inspirada en Mateo 2,19–23, El Hogar de la Promesa interpreta el regreso de la Sagrada Familia y la construcción de un nuevo hogar en Nazaret. La puerta abierta y la cercanía entre María, José y Jesús evocan acogida, confianza y un nuevo comienzo.',
  'Inspiré de Matthieu 2,19–23, Le Foyer de la Promesse interprète le retour de la Sainte Famille et la création d’un nouveau foyer à Nazareth. La porte ouverte et la proximité de Marie, Joseph et Jésus évoquent l’accueil, la confiance et un nouveau départ.'
 ],'15 h 41 min 4 s','201.41','12 h 54 min 49 s','200.81','2 h 46 min','17.67'],
 ['013b9669-9d2c-4769-96ee-60f243959d10',['The Offering of the Humble','La Ofrenda de los Humildes','L’Offrande des Humbles'],[
  'Inspired by Luke 2:22–24, The Offering of the Humble celebrates faith expressed through simple gestures. Mary holds Jesus while Joseph presents an offering of two birds, in a delicate composition of humility and devotion.',
  'Inspirada en Lucas 2,22–24, La Ofrenda de los Humildes celebra la fe expresada en gestos sencillos. María acoge a Jesús mientras José presenta la ofrenda de dos aves, en una delicada composición de humildad y devoción.',
  'Inspirée de Luc 2,22–24, L’Offrande des Humbles célèbre la foi exprimée par des gestes simples. Marie accueille Jésus tandis que Joseph présente l’offrande de deux oiseaux, dans une composition délicate d’humilité et de dévotion.'
 ],'12 h 9 min 6 s','155.90','9 h 57 min 37 s','153.14','2 h 11 min','18.03'],
 ['0c52770b-5195-4815-a6aa-30fa323761fe',['Roots of the Promise','Raíces de la Promesa','Racines de la Promesse'],[
  'Inspired by Isaiah 11:1, Roots of the Promise brings the Holy Family together beside a tree trunk and a new shoot symbolizing hope and renewal. This is a symbolic composition about the messianic promise, not a depiction of a historical episode from Jesus’s childhood.',
  'Inspirada en Isaías 11,1, Raíces de la Promesa reúne a la Sagrada Familia junto al tronco y al nuevo brote que simbolizan esperanza y renovación. Es una composición simbólica de la promesa mesiánica, no la representación de un episodio histórico de la infancia de Jesús.',
  'Inspirée d’Isaïe 11,1, Racines de la Promesse réunit la Sainte Famille près d’un tronc et d’une jeune pousse symbolisant l’espoir et le renouveau. Il s’agit d’une composition symbolique de la promesse messianique, et non d’un épisode historique de l’enfance de Jésus.'
 ],'18 h 26 min 35 s','240.26','15 h 30 min 14 s','243.17','2 h 56 min','15.94'],
 ['44e84a55-6e16-49cf-b260-09af5f7280f9',['Anna’s Joy','La Alegría de Ana','La Joie d’Anne'],[
  'Inspired by Luke 2:36–38, Anna’s Joy interprets the prophetess’s encounter with Jesus in the temple. Mary presents the Child, Joseph stands beside her, and Anna expresses the joy of a hope awaited throughout her life.',
  'Inspirada en Lucas 2,36–38, La Alegría de Ana interpreta el encuentro de la profetisa con Jesús en el templo. María presenta al Niño, José la acompaña y Ana expresa la alegría de una esperanza aguardada durante toda la vida.',
  'Inspirée de Luc 2,36–38, La Joie d’Anne interprète la rencontre de la prophétesse avec Jésus au temple. Marie présente l’Enfant, Joseph l’accompagne et Anne exprime la joie d’une espérance attendue toute sa vie.'
 ],'15 h 5 min 54 s','195.44','12 h 7 min 45 s','190.31','2 h 58 min','19.67'],
 ['494d6019-550e-4a8b-8450-3ecebd4b0316',['The King’s Treasures','Los Tesoros del Rey','Les Trésors du Roi'],[
  'Inspired by Matthew 2:11, The King’s Treasures brings together the Holy Family and the symbols of the Magi’s gifts: gold, frankincense and myrrh. An artistic interpretation of love, reverence and recognition of Jesus.',
  'Inspirada en Mateo 2,11, Los Tesoros del Rey reúne a la Sagrada Familia y los símbolos de los regalos de los magos: oro, incienso y mirra. Una interpretación artística del amor, la reverencia y el reconocimiento de Jesús.',
  'Inspirés de Matthieu 2,11, Les Trésors du Roi réunissent la Sainte Famille et les symboles des présents des mages : l’or, l’encens et la myrrhe. Une interprétation artistique de l’amour, de la révérence et de la reconnaissance de Jésus.'
 ],'18 h 42 min 0 s','255.31','15 h 31 min 20 s','253.67','3 h 10 min','16.99'],
 ['b2bce627-fa02-4f84-8805-c3ab8d6ecf62',['Pilgrims of Faith','Peregrinos de la Fe','Pèlerins de la Foi'],[
  'Inspired by Luke 2:41–42, Pilgrims of Faith accompanies the Holy Family on the road to Jerusalem. Jesus draws the eye along the steps in a composition celebrating faith shared across generations.',
  'Inspirada en Lucas 2,41–42, Peregrinos de la Fe acompaña a la Sagrada Familia de camino a Jerusalén. Jesús guía la mirada por los escalones en una composición que celebra la fe compartida entre generaciones.',
  'Inspirés de Luc 2,41–42, Pèlerins de la Foi accompagnent la Sainte Famille sur le chemin de Jérusalem. Jésus guide le regard le long des marches, dans une composition célébrant la foi partagée entre les générations.'
 ],'15 h 39 min 19 s','204.58','12 h 43 min 0 s','199.62','2 h 56 min','18.77']
];
for(const [id,names,intros,fineTime,fineGrams,fastTime,fastGrams,saving,percent] of dual)add(id,familyName(names),[
 `${intros[0]}\n\nDigital 3D printing model, 16 cm tall. Includes two updated 3MF profiles for Bambu Lab A1 mini with a 0.4 mm nozzle and configured supports. Suggested material: ivory PLA or PLA Matte.\n\nProfiles and slicer estimates, including supports:\n• Fine finish · 0.16 mm: ${fineTime} and ${fineGrams} g of PLA.\n• Economy · 0.20 mm: ${fastTime} and ${fastGrams} g of PLA.\nThe 0.20 mm version saves ${saving} (approximately ${percent}%).\n\nRevised organic supports, with support on the model where needed and adjusted interfaces to ease removal and reduce marks. Let the model cool and remove the supports carefully.\n\nYou can scale the model up or down within your printer’s build volume, then slice again and review the supports. Select the appropriate profile for a different printer. Time and material use are estimates and vary with scale, filament and settings.\n\n${digitalEnd[0]}`,
 `${intros[1]}\n\nModelo digital para impresión 3D, de 16 cm de altura. Incluye dos perfiles 3MF actualizados para Bambu Lab A1 mini, boquilla de 0,4 mm y soportes configurados. Material sugerido: PLA o PLA Matte de color marfil.\n\nPerfiles y estimaciones del laminador, incluidos los soportes:\n• Acabado fino · 0,16 mm: ${fineTime} y ${fineGrams.replace('.',',')} g de PLA.\n• Económico · 0,20 mm: ${fastTime} y ${fastGrams.replace('.',',')} g de PLA.\nLa versión de 0,20 mm ahorra ${saving} (aproximadamente ${percent.replace('.',',')} %).\n\nSoportes orgánicos revisados, con apoyo sobre el modelo donde sea necesario e interfaces ajustadas para facilitar la retirada y reducir las marcas. Deja enfriar la pieza y retira los soportes con cuidado.\n\nPuedes ampliar o reducir el tamaño en el laminador, respetando el volumen de impresión y repitiendo el laminado y la revisión de los soportes. Para otra impresora, selecciona el perfil correspondiente. El tiempo y el consumo son estimaciones y varían según la escala, el filamento y los ajustes.\n\n${digitalEnd[1]}`,
 `${intros[2]}\n\nModèle numérique pour impression 3D, de 16 cm de hauteur. Comprend deux profils 3MF mis à jour pour Bambu Lab A1 mini, buse de 0,4 mm et supports configurés. Matériau suggéré : PLA ou PLA Matte ivoire.\n\nProfils et estimations du tranchage, supports compris :\n• Finition fine · 0,16 mm : ${fineTime} et ${fineGrams.replace('.',',')} g de PLA.\n• Économique · 0,20 mm : ${fastTime} et ${fastGrams.replace('.',',')} g de PLA.\nLa version de 0,20 mm économise ${saving} (environ ${percent.replace('.',',')} %).\n\nSupports organiques révisés, prenant appui sur le modèle si nécessaire, et interfaces ajustées pour faciliter le retrait et réduire les marques. Laissez refroidir la pièce et retirez les supports délicatement.\n\nVous pouvez agrandir ou réduire le modèle dans le logiciel de tranchage, en respectant le volume d’impression et en renouvelant le tranchage et la vérification des supports. Pour une autre imprimante, sélectionnez le profil correspondant. Le temps et la consommation sont des estimations et varient selon l’échelle, le filament et les réglages.\n\n${digitalEnd[2]}`
],height16);

add('natal-brasileiro',['Brazilian Christmas','Navidad Brasileña','Noël Brésilien'],[
 'Christmas with the accents, flavors and traditions of Brazil. Meet Tio Lira’s Santas and build your collection with digital files prepared for 3D printing. Each model is sold separately.',
 'La Navidad con los acentos, sabores y tradiciones de Brasil. Conoce a los Papás Noel de Tio Lira y crea tu colección con archivos digitales preparados para impresión 3D. Cada modelo se vende por separado.',
 'Noël aux accents, saveurs et traditions du Brésil. Découvrez les Pères Noël de Tio Lira et composez votre collection avec des fichiers numériques préparés pour l’impression 3D. Chaque modèle est vendu séparément.'
]);
add('nfl-santas',['Gameday Santas · NFL Collection','Gameday Santas · Colección NFL','Gameday Santas · Collection NFL'],[
 '32 teams. Your colors. Your Christmas. Discover football Santas for 3D printing, with downloadable 3MF files and a license to sell your physical prints.',
 '32 equipos y una pasión por la Navidad y el fútbol americano. Elige al Papá Noel de tu equipo e imprímelo en 3D. Archivos digitales 3MF con licencia para vender las piezas físicas impresas.',
 '32 équipes, une passion pour Noël et le football américain. Choisissez le Père Noël de votre équipe et imprimez-le en 3D. Fichiers numériques 3MF avec licence de vente des objets physiques imprimés.'
]);
for(const team of teams){const name=`${team.city} ${team.team}`;
 add('gameday-santa-'+team.key,[`${name} Santa`,`Papá Noel ${name}`,`Père Noël ${name}`],[
  `Bring ${name} spirit to your holiday display with this Santa from the Gameday Santas collection by Tio Lira.\n\nIncludes the digital 3MF project for 3D printing. Open it in your slicer and review printer, material and scale settings before printing.\n\nOnce payment is confirmed, download your file and physical-print sales license from your Partner Area. You may sell the physical prints you make. Reselling or sharing the digital files is prohibited.`,
  `Papá Noel con los colores de ${name}, de la colección Gameday Santas de Tio Lira. Un personaje navideño para llevar la pasión por el fútbol americano a la decoración.\n\nRecibes el archivo digital 3MF para impresión 3D. Abre el proyecto en tu laminador y comprueba la configuración de la impresora, el material y la escala antes de imprimir.\n\nTras la confirmación del pago, el archivo y la licencia estarán disponibles en el Área del Socio. La licencia permite vender las piezas físicas impresas. Está prohibido revender o compartir los archivos digitales.`,
  `Un Père Noël aux couleurs de ${name}, de la collection Gameday Santas de Tio Lira. Un personnage de Noël pour faire entrer votre passion du football américain dans votre décoration.\n\nVous recevez le projet numérique 3MF pour impression 3D. Ouvrez-le dans votre logiciel de tranchage et vérifiez les réglages de l’imprimante, du matériau et de l’échelle avant d’imprimer.\n\nAprès confirmation du paiement, le fichier et la licence sont disponibles dans l’Espace Partenaire. La licence autorise la vente des objets physiques imprimés. La revente et le partage des fichiers numériques sont interdits.`
 ],undefined,[
  'Printable football Santa. Digital 3MF file with a commercial license for physical prints.',
  `Papá Noel ${name}. Archivo digital 3MF con licencia para vender las piezas físicas impresas.`,
  `Père Noël ${name}. Fichier numérique 3MF avec licence de vente des objets physiques imprimés.`
 ]);
}

const christmasModels=[
 ['13d77993-8241-46a7-a3f4-bfd86e52c846',['Minas Gerais Santa — Noel das Gerais','Papá Noel de Minas Gerais — Noel das Gerais','Père Noël du Minas Gerais — Noel das Gerais'],[
  'Hot coffee, pão de queijo cheese bread and the Christmas warmth of Minas Gerais.',
  'Café caliente, pão de queijo y una Navidad con la calidez de Minas Gerais.',
  'Un café chaud, du pão de queijo et un Noël chaleureux comme au Minas Gerais.'
 ],[
  'A single straw-colored hat, red shirt and brown apron. The mug and cheese bread are separate parts. The apron has reinforcements and is assembled before the beard.',
  'Sombrero de un solo color pajizo, camisa roja y delantal marrón. La taza y el pan de queso son piezas separadas. El delantal lleva refuerzos y se monta antes de la barba.',
  'Chapeau d’une seule couleur paille, chemise rouge et tablier marron. La tasse et le petit pain au fromage sont des pièces séparées. Le tablier est renforcé et se monte avant la barbe.'
 ],'v03',26,8,'22.0','20 h 17 min',444],
 ['bb63207f-e18d-40db-8ba5-21e3ad296d97',['Surfer Santa — Noel da Onda','Papá Noel Surfista — Noel da Onda','Père Noël Surfeur — Noel da Onda'],[
  'Christmas with your feet in the sand: a red hat, green shorts and a green surfboard with a central gold stripe.',
  'Una Navidad con los pies en la arena: gorro rojo, pantalón corto verde y tabla de surf verde con una franja dorada central.',
  'Un Noël les pieds dans le sable : bonnet rouge, short vert et planche de surf verte avec une bande dorée centrale.'
 ],[
  'The surfboard and center stripe are separate parts, the back of the board is flat, and the beard and mustache are joined. Eyes have centered irises and fit from behind the face.',
  'La tabla y la franja central son piezas separadas; la parte trasera de la tabla es plana y la barba y el bigote están unidos. Los ojos tienen los iris centrados y se montan por detrás del rostro.',
  'La planche et sa bande centrale sont séparées, le dos de la planche est plat, et la barbe et la moustache sont réunies. Les iris sont centrés et les yeux se montent par l’arrière du visage.'
 ],'v08',29,8,'21.8','17 h 19 min',387],
 ['d825d6bf-5e50-4100-a758-d734d11d8ca6',['Sertão Santa — Noel do Sertão','Papá Noel del Sertão — Noel do Sertão','Père Noël du Sertão — Noel do Sertão'],[
  'Christmas meets Brazil’s Sertão, with a vaqueiro’s hat, leather vest and the Tio Lira smile.',
  'La Navidad se encuentra con el Sertão brasileño, con sombrero de vaquero, chaleco de cuero y la sonrisa de Tio Lira.',
  'Noël rencontre le Sertão brésilien, avec un chapeau de vaqueiro, un gilet en cuir et le sourire de Tio Lira.'
 ],[
  'Brown hat and vest, matching gloves and black boots. Revised glove cutouts, removable face and eyes fitted from behind.',
  'Sombrero y chaleco marrones, guantes del mismo color y botas negras. Recortes de los guantes revisados, rostro desmontable y ojos montados por detrás.',
  'Chapeau et gilet marron, gants assortis et bottes noires. Découpes des gants révisées, visage amovible et yeux montés par l’arrière.'
 ],'v12',24,6,'21.8','20 h 49 min',495],
 ['975c7193-f01a-48ff-a802-d447fef57446',['Pampas Santa — Noel dos Pampas','Papá Noel de las Pampas — Noel dos Pampas','Père Noël de la Pampa — Noel dos Pampas'],[
  'With a hat, red neckerchief and chimarrão mate, Pampas Santa brings Brazil’s gaúcho tradition to the collection.',
  'Con sombrero, pañuelo rojo y chimarrão, el Papá Noel de las Pampas lleva la tradición gaúcha a la colección.',
  'Avec son chapeau, son foulard rouge et son chimarrão, le Père Noël de la Pampa apporte la tradition gaúcha à la collection.'
 ],[
  'Eyes fit from behind the face, parts are separated by color, and joints use pins. Eyebrow, mustache and sleeve contours, as well as the join between hair and clothing, have been revised.',
  'Ojos montados por detrás del rostro, piezas separadas por color y uniones con pasadores. Contornos de las cejas, el bigote, las mangas y la unión del cabello con la ropa revisados.',
  'Yeux montés par l’arrière du visage, pièces séparées par couleur et assemblages avec chevilles. Contours des sourcils, de la moustache, des manches et de la jonction entre les cheveux et les vêtements révisés.'
 ],'v03',27,8,'21.9','20 h 51 min',474]
];
for(const [id,names,intros,details,version,parts,plates,height,time,grams] of christmasModels)add(id,names,[
 `${intros[0]}\n\n${details[0]}\n\nVersion ${version}: ${parts} parts, ${plates} build plates and approximately ${height} cm tall. 3MF project for Bambu Lab A1, 0.4 mm nozzle, PLA and 0.20 mm layers. Download includes only the complete 3MF project, with parts, plates and assembly.\n\nEstimated print time: ${time}. Estimated filament use: ${grams} g, including supports. Total for all ${plates} plates in Bambu Studio, using Bambu Lab A1, a 0.4 mm nozzle, PLA and 0.20 mm layers. Values may vary with settings and filament.\n\nDigital 3D printing file; no physical item included. The cover is an illustrative mockup and the gallery also shows the 3D model. Check supports and test the joints before gluing.`,
 `${intros[1]}\n\n${details[1]}\n\nVersión ${version}: ${parts} piezas, ${plates} placas y aproximadamente ${height.replace('.',',')} cm de altura. Proyecto 3MF para Bambu Lab A1, boquilla de 0,4 mm, PLA y capas de 0,20 mm. La descarga incluye únicamente el proyecto 3MF completo, con piezas, placas y montaje.\n\nTiempo estimado de impresión: ${time}. Consumo estimado de filamento: ${grams} g, incluidos los soportes. Total de las ${plates} placas en Bambu Studio con Bambu Lab A1, boquilla de 0,4 mm, PLA y capas de 0,20 mm. Los valores pueden variar según los ajustes y el filamento.\n\nArchivo digital para impresión 3D; no incluye la pieza física. La portada es una imagen ilustrativa y la galería también muestra el modelo 3D. Revisa los soportes y prueba las uniones antes de pegar.`,
 `${intros[2]}\n\n${details[2]}\n\nVersion ${version} : ${parts} pièces, ${plates} plateaux et environ ${height.replace('.',',')} cm de hauteur. Projet 3MF pour Bambu Lab A1, buse de 0,4 mm, PLA et couches de 0,20 mm. Le téléchargement comprend uniquement le projet 3MF complet, avec pièces, plateaux et assemblage.\n\nTemps d’impression estimé : ${time}. Consommation estimée : ${grams} g de filament, supports compris. Total des ${plates} plateaux dans Bambu Studio, avec Bambu Lab A1, buse de 0,4 mm, PLA et couches de 0,20 mm. Les valeurs peuvent varier selon les réglages et le filament.\n\nFichier numérique pour impression 3D ; aucun objet physique inclus. La couverture est une mise en scène illustrative et la galerie montre également le modèle 3D. Vérifiez les supports et testez les assemblages avant collage.`
],[`${height} cm tall`,`${height.replace('.',',')} cm de altura`,`${height.replace('.',',')} cm de hauteur`],intros);

add('57fdbe52-a271-440b-9ce0-d25a25ab67e0',['Agro Santa — Agro Noel','Agro Papá Noel — Agro Noel','Père Noël des Champs — Agro Noel'],[
 'A wide-brimmed hat, red shirt, boots and a sprout on the gold buckle. The small Brazilian flag is an optional part to print with AMS and glue onto the hatband.\n\nThe v04 3MF file contains the parts on nine build plates and the assembled figure. With Bambu Lab A1, a 0.4 mm nozzle, PLA and 0.20 mm layers, the total estimate is 25 h 26 min and 511 g, including the flag.',
 'Sombrero de ala ancha, camisa roja, botas y un brote en la hebilla dorada. La pequeña bandera de Brasil es una pieza opcional para imprimir con AMS y pegar en la cinta del sombrero.\n\nEl archivo 3MF v04 contiene las piezas en nueve placas y el montaje de la figura. En Bambu Lab A1 con boquilla de 0,4 mm, PLA y capas de 0,20 mm, la estimación total es de 25 h 26 min y 511 g, incluida la bandera.',
 'Chapeau à larges bords, chemise rouge, bottes et jeune pousse sur la boucle dorée. Le petit drapeau brésilien est une pièce facultative à imprimer avec l’AMS et à coller sur le ruban du chapeau.\n\nLe fichier 3MF v04 contient les pièces sur neuf plateaux et l’assemblage de la figurine. Sur Bambu Lab A1 avec buse de 0,4 mm, PLA et couches de 0,20 mm, l’estimation totale est de 25 h 26 min et 511 g, drapeau compris.'
],['21.9 cm tall when assembled','21,9 cm de altura montado','21,9 cm de hauteur une fois assemblé'],[
 'A wide-brimmed hat with the Brazilian flag and a raised sprout buckle for Santa from the countryside.',
 'Sombrero de ala ancha con la bandera de Brasil y una hebilla con brote en relieve para el Papá Noel del campo.',
 'Un chapeau à larges bords avec le drapeau brésilien et une boucle à pousse en relief pour le Père Noël des champs.'
]);
add('6f0f046e-3f1b-488e-9dd8-69528e1b6fb1',['Forest Santa — Noel da Floresta','Papá Noel del Bosque — Noel da Floresta','Père Noël de la Forêt — Noel da Floresta'],[
 'Forest Santa is part of Tio Lira’s Brazilian Christmas collection. The headdress combines red feathers, a gold band and one central gold feather. The eyes fit from behind the face.\n\nThe download includes the v05 3MF project with 24 parts separated by color, arranged on 7 build plates, and a view of the assembled figure. Assembled height: 21.9 cm.\n\nBambu Studio estimate for the complete figure: 23 h 11 min and 474 g of PLA on Bambu Lab A1, with a 0.4 mm nozzle and 0.20 mm layers. The cover is an illustrative mockup of the printed figure.',
 'El Papá Noel del Bosque forma parte de la colección Navidad Brasileña de Tio Lira. El tocado combina plumas rojas, un arco dorado y una pluma central dorada. Los ojos encajan por detrás del rostro.\n\nLa descarga incluye el proyecto 3MF v05 con 24 piezas separadas por color, organizadas en 7 placas, y la vista de la figura montada. Altura montada: 21,9 cm.\n\nEstimación de Bambu Studio para la figura completa: 23 h 11 min y 474 g de PLA en Bambu Lab A1, con boquilla de 0,4 mm y capas de 0,20 mm. La portada es una imagen ilustrativa de la pieza impresa.',
 'Le Père Noël de la Forêt fait partie de la collection Noël Brésilien de Tio Lira. La coiffe associe des plumes rouges, un arceau doré et une plume centrale dorée. Les yeux s’emboîtent par l’arrière du visage.\n\nLe téléchargement comprend le projet 3MF v05 avec 24 pièces séparées par couleur, organisées sur 7 plateaux, ainsi qu’une vue de la figurine assemblée. Hauteur assemblée : 21,9 cm.\n\nEstimation de Bambu Studio pour la figurine complète : 23 h 11 min et 474 g de PLA sur Bambu Lab A1, avec buse de 0,4 mm et couches de 0,20 mm. La couverture est une mise en scène illustrative de la pièce imprimée.'
],['21.9 cm tall','21,9 cm de altura','21,9 cm de hauteur'],[
 'Santa with a red feather headdress and a central gold feather, a Christmas coat and green trousers, to assemble part by part.',
 'Papá Noel con tocado de plumas rojas y una pluma central dorada, abrigo navideño y pantalones verdes, para montar pieza a pieza.',
 'Un Père Noël à coiffe rouge et plume centrale dorée, manteau de Noël et pantalon vert, à assembler pièce par pièce.'
]);

add('96f7f843-b608-4a57-8f27-6ba12e2862da',['Ayrton Senna with Trophy','Ayrton Senna con Trofeo','Ayrton Senna avec Trophée'],[
 'A tribute to Ayrton Senna and the joy of his victories. With his trophy raised, red racing suit and blue cap, this sculpture brings a symbol of courage, dedication and Brazilian pride to the collection.\n\nThe model measures 20 cm up to the cap, with the trophy extending above that height. Prepared in multiple parts for PLA printing and assembly with fitted joints, with flat logos for multicolor AMS printing.\n\nFree download on MakerWorld. Exclusively for personal use and private collections. Selling physical prints or the digital files is not permitted.\n\nThe cover is an illustrative mockup; the gallery also includes photographs of the printed model.',
 'Un homenaje a Ayrton Senna y a la alegría de sus victorias. Con el trofeo en alto, el mono rojo y la gorra azul, esta escultura aporta a la colección un símbolo de valentía, dedicación y orgullo brasileño.\n\nModelo de 20 cm hasta la gorra, con el trofeo por encima de esa altura. Preparado en varias piezas para imprimir en PLA y montar mediante encajes, con logotipos planos para impresión multicolor con AMS.\n\nDescarga gratuita en MakerWorld. Destinado exclusivamente al uso personal y a colecciones particulares. No se permite vender las piezas físicas ni comercializar los archivos digitales.\n\nLa portada es una imagen ilustrativa; la galería también incluye fotografías de la pieza impresa.',
 'Un hommage à Ayrton Senna et à la joie de ses victoires. Avec son trophée levé, sa combinaison rouge et sa casquette bleue, cette sculpture apporte à la collection un symbole de courage, de dévouement et de fierté brésilienne.\n\nModèle de 20 cm jusqu’à la casquette, le trophée dépassant cette hauteur. Préparé en plusieurs pièces pour l’impression en PLA et le montage par emboîtement, avec des logos plats pour l’impression multicolore avec l’AMS.\n\nTéléchargement gratuit sur MakerWorld. Réservé exclusivement à l’usage personnel et aux collections privées. La vente des objets physiques imprimés et la commercialisation des fichiers numériques sont interdites.\n\nLa couverture est une mise en scène illustrative ; la galerie comprend également des photographies de la pièce imprimée.'
],['20 cm to the cap; the trophy extends above it.','20 cm hasta la gorra; el trofeo supera esa altura.','20 cm jusqu’à la casquette ; le trophée dépasse cette hauteur.'],[
 'Senna holding his trophy aloft: a 20 cm multipart collectible tribute, free to download on MakerWorld.',
 'Senna con el trofeo en alto: un homenaje coleccionable de 20 cm en varias piezas, con descarga gratuita en MakerWorld.',
 'Senna brandissant son trophée : un hommage de collection de 20 cm en plusieurs pièces, à télécharger gratuitement sur MakerWorld.'
]);

add('67d8ec08-c34e-445b-81ae-4080aff81678',familyName(['Refuge in Egypt','Refugio en Egipto','Refuge en Égypte']),[
 'Mary carries Jesus in her arms while riding the donkey, accompanied by Joseph: a scene of care and protection on the journey to Egypt.\n\nDigital 3MF file, 16 cm tall. The model can be scaled proportionally up or down in your slicer; after changing the scale, slice again and check the supports.\n\nTwo profiles for Bambu Lab A1 mini, a 0.4 mm nozzle and regular or Matte ivory PLA:\n• Fine finish, 0.16 mm: 23 h 48 min 25 s and 248.34 g of filament.\n• Economy, 0.20 mm: 19 h 32 min 25 s and 244.91 g of filament. Saves 4 h 16 min (17.9%) of estimated print time.\n\nRevision dated 30 October 2026: the duplicate tail was removed, leaving a single tail and smoothing its joins with the body and leg. Both profiles were sliced again with revised tail supports. The base remains fully supported on the build plate. Organic supports rest on the model where necessary; interfaces have been adjusted to make separation easier and reduce marks.\n\nAfter cooling, remove supports in small sections, holding the tail close to the contact point and avoiding pulling the entire support structure at once.\n\nTimes and material use include supports and are slicer estimates; they vary with material, calibration, scale and settings. Support removal and surface finish also depend on these conditions.\n\nDigital download; no physical sculpture included. Illustrative ivory mockup.',
 'María lleva a Jesús en brazos sobre el burro, acompañada por José: una escena de cuidado y protección en el camino a Egipto.\n\nArchivo digital 3MF de 16 cm de altura. Puedes ampliar o reducir el tamaño proporcionalmente en el laminador; al cambiar la escala, vuelve a laminar y revisa los soportes.\n\nDos perfiles para Bambu Lab A1 mini, boquilla de 0,4 mm y PLA normal o Matte de color marfil:\n• Acabado fino, 0,16 mm: 23 h 48 min 25 s y 248,34 g de filamento.\n• Económico, 0,20 mm: 19 h 32 min 25 s y 244,91 g de filamento. Ahorro de 4 h 16 min (17,9 %) en el tiempo estimado.\n\nRevisión del 30 de octubre de 2026: se eliminó la cola duplicada, dejando una sola cola y suavizando las uniones con el cuerpo y la pata. Ambos perfiles se volvieron a laminar con soportes de la cola revisados. La base permanece completamente apoyada en la placa. Soportes orgánicos con apoyo sobre la propia pieza donde es necesario; interfaces ajustadas para facilitar la separación y reducir las marcas.\n\nDespués del enfriamiento, retira los soportes en pequeñas secciones, sujetando la cola cerca del punto de contacto y evitando tirar de todo el conjunto a la vez.\n\nLos tiempos y consumos incluyen los soportes y son estimaciones del laminador; varían según el material, la calibración, la escala y los ajustes. La retirada y el acabado dependen también de estas condiciones.\n\nProducto digital para descargar; no incluye una escultura física. Imagen ilustrativa en marfil.',
 'Marie porte Jésus dans ses bras sur l’âne, accompagnée de Joseph : une scène de soin et de protection sur le chemin de l’Égypte.\n\nFichier numérique 3MF de 16 cm de hauteur. Le modèle peut être agrandi ou réduit proportionnellement dans le logiciel de tranchage ; après tout changement d’échelle, relancez le tranchage et vérifiez les supports.\n\nDeux profils pour Bambu Lab A1 mini, buse de 0,4 mm et PLA classique ou Matte ivoire :\n• Finition fine, 0,16 mm : 23 h 48 min 25 s et 248,34 g de filament.\n• Économique, 0,20 mm : 19 h 32 min 25 s et 244,91 g de filament. Économie de 4 h 16 min (17,9 %) sur le temps estimé.\n\nRévision du 30 octobre 2026 : suppression de la queue en double, conservation d’une seule queue et adoucissement des jonctions avec le corps et la patte. Les deux profils ont été retranchés avec des supports de queue révisés. La base reste entièrement posée sur le plateau. Supports organiques prenant appui sur la pièce si nécessaire ; interfaces ajustées pour faciliter la séparation et réduire les marques.\n\nAprès refroidissement, retirez les supports par petites sections, en maintenant la queue près du point de contact et sans tirer sur toute la structure à la fois.\n\nLes temps et consommations incluent les supports et sont des estimations du logiciel ; ils varient selon le matériau, le calibrage, l’échelle et les réglages. Le retrait des supports et la finition dépendent également de ces conditions.\n\nTéléchargement numérique ; aucune sculpture physique incluse. Mise en scène illustrative en ivoire.'
],height16);

add('791d460b-38c9-41df-b199-ebe5e7a47da3',familyName(['The Tenderness of Bethlehem','La Ternura de Belén','La Tendresse de Bethléem']),[
 'Inspired by the birth of Jesus in Luke 2:7, The Tenderness of Bethlehem brings Mary and Joseph together in contemplation before the Child in the manger. A small donkey, an ox and a lamb complete this artistic nativity scene, evoking welcome, peace and simplicity.\n\nDigital 3D printing model, 16 cm tall. Approximate dimensions: 20.58 × 19.46 × 16 cm. You can change the scale in your slicer, respecting the printer’s build plate and regenerating supports and slicing.\n\nPrepared for Bambu Lab A1 with a 0.4 mm nozzle and PLA. The complete composition at 16 cm tall does not fit the A1 Mini. Suggested finish: ivory PLA.\n\nIncludes two 3MF profiles:\n• 0.16 mm — detailed finish: estimated 23 h 00 min and 311.58 g of PLA, including supports.\n• 0.20 mm — faster printing: estimated 19 h 17 min and 314.07 g of PLA, including supports.\nThe 0.20 mm profile saves approximately 3 h 43 min (16.1%).\n\nSupport update dated 20 October 2026: fewer contact points on Joseph’s and Mary’s hands, lighter branches and adjusted interfaces to reduce removal effort, including beneath the manger. Both profiles include supports on the model where needed. The flat base rests on the plate and the geometry is preserved. The economy profile uses 0.20 mm layers and a 0.24 mm first layer.\n\nTo remove supports, cut the branches into small sections before separating the interface. Around the hands, avoid pulling the entire support structure; beneath the manger, work from the front and sides without levering against the columns or straw.\n\nTimes and material use are slicer estimates and may vary with filament and settings. Digital product: no physical model included. Illustrative cover image.',
 'Inspirada en el nacimiento de Jesús narrado en Lucas 2,7, La Ternura de Belén reúne a María y José en contemplación ante el Niño en el pesebre. Un pequeño burro, un buey y un cordero completan esta interpretación artística del belén, evocando acogida, paz y sencillez.\n\nModelo digital para impresión 3D, de 16 cm de altura. Dimensiones aproximadas: 20,58 × 19,46 × 16 cm. Puedes modificar la escala en el laminador, respetando la placa de la impresora y rehaciendo los soportes y el laminado.\n\nPreparado para Bambu Lab A1 con boquilla de 0,4 mm y PLA. La composición completa de 16 cm de altura no cabe en la A1 Mini. Acabado sugerido: PLA marfil.\n\nIncluye dos perfiles 3MF:\n• 0,16 mm — acabado detallado: estimación de 23 h 00 min y 311,58 g de PLA, incluidos los soportes.\n• 0,20 mm — impresión más rápida: estimación de 19 h 17 min y 314,07 g de PLA, incluidos los soportes.\nEl perfil de 0,20 mm ahorra aproximadamente 3 h 43 min (16,1 %).\n\nActualización de soportes del 20 de octubre de 2026: menos puntos de contacto en las manos de José y María, ramas más ligeras e interfaces ajustadas para reducir el esfuerzo de retirada, también bajo el pesebre. Ambos perfiles incluyen apoyos sobre la pieza donde es necesario. Base plana sobre la placa y geometría conservada. El perfil económico utiliza capas de 0,20 mm y una primera capa de 0,24 mm.\n\nPara retirar los soportes, corta las ramas en pequeños tramos antes de separar la interfaz. En las manos, evita tirar de toda la estructura; bajo el pesebre, trabaja desde el frente y los lados, sin hacer palanca sobre las columnas o la paja.\n\nLos tiempos y consumos son estimaciones del laminador y pueden variar según el filamento y los ajustes. Producto digital: no incluye la pieza física. Imagen de portada ilustrativa.',
 'Inspirée de la naissance de Jésus racontée dans Luc 2,7, La Tendresse de Bethléem réunit Marie et Joseph en contemplation devant l’Enfant dans la mangeoire. Un petit âne, un bœuf et un agneau complètent cette interprétation artistique de la crèche, évoquant l’accueil, la paix et la simplicité.\n\nModèle numérique pour impression 3D, de 16 cm de hauteur. Dimensions approximatives : 20,58 × 19,46 × 16 cm. Vous pouvez modifier l’échelle dans le logiciel de tranchage, en respectant le plateau de l’imprimante et en régénérant les supports et le tranchage.\n\nPréparé pour Bambu Lab A1 avec buse de 0,4 mm et PLA. La composition complète de 16 cm de hauteur ne tient pas sur l’A1 Mini. Finition suggérée : PLA ivoire.\n\nComprend deux profils 3MF :\n• 0,16 mm — finition détaillée : estimation de 23 h 00 min et 311,58 g de PLA, supports compris.\n• 0,20 mm — impression plus rapide : estimation de 19 h 17 min et 314,07 g de PLA, supports compris.\nLe profil de 0,20 mm économise environ 3 h 43 min (16,1 %).\n\nMise à jour des supports du 20 octobre 2026 : moins de contacts sur les mains de Joseph et Marie, branches plus légères et interfaces ajustées pour réduire l’effort de retrait, y compris sous la mangeoire. Les deux profils comprennent des appuis sur la pièce si nécessaire. Base plane sur le plateau et géométrie préservée. Le profil économique utilise des couches de 0,20 mm et une première couche de 0,24 mm.\n\nPour retirer les supports, coupez les branches en petites sections avant de séparer l’interface. Autour des mains, évitez de tirer sur toute la structure ; sous la mangeoire, travaillez par l’avant et les côtés sans faire levier sur les colonnes ou la paille.\n\nLes temps et consommations sont des estimations du logiciel de tranchage et peuvent varier selon le filament et les réglages. Produit numérique : aucune pièce physique incluse. Image de couverture illustrative.'
],['20.58 × 19.46 × 16 cm · A1 · adjustable scale','20,58 × 19,46 × 16 cm · A1 · escala ajustable','20,58 × 19,46 × 16 cm · A1 · échelle réglable'],[
 'Mary, Joseph and the Child in the manger, accompanied by small animals. A 16 cm sculpture for A1, with 0.16 and 0.20 mm 3MF profiles and revised supports.',
 'María, José y el Niño en el pesebre, acompañados de pequeños animales. Escultura de 16 cm para A1, con perfiles 3MF de 0,16 y 0,20 mm y soportes revisados.',
 'Marie, Joseph et l’Enfant dans la mangeoire, accompagnés de petits animaux. Sculpture de 16 cm pour A1, avec profils 3MF de 0,16 et 0,20 mm et supports révisés.'
]);

add('51b183a3-b2e9-4103-b7f9-a44dc13ed7e0',familyName(['The First Cradle','La Primera Cuna','Le Premier Berceau']),[
 'Inspired by Luke 2:7, The First Cradle depicts Mary settling Baby Jesus in the manger under Joseph’s peaceful gaze. A composition celebrating the welcome, simplicity and tenderness of the birth.\n\nDigital 3D printing model, 16 cm tall. You can change the scale in your slicer, respecting your printer’s build volume and regenerating supports and slicing.\n\nIncludes two 3MF profiles for Bambu Lab A1 Mini with a 0.4 mm nozzle and PLA. Suggested finish: ivory PLA.\n• 0.16 mm — detailed finish: estimated 18 h 03 min and 254.20 g of PLA, including supports.\n• 0.20 mm — faster printing: estimated 15 h 04 min and 254.33 g of PLA, including supports.\nThe 0.20 mm profile saves approximately 2 h 59 min (16.5%).\n\nBoth profiles were sliced again with revised tree supports, including supports on the model where needed. Interfaces have been adjusted to ease removal and reduce marks. The flat base rests on the build plate. Keep the orientation saved in the file to fit the A1 Mini.\n\nTimes and material use are slicer estimates and may vary with filament and settings. Digital product: no physical model included. Illustrative cover image.',
 'Inspirada en Lucas 2,7, La Primera Cuna representa a María acomodando al Niño Jesús en el pesebre bajo la mirada serena de José. Una composición que celebra la acogida, la sencillez y la ternura del nacimiento.\n\nModelo digital para impresión 3D, de 16 cm de altura. Puedes modificar la escala en el laminador, respetando el espacio de tu impresora y rehaciendo los soportes y el laminado.\n\nIncluye dos perfiles 3MF para Bambu Lab A1 Mini con boquilla de 0,4 mm y PLA. Acabado sugerido: PLA marfil.\n• 0,16 mm — acabado detallado: estimación de 18 h 03 min y 254,20 g de PLA, incluidos los soportes.\n• 0,20 mm — impresión más rápida: estimación de 15 h 04 min y 254,33 g de PLA, incluidos los soportes.\nEl perfil de 0,20 mm ahorra aproximadamente 2 h 59 min (16,5 %).\n\nAmbos perfiles se volvieron a laminar con soportes de árbol revisados, incluidos apoyos sobre la pieza donde es necesario. Interfaces ajustadas para facilitar la retirada y reducir las marcas. Base plana sobre la placa. Mantén la orientación guardada en el archivo para que quepa en la A1 Mini.\n\nLos tiempos y consumos son estimaciones del laminador y pueden variar según el filamento y los ajustes. Producto digital: no incluye la pieza física. Imagen de portada ilustrativa.',
 'Inspiré de Luc 2,7, Le Premier Berceau représente Marie installant l’Enfant Jésus dans la mangeoire sous le regard serein de Joseph. Une composition qui célèbre l’accueil, la simplicité et la tendresse de la naissance.\n\nModèle numérique pour impression 3D, de 16 cm de hauteur. Vous pouvez modifier l’échelle dans le logiciel de tranchage, en respectant le volume de votre imprimante et en régénérant les supports et le tranchage.\n\nComprend deux profils 3MF pour Bambu Lab A1 Mini avec buse de 0,4 mm et PLA. Finition suggérée : PLA ivoire.\n• 0,16 mm — finition détaillée : estimation de 18 h 03 min et 254,20 g de PLA, supports compris.\n• 0,20 mm — impression plus rapide : estimation de 15 h 04 min et 254,33 g de PLA, supports compris.\nLe profil de 0,20 mm économise environ 2 h 59 min (16,5 %).\n\nLes deux profils ont été retranchés avec des supports arborescents révisés, y compris des appuis sur la pièce si nécessaire. Interfaces ajustées pour faciliter le retrait et réduire les marques. Base plane sur le plateau. Conservez l’orientation enregistrée dans le fichier pour que le modèle tienne sur l’A1 Mini.\n\nLes temps et consommations sont des estimations du logiciel de tranchage et peuvent varier selon le filament et les réglages. Produit numérique : aucune pièce physique incluse. Image de couverture illustrative.'
],['16 cm tall · adjustable scale','16 cm de altura · escala ajustable','16 cm de hauteur · échelle réglable']);

// The lettering on these models stays in Portuguese. Translate its meaning,
// without suggesting that the downloadable geometry has translated lettering.
const sennaLicenses={
 en:'FOR PERSONAL COLLECTIONS ONLY. You may print this model only for your own non-commercial use. Selling the printed model, including made-to-order prints, is prohibited. Selling, sharing or redistributing the digital files is not permitted. This model does not include a commercial license.',
 es:'SOLO PARA COLECCIONES PERSONALES. Puedes imprimir esta obra únicamente para uso propio y sin fines comerciales. Está prohibido vender la pieza impresa, incluso por encargo. No se permite vender, compartir ni redistribuir los archivos digitales. Este modelo no incluye licencia comercial.',
 fr:'RÉSERVÉ AUX COLLECTIONS PERSONNELLES. Vous pouvez imprimer cette œuvre uniquement pour votre usage personnel, sans but commercial. La vente de la pièce imprimée, y compris sur commande, est interdite. La vente, le partage et la redistribution des fichiers numériques ne sont pas autorisés. Ce modèle ne comprend pas de licence commerciale.'
};
for(const lang of langs)catalogTranslations['96f7f843-b608-4a57-8f27-6ba12e2862da'][lang].license=sennaLicenses[lang];
const plaques=[
 ['819cafa5-cf02-4f1b-97a3-2d7307d0b43f','Não troco o meu oxente','Não troco o meu “oxente” pelo “ok” de ninguém!',[
  'A plaque full of Northeastern Brazilian character and local expression.',
  'Una placa llena de personalidad y expresiones del Nordeste brasileño.',
  'Une plaque pleine de personnalité et d’expressions du Nordeste brésilien.'
 ],[
  'I wouldn’t trade my “oxente” for anyone’s “OK”! “Oxente” is a characteristic exclamation from Northeastern Brazil.',
  '¡No cambio mi «oxente» por el «OK» de nadie! «Oxente» es una exclamación característica del Nordeste brasileño.',
  'Je n’échangerais mon « oxente » contre le « OK » de personne ! « Oxente » est une exclamation typique du Nordeste brésilien.'
 ],'13.5'],
 ['c91600a4-3eda-4780-b4eb-ee5d0dd43915','Se avexe não!','Se avexe não!',[
  'A reminder from Northeastern Brazil to slow down.',
  'Un recordatorio del Nordeste brasileño para tomarse la vida con calma.',
  'Un rappel du Nordeste brésilien pour ralentir le rythme.'
 ],['Don’t rush or worry!','¡No te apures ni te preocupes!','Ne vous pressez pas, ne vous inquiétez pas !'],'13.3'],
 ['0b6ca96a-bf82-4c93-bbbd-b2c1b416406c','A vida é igual a rapadura','A vida é igual a rapadura, é doce, mas não é mole não.',[
  'Northeastern Brazilian humor in a phrase for decorating or giving as a gift.',
  'El buen humor del Nordeste brasileño en una frase para decorar o regalar.',
  'L’humour du Nordeste brésilien dans une phrase à offrir ou à utiliser en décoration.'
 ],[
  'Life is like rapadura: sweet, but not soft! The saying plays on the hardness of this traditional cane-sugar sweet and the challenges of life.',
  'La vida es como la rapadura: dulce, ¡pero no es blanda! El dicho juega con la dureza de este dulce de caña de azúcar y las dificultades de la vida.',
  'La vie est comme la rapadura : douce, mais pas tendre ! Le dicton joue sur la dureté de cette confiserie de sucre de canne et sur les difficultés de la vie.'
 ],'14.8'],
 ['32edf357-0024-43ba-8d75-8b634d7f96a0','Terra quente, povo acolhedor','Terra quente, povo acolhedor.',[
  'A tribute to the land and hospitality of Northeastern Brazil’s people.',
  'Un homenaje a la tierra y a la hospitalidad de la gente del Nordeste brasileño.',
  'Un hommage à la terre et à l’hospitalité des habitants du Nordeste brésilien.'
 ],['A warm land, a welcoming people.','Tierra cálida, gente acogedora.','Une terre chaude, un peuple accueillant.'],'13.5'],
 ['3cc89127-2c29-4bb3-bf3d-992da906da8f','Sou Cabloco do Sertão','Sou Cabloco do Sertão, só tenho amor no coração, pra oferecer, a natureza é minha casa, vida viver, tudo pra eu e ocê!',[
  'A plaque with verses, cacti and a cangaceiro hat celebrating the Sertão.',
  'Una placa con versos, cactus y un sombrero de cangaceiro para celebrar el Sertão.',
  'Une plaque avec des vers, des cactus et un chapeau de cangaceiro pour célébrer le Sertão.'
 ],[
  'I am a countryman of the Sertão, with only love in my heart to offer. Nature is my home, a life to live, everything for you and me.',
  'Soy un hombre del Sertão; solo tengo amor en el corazón para ofrecer. La naturaleza es mi casa, una vida que vivir, todo para ti y para mí.',
  'Je suis un homme du Sertão, avec seulement de l’amour au cœur à offrir. La nature est ma maison, une vie à vivre, tout pour toi et moi.'
 ],'19.9'],
 ['6b3dc889-4f96-48f0-9c23-78805ff47e04','Quem esquece de onde veio','Quem esquece de onde veio não sabe para onde vai!',[
  'A plaque to celebrate your origins and keep your roots close.',
  'Una placa para celebrar los orígenes y llevar siempre cerca las raíces.',
  'Une plaque pour célébrer ses origines et garder ses racines près de soi.'
 ],['Those who forget where they came from don’t know where they’re going!','¡Quien olvida de dónde viene no sabe adónde va!','Qui oublie d’où il vient ne sait pas où il va !'],'13.5'],
 ['742821f2-057c-4ebc-93fd-eac165c1c8f8','Aqui o calor é do coração','Aqui o calor é do clima e do coração.',[
  'A tribute to Northeastern Brazilian warmth and hospitality, with hearts and cacti.',
  'Un homenaje al cariño y a la acogida del Nordeste brasileño, con corazones y cactus.',
  'Un hommage à la chaleur et à l’accueil du Nordeste brésilien, avec des cœurs et des cactus.'
 ],['Here, the warmth comes from both the climate and the heart.','Aquí, el calor viene tanto del clima como del corazón.','Ici, la chaleur vient du climat et du cœur.'],'13.5'],
 ['80228a90-2ea6-4a32-ad76-bf691a9ef54d','Amanhã pode acontecer tudo','Amanhã pode acontecer tudo, inclusive nada!',[
  'A humorous phrase for taking life lightly.',
  'Una frase con humor para tomarse la vida con ligereza.',
  'Une phrase pleine d’humour pour prendre la vie avec légèreté.'
 ],['Tomorrow, anything can happen — including nothing!','¡Mañana puede pasar de todo, incluso nada!','Demain, tout peut arriver, même rien !'],'13.8']
];
for(const [id,name,inscription,intros,meanings,height] of plaques)add(id,[`${name} — Decorative Plaque`,`${name} — Placa Decorativa`,`${name} — Plaque Décorative`],[
 `${intros[0]}\n\nThe model’s lettering is in Portuguese: “${inscription}”\nMeaning: ${meanings[0]}\n\nDigital 3MF file for 3D printing. Letters and decorative elements are joined to the body, with a flat base to stand the plaque upright. Width: 20 cm; approximate height: ${height} cm; thickness: 15 mm. Dark brown body: 12.6 mm; light-colored raised details: 2.4 mm.\n\nPrepared for printing flat, with a Bambu Lab A1 profile, 0.4 mm nozzle, 0.2 mm layers and two colors. Mesh checked and slicing completed in Bambu Studio. The image is a digital preview of the model.`,
 `${intros[1]}\n\nLas letras del modelo están en portugués: «${inscription}»\nSignificado: ${meanings[1]}\n\nArchivo digital 3MF para impresión 3D. Letras y adornos unidos al cuerpo, con una base plana para colocar la placa de pie. Anchura: 20 cm; altura aproximada: ${height.replace('.',',')} cm; grosor: 15 mm. Cuerpo marrón oscuro de 12,6 mm y relieves claros de 2,4 mm.\n\nPreparado para imprimir tumbado, con perfil Bambu Lab A1, boquilla de 0,4 mm, capas de 0,2 mm y dos colores. Malla revisada y laminado completado en Bambu Studio. La imagen es una vista previa digital del modelo.`,
 `${intros[2]}\n\nLe texte du modèle est en portugais : « ${inscription} »\nSignification : ${meanings[2]}\n\nFichier numérique 3MF pour impression 3D. Lettres et ornements réunis au corps, avec une base plane permettant de poser la plaque debout. Largeur : 20 cm ; hauteur approximative : ${height.replace('.',',')} cm ; épaisseur : 15 mm. Corps marron foncé de 12,6 mm et reliefs clairs de 2,4 mm.\n\nPréparé pour une impression à plat, avec profil Bambu Lab A1, buse de 0,4 mm, couches de 0,2 mm et deux couleurs. Maillage vérifié et tranchage effectué dans Bambu Studio. L’image est un aperçu numérique du modèle.`
],[`200 × ${Math.round(Number(height)*10)} × 15 mm (width × height × thickness)`,`200 × ${Math.round(Number(height)*10)} × 15 mm (anchura × altura × grosor)`,`200 × ${Math.round(Number(height)*10)} × 15 mm (largeur × hauteur × épaisseur)`],[
 `${intros[0]} Free 3MF file with a joined body and two-color details. Portuguese lettering.`,
 `${intros[1]} Archivo 3MF gratuito, con cuerpo unido y detalles en dos colores. Letras en portugués.`,
 `${intros[2]} Fichier 3MF gratuit, corps solidaire et détails en deux couleurs. Texte en portugais.`
]);
