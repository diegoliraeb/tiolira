'use client';
import {useEffect,useState} from 'react';
import {feedbackCopy,feedbackLink} from '../lib/feedback-copy.mjs';
import {feedbackApi,Stars} from './FeedbackCommon';
export default function ProductReviews({productId,lang='pt'}){
 const c=feedbackCopy(lang),[data,setData]=useState(null),[error,setError]=useState(false);
 async function load(){setError(false);try{setData(await feedbackApi(`reviews?productId=${encodeURIComponent(productId)}`));}catch{setError(true);}}
 useEffect(()=>{load();},[productId]);
 return <section className="product-reviews" aria-labelledby="reviews-title"><div className="feedback-heading"><div><p className="eyebrow">{c.verified}</p><h2 id="reviews-title">{c.title}</h2>{data?.count>0&&<p><Stars rating={data.average} label={c.stars}/> <strong>{data.average.toLocaleString(lang,{maximumFractionDigits:1})} {c.average}</strong> · {c.note}: {data.count}</p>}</div><div className="feedback-actions"><a className="button outline" href={feedbackLink(lang,productId,'review')}>{c.review}</a><a className="button primary" href={feedbackLink(lang,productId)}>{c.contact} ↗</a></div></div><p className="field-help">{c.login}</p>{error?<p role="alert">{c.error} <button onClick={load}>{c.retry}</button></p>:!data?<p role="status">{c.loading}</p>:!data.count?<p className="notice">{c.empty}</p>:<div className="feedback-review-list">{data.reviews.map(r=><article className="feedback-card" key={r.id}><header><strong>{r.author}</strong><small className="feedback-tag">✓ {c.verified}</small><time>{new Date(r.createdAt).toLocaleDateString(lang)}</time></header><Stars rating={r.rating} label={c.stars}/><p>{r.text}</p>{r.photoUrl&&<a href={r.photoUrl} target="_blank" rel="noreferrer"><img className="feedback-photo" src={r.photoUrl} alt={c.photoAlt} loading="lazy"/></a>}{r.reply&&<blockquote><strong>{c.reply}</strong><p>{r.reply}</p></blockquote>}</article>)}</div>}</section>;
}
