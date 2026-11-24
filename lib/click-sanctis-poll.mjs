export const POLL_CLOSED=true;
export const POLL_CLOSED_ON='2026-11-24';
export const POLL_ID='click-sanctis-parte-2';
export const MAX_CHOICES=5;
export const POLL_PATH='/pt/enquete-click-sanctis';
export const candidates=[
 ['padre-cicero','Padre Cícero','Servo de Deus'],
 ['guadalupe','Nossa Senhora de Guadalupe'],
 ['carlo-acutis','São Carlo Acutis'],
 ['judas-tadeu','São Judas Tadeu'],
 ['expedito','Santo Expedito'],
 ['padre-pio','São Pio de Pietrelcina','Padre Pio'],
 ['fatima','Nossa Senhora de Fátima'],
 ['gracas','Nossa Senhora das Graças'],
 ['lourdes','Nossa Senhora de Lourdes'],
 ['nazare','Nossa Senhora de Nazaré'],
 ['carmo','Nossa Senhora do Carmo'],
 ['conceicao','Nossa Senhora da Conceição'],
 ['desatadora','Nossa Senhora Desatadora dos Nós'],
 ['perpetuo-socorro','Nossa Senhora do Perpétuo Socorro'],
 ['dores','Nossa Senhora das Dores'],
 ['imaculado-coracao','Imaculado Coração de Maria'],
 ['jesus-misericordioso','Jesus Misericordioso'],
 ['bom-jesus-lapa','Bom Jesus da Lapa'],
 ['sebastiao','São Sebastião'],
 ['joao-batista','São João Batista'],
 ['pedro','São Pedro'],
 ['paulo','São Paulo Apóstolo'],
 ['cristovao','São Cristóvão'],
 ['benedito','São Benedito'],
 ['roque','São Roque'],
 ['longuinho','São Longuinho'],
 ['frei-galvao','Santo Antônio de Sant’Anna Galvão','Frei Galvão'],
 ['joao-paulo','São João Paulo II'],
 ['dulce','Santa Dulce dos Pobres'],
 ['clara','Santa Clara de Assis'],
 ['luzia','Santa Luzia'],
 ['barbara','Santa Bárbara'],
 ['cecilia','Santa Cecília'],
 ['edwiges','Santa Edwiges'],
 ['santana','Sant’Ana','Mãe de Nossa Senhora'],
 ['monica','Santa Mônica'],
 ['teresa-avila','Santa Teresa de Ávila'],
 ['faustina','Santa Faustina Kowalska'],
 ['gabriel','São Gabriel Arcanjo'],
 ['rafael','São Rafael Arcanjo']
].map(([id,name,note])=>({id,name,note:note||''}));
export function validateChoices(choices){
 if(!Array.isArray(choices)||choices.length<1||choices.length>MAX_CHOICES||new Set(choices).size!==choices.length||choices.some(id=>!candidates.some(c=>c.id===id)))throw Object.assign(Error('Escolha de 1 a 5 nomes diferentes da lista.'),{status:400});
 return [...choices].sort();
}
export function addBallot(state,voter,choices,now=new Date().toISOString()){
 const valid=validateChoices(choices),ballots=state?.ballots||{};
 if(ballots[voter])return state; // Idempotent: retries and concurrent tabs cannot duplicate a ballot.
 return {ballots:{...ballots,[voter]:{choices:valid,at:now}}};
}
export function pollResults(state,voter){
 const ballots=Object.values(state?.ballots||{}),counts=Object.fromEntries(candidates.map(c=>[c.id,0]));
 for(const b of ballots)for(const id of b.choices)if(id in counts)counts[id]++;
 const sorted=candidates.map(c=>({...c,votes:counts[c.id]})).sort((a,b)=>b.votes-a.votes||a.name.localeCompare(b.name,'pt-BR'));
 const rows=sorted.map(c=>({...c,rank:c.votes?1+sorted.filter(other=>other.votes>c.votes).length:null}));
 const cutoff=rows[9]?.votes||0;
 return {closed:POLL_CLOSED,closedOn:POLL_CLOSED_ON,pollId:POLL_ID,totalVoters:ballots.length,totalVotes:Object.values(counts).reduce((a,b)=>a+b,0),results:rows,selected:state?.ballots?.[voter]?.choices||[],cutoffTie:cutoff>0&&rows[10]?.votes===cutoff,updatedAt:new Date().toISOString()};
}
