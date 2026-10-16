import {z} from 'zod';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {PDFDocument,StandardFonts,rgb} from 'pdf-lib';
import {groupItemsSchema,valuesSchema} from './cost-sheets.mjs';
import {calculateArtwork} from '../lib/calculator.mjs';
import {artworkGroupBreakdown} from '../lib/artwork-selection.mjs';
import {productPrintEstimate} from '../lib/print-estimates.mjs';
import {calculatorCopy} from '../lib/artwork-calculator-copy.mjs';

const schema=z.object({items:groupItemsSchema.optional(),customName:z.string().trim().min(1).max(100).optional(),values:valuesSchema,lang:z.enum(['pt','en','es','fr']).default('pt')}).refine(v=>Boolean(v.items)!==Boolean(v.customName),'Informe obras ou uma peça avulsa.');
export function costSheetReport(input,catalog){
 const data=schema.parse(input),result=calculateArtwork(data.values);
 const products=catalog.products.filter(p=>p.published&&catalog.collections.some(c=>c.id===p.collection&&c.published)).map(p=>({...p,printEstimate:productPrintEstimate(p)}));
 if(data.items?.some(i=>!products.some(p=>p.id===i.productId)))throw Object.assign(Error('Obra não disponível.'),{status:404});
 const breakdown=data.items?artworkGroupBreakdown(data.items,products,data.values):{lines:[{productId:null,quantity:1,unit:result,cost:result.cost,subtotal:result.price}],individualTotal:result.price};
 if(!breakdown)throw Object.assign(Error('Faltam referências para detalhar os custos das obras.'),{status:400});
 return {...data,result,individualTotal:breakdown.individualTotal,lines:breakdown.lines.map(line=>({...line,name:line.productId?products.find(p=>p.id===line.productId).name:data.customName})),quantity:breakdown.lines.reduce((sum,l)=>sum+l.quantity,0)};
}

export async function costSheetPdf(report,{partnerName='',now=new Date()}={}){
 const doc=await PDFDocument.create(),regular=await doc.embedFont(StandardFonts.Helvetica),bold=await doc.embedFont(StandardFonts.HelveticaBold);
 const logo=await doc.embedPng(await readFile(join(process.cwd(),'public/assets/tl-monogram-3d-icon.png')));
 const c=calculatorCopy(report.lang),money=n=>new Intl.NumberFormat(report.lang,{style:'currency',currency:'BRL'}).format(n),num=n=>new Intl.NumberFormat(report.lang,{maximumFractionDigits:2}).format(n);
 const ink=rgb(.19,.23,.16),muted=rgb(.42,.45,.38),cream=rgb(.98,.965,.93),line=rgb(.86,.83,.77),pale=rgb(.90,.93,.86),orange=rgb(.69,.32,.20),white=rgb(1,.99,.97);
 doc.setTitle(`${c.reportTitle} - Tio Lira`);doc.setAuthor('Tio Lira');doc.setCreationDate(now);
 const clean=v=>[...String(v??'').normalize('NFC').replace(/\s+/g,' ').replace(/[–—]/g,'-')].map(char=>{try{regular.encodeText(char);return char;}catch{return '';}}).join('');
 const wrap=(value,width,size=10,font=regular)=>{const lines=[];let current='';for(const word of clean(value).split(' ')){let parts=[],part='';for(const ch of word){if(font.widthOfTextAtSize(part+ch,size)>width){parts.push(part);part='';}part+=ch;}parts.push(part);for(const p of parts){const next=current?current+' '+p:p;if(font.widthOfTextAtSize(next,size)>width){lines.push(current);current=p;}else current=next;}}if(current)lines.push(current);return lines;};
 let page,y;
 const draw=(value,x,top,size=10,font=regular,color=ink)=>page.drawText(clean(value),{x,y:top-size,size,font,color});
 function newPage(){page=doc.addPage([595.28,841.89]);page.drawRectangle({x:0,y:0,width:595.28,height:841.89,color:cream});page.drawImage(logo,{x:40,y:756,width:48,height:48});draw('tio lira',100,802,25,bold);draw(c.reportPrivate,100,770,8,regular,muted);page.drawLine({start:{x:40,y:744},end:{x:555,y:744},thickness:1,color:line});y=725;}
 function ensure(height){if(y-height<62)newPage();}
 function paragraph(value,{size=9,color=muted,gap=10,font=regular}={}){const lines=wrap(value,515,size,font);for(const text of lines){ensure(size*1.5);draw(text,40,y,size,font,color);y-=size*1.5;}y-=gap;}
 function heading(value){ensure(38);draw(value,40,y,15,bold);y-=27;}
 const widths=[151,30,78,85,78,93],labels=[c.reportWork,c.reportQuantity,c.unitCost,c.unitPrice,c.reportCostTotal,c.linePrice];
 function tableHeader(){ensure(40);page.drawRectangle({x:40,y:y-35,width:515,height:35,color:ink});let x=47;labels.forEach((label,i)=>{wrap(label,widths[i]-14,8,bold).forEach((t,j)=>draw(t,x,y-7-j*10,8,bold,white));x+=widths[i];});y-=35;}
 newPage();draw(c.reportTitle,40,y,27,bold);y-=39;
 paragraph(`${c.reportDate}: ${now.toLocaleDateString(report.lang,{timeZone:'America/Maceio'})} · ${report.quantity} ${c.pieces}`);
 if(partnerName)paragraph(partnerName.slice(0,120),{size:10,color:ink,gap:16});
 heading(c.reportWorks);tableHeader();
 report.lines.forEach((item,index)=>{
  const names=wrap(item.name,widths[0]-14,9,bold),height=Math.max(47,names.length*12+18);
  if(y-height<62){newPage();tableHeader();}
  page.drawRectangle({x:40,y:y-height,width:515,height,color:index%2?white:pale});
  let x=47;names.forEach((t,j)=>draw(t,x,y-10-j*12,9,bold));x+=widths[0];
  [String(item.quantity),money(item.unit.cost),money(item.unit.price),money(item.cost),money(item.subtotal)].forEach((text,i)=>{let size=9;while(bold.widthOfTextAtSize(clean(text),size)>widths[i+1]-14&&size>6)size-=.25;draw(text,x,y-12,size,i===2?bold:regular,i===2?orange:ink);x+=widths[i+1];});
  y-=height;
 });y-=22;
 ensure(110);const cards=[[c.reportCostTotal,report.result.cost],[report.quantity>1?c.groupPrice:c.suggested,report.result.price],[c.individualTotal,report.individualTotal]];
 cards.forEach(([label,value],i)=>{const x=40+i*175;page.drawRectangle({x,y:y-90,width:165,height:90,color:i===1?ink:pale});wrap(label,145,9,bold).forEach((t,j)=>draw(t,x+10,y-12-j*12,9,bold,i===1?white:ink));let size=20;while(bold.widthOfTextAtSize(clean(money(value)),size)>145&&size>8)size--;draw(money(value),x+10,y-53,size,bold,i===1?white:ink);});y-=108;
 if(report.quantity>1){paragraph(c.allocationNote);paragraph(c.unitRounding);}
 heading(c.reportAssumptions);
 const v=report.values;
 paragraph(`${c.grams}: ${num(v.grams)} g · ${c.hours}: ${Math.floor(Math.round(v.hours*60)/60)} h ${Math.round(v.hours*60)%60} min · ${c.margin}: ${num(v.margin)}% · ${c.fee}: ${num(v.fee)}%`,{color:ink});
 const settings=[['kgPrice',v.kgPrice],['labor',v.labor],['energy',v.energy],['watts',v.watts],['machine',v.machine],['failure',v.failure],['minutes',v.minutes],['packaging',v.packaging],['extras',v.extras],['fileCost',v.fileCost],['overhead',v.overhead],['shipping',v.shipping]];
 for(let i=0;i<settings.length;i+=2){const cells=settings.slice(i,i+2).map(([key,value])=>wrap(`${report.quantity>1&&c[key+'Group']?c[key+'Group']:c[key]}: ${key==='minutes'?num(value)+' min':key==='packaging'?money(value):num(value)}`,245,8));const height=Math.max(...cells.map(lines=>lines.length))*12+8;ensure(height);cells.forEach((lines,col)=>lines.forEach((t,j)=>draw(t,40+col*265,y-j*12,8,regular,muted)));y-=height;}
 for(const [i,p] of doc.getPages().entries()){p.drawLine({start:{x:40,y:45},end:{x:555,y:45},thickness:1,color:line});p.drawText(`tiolira.com.br  |  ${clean(c.reportTitle)}`,{x:40,y:28,size:8,font:regular,color:muted});p.drawText(`${clean(c.reportPage)} ${i+1} / ${doc.getPageCount()}`,{x:480,y:28,size:8,font:regular,color:muted});}
 return doc.save();
}
