'use client';
import {useState} from 'react';
import {dictionaries} from '../lib/i18n';
export default function Gallery({images,name,lang}){const [index,setIndex]=useState(0);return <div className="gallery"><img className="gallery-main" src={images[index]} alt={name}/>{images.length>1&&<div className="thumbnails">{images.map((image,i)=><button key={image} onClick={()=>setIndex(i)} aria-pressed={index===i} aria-label={`${name} ${i+1}`}><img src={image} alt=""/></button>)}</div>}<p>{dictionaries[lang].render}</p></div>}
