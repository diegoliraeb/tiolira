'use client';

import {useEffect, useState} from 'react';
import Link from 'next/link';
import '../app/home-promotion-banner.css';

export default function HomePromotionBanner({lang, endsAt}) {
  const [visible, setVisible] = useState(false);
  const storageKey = `tiolira:noel-promotion-dismissed:${endsAt}`;

  useEffect(() => {
    const remaining = Date.parse(endsAt) - Date.now();
    if (!Number.isFinite(remaining) || remaining <= 0) return;
    try {
      if (sessionStorage.getItem(storageKey) === '1') return;
    } catch {}
    setVisible(true);
    const timer = setTimeout(() => setVisible(false), Math.min(remaining, 2147483647));
    return () => clearTimeout(timer);
  }, [endsAt, storageKey]);

  function dismiss() {
    setVisible(false);
    try { sessionStorage.setItem(storageKey, '1'); } catch {}
  }

  if (!visible) return null;
  const deadline = new Date(endsAt).toLocaleDateString('pt-BR', {timeZone:'America/Sao_Paulo', day:'2-digit', month:'2-digit'});

  return <aside className="home-promotion-banner" aria-labelledby="home-promotion-title">
    <button className="home-promotion-close" type="button" onClick={dismiss} aria-label="Fechar banner da promoção" title="Fechar e continuar no site">×</button>
    <div className="home-promotion-content">
      <img src="/assets/promotions/noeis-quatro-times-v2.webp" width="144" height="144" alt="Noéis do Flamengo, São Paulo, Barcelona e Arsenal"/>
      <div>
        <p className="home-promotion-eyebrow">PRESENTE DE NATAL</p>
        <h2 id="home-promotion-title">Um Noel do seu time, <em>grátis.</em></h2>
        <p className="home-promotion-description">1 modelo digital para imprimir em 3D. Brasileirão ou Champions.</p>
      </div>
    </div>
    <div className="home-promotion-footer">
      <span>Até {deadline}<small>Confira as regras</small></span>
      <Link href={`/${lang}/promocao`}>Quero participar <span aria-hidden="true">↗</span></Link>
    </div>
  </aside>;
}
