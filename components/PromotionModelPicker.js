'use client';
import {useId, useState} from 'react';

const normalizeSearch = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim();

export default function PromotionModelPicker({products, productId, onSelect, busy = false}) {
  const [query, setQuery] = useState('');
  const [collection, setCollection] = useState('');
  const progressId = useId();
  const selected = products.find(p => p.id === productId);
  const searchTerms = normalizeSearch(query).split(/\s+/).filter(Boolean);
  const matchingProducts = products.filter(p => (!collection || p.collection === collection) && searchTerms.every(term => normalizeSearch(p.name).includes(term)));
  return <div className="ig-model-picker">
                <fieldset className="ig-model-collections">
                  <legend>Escolha a coleção</legend>
                  <div>{[{id:'',name:'Todos'},{id:'noeis-brasileirao',name:'Brasileirão'},{id:'35b06e0a-ada0-4df9-93e5-4ce39766915a',name:'Champions'}].map(option => <label key={option.id} className={collection === option.id ? 'is-active' : ''}>
                    <input type="radio" name={`${progressId}-collection`} value={option.id} checked={collection === option.id} disabled={busy} onChange={() => {setCollection(option.id); setQuery('');}}/>
                    <span>{option.name}</span>
                  </label>)}</div>
                </fieldset>
                <label htmlFor={`${progressId}-model-search`}>Buscar modelo</label>
                <div className="ig-model-search">
                  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>
                  <input id={`${progressId}-model-search`} type="search" value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => {if (e.key === 'Enter') e.preventDefault();}} placeholder="Digite o nome do time…" aria-controls={`${progressId}-model-results`} autoComplete="off"/>
                </div>
                <div className="ig-model-results-heading"><p role="status">{matchingProducts.length === 1 ? '1 modelo encontrado' : `${matchingProducts.length} modelos encontrados`}</p><span>Toque em um Noel para escolher</span></div>
                {matchingProducts.length ? <div className="ig-model-results" id={`${progressId}-model-results`} role="group" aria-label="Modelos disponíveis para resgate">
                  {matchingProducts.map(p => <button type="button" key={p.id} className={`ig-model-card${productId === p.id ? ' is-selected' : ''}`} aria-pressed={productId === p.id} disabled={busy} onClick={() => onSelect(p.id)}>
                    <span className="ig-model-image">{p.image ? <img src={p.image} alt="" loading="lazy" width="200" height="200"/> : <span className="ig-model-image-fallback">Imagem indisponível</span>}<span className="ig-model-check" aria-hidden="true">{productId === p.id ? '✓' : '+'}</span></span>
                    <span className="ig-model-name">{p.name}</span><span className="ig-model-card-action">{productId === p.id ? 'Selecionado' : 'Escolher este Noel'}</span>
                  </button>)}
                </div> : <div className="ig-model-empty" id={`${progressId}-model-results`}><strong>{products.length ? 'Nenhum Noel encontrado' : 'Nenhum modelo disponível para resgate'}</strong><p>{products.length ? 'Tente outro nome de time ou confira todos os modelos.' : 'Modelos já adquiridos não aparecem nesta seleção.'}</p>{query && <button type="button" className="text-link" onClick={() => setQuery('')}>Limpar busca</button>}</div>}
                {selected && <div className="ig-selected-model" role="status">{selected.image && <img src={selected.image} alt="" width="72" height="72"/>}<div><span>Seu Noel escolhido</span><strong>{selected.name}</strong></div><button type="button" className="text-link" disabled={busy} onClick={() => onSelect('')} aria-label="Remover modelo selecionado">Trocar</button></div>}
              </div>;
}
