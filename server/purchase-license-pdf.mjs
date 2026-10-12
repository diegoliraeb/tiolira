import {PDFDocument,StandardFonts,rgb} from 'pdf-lib';

// Generated only from the authenticated buyer's active, persisted purchase license.
export async function purchaseLicensePdf(license){
 const doc=await PDFDocument.create(),regular=await doc.embedFont(StandardFonts.Helvetica),bold=await doc.embedFont(StandardFonts.HelveticaBold);
 doc.setTitle('Licença de venda de peças impressas - Tio Lira');doc.setAuthor('Tio Lira');
 const green=rgb(.19,.26,.17),ink=rgb(.18,.2,.17),muted=rgb(.42,.45,.4),cream=rgb(.98,.97,.94);
 let page,y;
 function newPage(){page=doc.addPage([595.28,841.89]);page.drawRectangle({x:0,y:0,width:595.28,height:841.89,color:cream});page.drawRectangle({x:0,y:740,width:595.28,height:102,color:green});page.drawText('TIO LIRA',{x:48,y:787,size:24,font:bold,color:rgb(1,1,1)});page.drawText('Cultura e criatividade para imprimir',{x:48,y:763,size:11,font:regular,color:rgb(.89,.9,.85)});page.drawText('tiolira.com.br  |  Área do parceiro',{x:48,y:32,size:9,font:regular,color:muted});y=698;}
 // Standard PDF fonts support Portuguese accents. Replace unsupported decorative
 // glyphs rather than failing a legitimate buyer's download.
 const clean=text=>[...String(text??'').normalize('NFC').replace(/\s+/g,' ')].map(c=>{try{regular.encodeText(c);return c}catch{return '?'}}).join('');
 function text(value,{size=12,font=regular,color=ink,gap=14}={}){
  const words=clean(value).split(' '),lines=[];let line='';
  for(const word of words){for(const part of splitWord(word,font,size)){const next=line?`${line} ${part}`:part;if(font.widthOfTextAtSize(next,size)>499){lines.push(line);line=part}else line=next;}}if(line)lines.push(line);
  for(const line of lines){if(y<85)newPage();page.drawText(line,{x:48,y,size,font,color});y-=size*1.5;}y-=gap;
 }
 function splitWord(word,font,size){const result=[];let part='';for(const c of word){if(font.widthOfTextAtSize(part+c,size)>499){result.push(part);part='';}part+=c;}result.push(part);return result;}
 function field(label,value){text(label,{size:9,font:bold,color:muted,gap:1});text(value,{size:12,gap:14});}
 newPage();text('Licença de venda',{size:27,font:bold,color:green,gap:0});text('PEÇAS FÍSICAS IMPRESSAS EM 3D',{size:10,font:bold,color:muted,gap:24});
 field('OBRA LICENCIADA',license.productName);field('PARCEIRO TITULAR',license.partnerName);field('CÓDIGO DA LICENÇA',license.code);
 field('EMITIDA EM',new Date(license.issuedAt).toLocaleDateString('pt-BR',{timeZone:'America/Maceio'}));field('PEDIDO',license.orderId);
 text('Autorização de uso',{size:15,font:bold,color:green,gap:8});text(license.terms,{size:11,gap:18});
 text('Emitida automaticamente após a confirmação do pagamento. A validade desta licença acompanha a situação da compra. Consulte o registro atualizado em Meus pedidos e Minhas licenças, na área do parceiro em tiolira.com.br.',{size:10,color:muted});
 return doc.save();
}
