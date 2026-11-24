'use client';
import {useEffect,useState} from 'react';
import {POLL_PATH} from '../lib/click-sanctis-poll.mjs';
export default function ClickSanctisPoll(){
 const [data,setData]=useState(null),[error,setError]=useState(''),[notice,setNotice]=useState('');
 async function refresh(){try{const response=await fetch('/api/polls/click-sanctis',{cache:'no-store'}),result=await response.json();if(!response.ok)throw Error(result.error||'Não foi possível carregar os resultados.');setData(result);setError('');}catch(e){setError(e.message);}}
 useEffect(()=>{refresh();},[]);
 async function share(){const url='https://www.tiolira.com.br'+POLL_PATH;try{if(navigator.share)await navigator.share({title:'Resultado final · Click Sanctis, parte 2',text:'Conheça os nomes escolhidos para as próximas criações do Tio Lira!',url});else{await navigator.clipboard.writeText(url);setNotice('Link dos resultados copiado!');}}catch(e){if(e.name!=='AbortError')setNotice('Compartilhe: '+url);}}
 return <div className="sanctis-poll"><header className="poll-header"><a href="/pt" aria-label="Tio Lira — início"><img src="/assets/tl-monogram-3d.webp" width="48" height="48" alt=""/><span>tio lira</span></a><span>FEITO COM FÉ E CARINHO</span></header>
 <main><section className="poll-hero poll-hero-closed"><p className="poll-kicker">COLEÇÃO CLICK SANCTIS · PARTE 2</p><h1>Vocês escolheram.<br/><em>Agora vamos criar!</em></h1><p>Enquete encerrada em 24/11/2026.<br/>Obrigado por ajudar a escolher as próximas peças.</p></section>
 <section id="resultados" className="poll-panel poll-panel-closed" aria-label="Resultados finais"><div className="poll-section-heading"><div><p className="poll-kicker">RESULTADO FINAL</p><h2>Os escolhidos da parte 2.</h2></div></div>
 {error&&<div className="poll-error" role="alert">{error}<button type="button" onClick={refresh}>Tentar novamente</button></div>}
 <p className="poll-help" role="status">{data?`${data.totalVoters} participantes · ${data.totalVotes} escolhas registradas`:'Carregando resultados…'}</p>
 <div className="poll-result-note">A votação terminou. Não é mais possível enviar votos. Os 10 mais votados serão as próximas criações da coleção.</div>
 {data?.cutoffTie&&<p className="poll-tie">Há empate na última vaga. A definição dos selecionados nessa posição será anunciada pelo Tio Lira.</p>}
 <ol className="poll-ranking">{data?.results.map((c,index)=><li key={c.id} className={index<10?'leading':''}><span className="poll-rank">{c.rank||'–'}</span><div className="poll-result-name"><strong>{c.name}</strong>{index<10&&!(data.cutoffTie&&c.votes===data.results[9].votes)&&<small className="poll-winner">Escolhido para a parte 2</small>}<div className="poll-bar"><span style={{width:`${data.totalVoters?c.votes/data.totalVoters*100:0}%`}}/></div></div><span className="poll-votes"><strong>{c.votes}</strong><small>{c.votes===1?'voto':'votos'}</small></span></li>)}</ol>
 <p className="poll-privacy">Cada participante pôde escolher até 5 nomes. Nomes com o mesmo número de votos dividem a posição e aparecem em ordem alfabética. A classificação não determina a ordem de lançamento das peças.</p></section>
 <section className="poll-share"><h2>Essa coleção tem a sua participação.</h2><p>Compartilhe os resultados e acompanhe as próximas criações!</p><button type="button" onClick={share}>Compartilhar resultados ↗</button>{notice&&<p role="status">{notice}</p>}</section></main>
 <footer className="poll-footer"><a href="/pt">tio lira</a><p>Arte para imprimir, montar e guardar no coração.</p><a href="/pt/assinatura">Conheça a assinatura →</a></footer></div>;
}
