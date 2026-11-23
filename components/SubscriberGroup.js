'use client';
import {useEffect,useState} from 'react';
const copy={
 pt:{title:'Nosso grupo de assinantes',intro:'Novidades, dicas de impressão e troca de experiências com a turma do Tio Lira.',button:'Entrar no grupo dos assinantes',note:'Participação opcional. Solicite a entrada no WhatsApp e aguarde a aprovação do administrador. Seu telefone ficará visível aos participantes.'},
 en:{title:'Our subscribers’ group',intro:'News, printing tips and shared experiences with the Tio Lira community.',button:'Join the subscribers’ group',note:'Joining is optional. Request to join on WhatsApp and wait for admin approval. Your phone number will be visible to participants.'},
 es:{title:'Nuestro grupo de suscriptores',intro:'Novedades, consejos de impresión e intercambio de experiencias con Tio Lira.',button:'Entrar al grupo de suscriptores',note:'Participación opcional. Solicita entrar en WhatsApp y espera la aprobación del administrador. Tu teléfono será visible para los participantes.'},
 fr:{title:'Notre groupe d’abonnés',intro:'Actualités, conseils d’impression et partage d’expériences avec Tio Lira.',button:'Rejoindre le groupe des abonnés',note:'Participation facultative. Demandez à rejoindre le groupe sur WhatsApp et attendez l’approbation de l’administrateur. Votre numéro sera visible par les participants.'}
};
export default function SubscriberGroup({lang='pt'}){
 const [active,setActive]=useState(false),c=copy[lang]||copy.pt;
 useEffect(()=>{let live=true;fetch('/api/club/subscriber-group',{cache:'no-store'}).then(r=>r.ok?r.json():null).then(d=>{if(live)setActive(d?.active===true)}).catch(()=>{});return()=>{live=false}},[]);
 if(!active)return null;
 return <aside className="subscriber-group-card"><div><p className="eyebrow">CLUBE TIO LIRA 3D · WHATSAPP</p><h2>{c.title}</h2><p>{c.intro}</p></div><a className="button primary" href="/api/club/subscriber-group?join=1" target="_blank" rel="noopener noreferrer">{c.button} ↗</a><small>{c.note}</small></aside>;
}
