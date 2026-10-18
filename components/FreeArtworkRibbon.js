import {freeArtworkLabel} from '../lib/free-artwork.mjs';
export default function FreeArtworkRibbon({product,lang='pt',partner=false}){
 const label=freeArtworkLabel(product,lang,partner);
 return label?<span className="free-artwork-ribbon">{label}</span>:null;
}
