'use client';
import {useCallback, useEffect, useId, useState} from 'react';
import '../app/instagram-promotion.css';

function PromotionStep({id, number, title, status, complete, open, onToggle, children}) {
  return <section className={`ig-progress-step${complete ? ' is-complete' : ''}${open ? ' is-open' : ''}`}>
    <h4><button type="button" className="ig-step-toggle" id={`${id}-toggle`} aria-expanded={open} aria-controls={`${id}-content`} onClick={onToggle}>
      <span className="ig-step-number" aria-hidden="true">{complete ? '✓' : number}</span>
      <span className="ig-step-label"><span className="ig-step-title">{title}</span><span className="ig-step-status">{status}</span></span>
      <span className="ig-step-chevron" aria-hidden="true">⌄</span>
    </button></h4>
    <div className="ig-step-content" id={`${id}-content`} role="region" aria-labelledby={`${id}-toggle`} hidden={!open}>{children}</div>
  </section>;
}

export default function PartnerInstagramPromotion({member, lang, onRedeem}) {
  const [data, setData] = useState(null), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [checks, setChecks] = useState(null);
  const [openStep, setOpenStep] = useState(null);
  const progressId = useId();
  const toggleStep = step => setOpenStep(current => current === step ? null : step);
  const [busy, setBusy] = useState(false), [emailCode, setEmailCode] = useState(''), [username, setUsername] = useState('');
  const [messageCode, setMessageCode] = useState(''), [productId, setProductId] = useState(''), [query, setQuery] = useState('');
  const refresh = useCallback(async () => {
    const response = await fetch('/api/club/instagram-promotion', {cache: 'no-store'}), result = await response.json();
    if (!response.ok) throw Error(result.error || 'Não foi possível carregar a promoção.');
    setData(result); return result;
  }, []);
  useEffect(() => {refresh().catch(e => setError(e.message));}, [refresh]);
  useEffect(() => {
    if (!data?.pending) return;
    const timer = setInterval(() => {if (document.visibilityState === 'visible') refresh().catch(() => {});}, 8000);
    return () => clearInterval(timer);
  }, [Boolean(data?.pending), refresh]);
  async function action(path, input, success) {
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch(`/api/club/${path}`, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(input || {})});
      const result = await response.json(); if (!response.ok) throw Error(result.error || 'Não foi possível continuar.');
      if (result.checks) setChecks(result.checks);
      if (path.endsWith('/link')) setChecks(null);
      if (result.message) setMessageCode(result.message); else if(result.delivery) setMessageCode('');
      await refresh(); if (success) setNotice(success);
      if (path.endsWith('/claim')) setOpenStep('coupon');
      if (path.endsWith('/redeem')) await onRedeem();
    } catch (e) {setError(e.message);} finally {setBusy(false);}
  }
  async function copy(value) {try {await navigator.clipboard.writeText(value); setNotice('Código copiado.');} catch {setNotice('Selecione e copie o código exibido.');}}
  const checkLabel = value => ({complete:'✓ Confirmado',missing:'Pendente',unavailable:'Não foi possível consultar; tente novamente',relink:'Seu @ mudou; vincule novamente',pending:'Aguardando verificação'}[value]);
  const selected = data?.products.find(p => p.id === productId);
  const date = value => new Date(value).toLocaleString('pt-BR', {timeZone: 'America/Maceio', dateStyle: 'short', timeStyle: 'short'});
  if (!data) return <section className="partner-panel"><h2>Promoção de Natal</h2><p role="status">{error || 'Carregando sua participação…'}</p>{error && <button className="button outline" onClick={() => refresh().catch(e => setError(e.message))}>Tentar novamente</button>}</section>;
  const followComplete = Boolean(data.coupon) || Boolean(checks?.follows.length && checks.follows.every(a=>a.status==='complete'));
  const commentComplete = Boolean(data.coupon) || checks?.comment==='complete';
  const completedSteps = [data.emailVerified, Boolean(data.instagram), followComplete, commentComplete, Boolean(data.coupon)].filter(Boolean).length;
  return <section className="ig-promotion" aria-labelledby="instagram-promotion-title" aria-busy={busy}>
    <header className="partner-panel-heading"><p className="eyebrow">CLUBE TIO LIRA · PRESENTE DE NATAL</p><h2 id="instagram-promotion-title">Um Noel para o seu time.</h2><p>Escolha um modelo digital do Brasileirão ou da Champions. Um cupom pessoal, um modelo gratuito.</p></header>
    <div className="ig-promotion-rules"><strong>{data.campaign.open ? 'Promoção aberta' : data.coupon ? 'Seu cupom está abaixo' : 'A promoção ainda não está aberta ou já encerrou'}</strong><p>Participação e resgate até {date(data.campaign.endsAt)} (horário de Brasília). Confirme seu e-mail, comprove seu Instagram, siga @tiolira e @tiolira3d, curta a publicação e comente dois @ diferentes no post da promoção.</p><p>O benefício não se renova ao trocar o Instagram, e um Instagram já vinculado não pode participar por outro cadastro. A escolha dá direito ao arquivo digital e à licença da obra; não inclui peça física.</p>{data.campaign.postUrl && <a className="text-link" href={data.campaign.postUrl} target="_blank" rel="noreferrer">Abrir o post da promoção ↗</a>}</div>
    {error && <p className="status-message" role="alert">{error}</p>}{notice && <p className="status-message" role="status">{notice}</p>}
    <section className="ig-interactive-progress" aria-labelledby="ig-progress-title">
      <div className="ig-progress-heading"><div><h3 id="ig-progress-title">Seu progresso na promoção</h3><p>Clique em uma etapa para abrir e continuar.</p></div><strong aria-live="polite">{completedSteps} de 5 concluídas</strong></div>
      <progress className="ig-progress-bar" max="5" value={completedSteps} aria-label="Etapas concluídas na promoção"/>
      <div className="ig-progress-list">
        <PromotionStep id={`${progressId}-email`} number="1" title="E-mail" status={data.emailVerified?'Confirmado':'Clique para confirmar seu e-mail'} complete={data.emailVerified} open={openStep==='email'} onToggle={()=>toggleStep('email')}>
          <p>{data.email}</p>{data.emailVerified ? <p className="ig-verified">✓ E-mail confirmado</p> : <><button className="button outline" disabled={busy} onClick={() => action('verify-email/request', {}, 'Código enviado. Confira também a caixa de spam.')}>Enviar código por e-mail</button><form onSubmit={e => {e.preventDefault(); action('verify-email/confirm', {code: emailCode}, 'E-mail confirmado.');}}><label>Código de 8 números<input required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{8}" maxLength={8} value={emailCode} onChange={e => setEmailCode(e.target.value.replace(/\D/g, ''))}/></label><button className="button primary" disabled={busy || emailCode.length !== 8}>Confirmar e-mail</button></form></>}
          {data.emailVerified && <button type="button" className="text-link" onClick={()=>setOpenStep('instagram')}>Ir para meu Instagram →</button>}
        </PromotionStep>
        <PromotionStep id={`${progressId}-instagram`} number="2" title="Instagram" status={data.instagram?'@'+data.instagram.username:data.pending?'Aguardando sua resposta no Direct':'Vincule seu @ à sua conta'} complete={Boolean(data.instagram)} open={openStep==='instagram'} onToggle={()=>toggleStep('instagram')}>
          {data.coupon ? <p className="ig-verified">✓ @{data.coupon.username} confirmado na emissão do cupom.</p> : <>{data.instagram && <p className="ig-verified">✓ @{data.instagram.username} vinculado à sua conta</p>}<p>Informe seu @. Se você já comentou no post da promoção, @tiolira3d enviará uma mensagem de confirmação. Responda ao Direct para concluir.</p><form onSubmit={e => {e.preventDefault(); action('instagram-promotion/link', {username: username || data.instagram?.username || member.instagram});}}><label>Seu @ do Instagram<input required autoCapitalize="none" spellCheck={false} maxLength={100} placeholder="@seuusuario" value={username} onChange={e => setUsername(e.target.value)}/></label><button className="button outline" disabled={busy || !data.emailVerified || Boolean(data.coupon)}>{data.instagram ? 'Vincular outro Instagram' : 'Confirmar meu Instagram'}</button></form>{!data.emailVerified && <p><button type="button" className="text-link" onClick={()=>setOpenStep('email')}>Confirmar meu e-mail primeiro →</button></p>}
        {data.pending && <div className="ig-direct"><p>{data.pending.delivery==='manual'?'Envie a mensagem abaixo para @tiolira3d usando':'Confira o Direct de @tiolira3d (inclusive Solicitações) e responda à mensagem usando'} <strong>@{data.pending.username}</strong> até {date(data.pending.expiresAt)}.</p>{messageCode ? <><code>{messageCode}</code><button className="text-link" onClick={() => copy(messageCode)}>Copiar mensagem</button></> : <p>{data.pending.delivery==='manual'?'Clique em Confirmar meu Instagram para obter a mensagem de confirmação.':'A confirmação termina quando você responder ao Direct. Se não fez esta solicitação, não responda.'}</p>}<ul>{data.accounts.map(a => <li key={a.id}><a href={`https://ig.me/m/${a.username}`} target="_blank" rel="noreferrer">Abrir Direct de @{a.username} ↗</a><span>{data.pending.received.includes(a.username) ? '✓ Recebida' : 'Aguardando sua confirmação'}</span></li>)}</ul>{data.pending.error && <p role="alert">{data.pending.error}</p>}<button className="button outline" disabled={busy} onClick={() => refresh().catch(e => setError(e.message))}>Já respondi; atualizar</button></div>}
      </>}
        </PromotionStep>
        <PromotionStep id={`${progressId}-follow`} number="3" title="Siga os perfis" status={followComplete?'Confirmado':checkLabel(checks?.follows[0]?.status || 'pending')} complete={followComplete} open={openStep==='follow'} onToggle={()=>toggleStep('follow')}>
          <p>Acompanhe @tiolira e @tiolira3d no Instagram.</p><div className="ig-step-actions"><a className="button outline" href="https://www.instagram.com/tiolira/" target="_blank" rel="noreferrer">Abrir @tiolira ↗</a><a className="button outline" href="https://www.instagram.com/tiolira3d/" target="_blank" rel="noreferrer">Abrir @tiolira3d ↗</a></div>
          {!data.coupon && <><button className="button primary" disabled={busy || !data.emailVerified || !data.instagram} onClick={()=>action('instagram-promotion/check',{})}>{busy?'Verificando…':'Já segui; verificar'}</button>{(!data.emailVerified || !data.instagram) && <p>Confirme seu e-mail e seu Instagram para verificar esta etapa.</p>}</>}
        </PromotionStep>
        <PromotionStep id={`${progressId}-comment`} number="4" title="Comentário no post" status={commentComplete?'Confirmado':'Marque dois amigos e clique em verificar'} complete={commentComplete} open={openStep==='comment'} onToggle={()=>toggleStep('comment')}>
          <p>Curta a publicação e comente com dois @ diferentes de amigos. Não conte seu próprio perfil, @tiolira ou @tiolira3d.</p>
          {data.campaign.postUrl ? <a className="button outline" href={data.campaign.postUrl} target="_blank" rel="noreferrer">Abrir post da promoção ↗</a> : <p>O post aparecerá aqui quando a promoção estiver pronta.</p>}
          {!data.coupon && <><p>Depois de comentar, volte e clique abaixo para conferir.</p><button className="button primary" disabled={busy || !data.emailVerified || !data.instagram || !data.campaign.postUrl} onClick={()=>action('instagram-promotion/check',{})}>{busy?'Verificando…':'Já comentei; verificar'}</button>{checks && <p role="status">{checkLabel(checks.comment)}</p>}{(!data.emailVerified || !data.instagram) && <p>Confirme seu e-mail e seu Instagram para consultar seu comentário.</p>}</>}
        </PromotionStep>
        <PromotionStep id={`${progressId}-coupon`} number="5" title="Seu cupom e seu Noel" status={data.redemption?'Modelo resgatado':data.coupon?'Cupom liberado · escolha seu modelo':'Conclua as etapas para liberar seu presente'} complete={Boolean(data.coupon)} open={openStep==='coupon'} onToggle={()=>toggleStep('coupon')}>
          {data.coupon ? <div className="ig-personal-coupon"><p className="eyebrow">SEU CUPOM PESSOAL</p><h3>Brasileirão ou Champions: escolha um.</h3><code>{data.coupon.code}</code><p>Vinculado à sua conta e ao Instagram @{data.coupon.username}. Válido até {date(data.coupon.expiresAt)}.</p>{data.redemption ? <><p className="ig-verified">✓ Cupom utilizado em {data.redemption.productName}.</p><p>O modelo e sua licença também estão em Meus pedidos e Meus arquivos.</p>{data.redemption.status === 'paid' && <a className="button primary" href={`/api/download?id=${encodeURIComponent(data.redemption.productId)}`}>Baixar meu modelo</a>}</> : <form onSubmit={e => {e.preventDefault(); action('instagram-promotion/redeem', {code: data.coupon.code, productId, lang}, 'Modelo liberado em Meus arquivos e Meus pedidos.');}}><label>Buscar modelo<input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Digite o nome do time"/></label><label>Modelo que você deseja resgatar<select required value={productId} onChange={e => setProductId(e.target.value)}><option value="">Escolha um modelo</option>{data.products.filter(p => p.id === productId || p.name.toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR'))).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>{selected && <div className="ig-selected-model"><img src={selected.image} alt=""/><strong>{selected.name}</strong></div>}<p>A escolha é definitiva após o resgate. Modelos já adquiridos e peças em preparação não podem ser resgatados.</p><button className="button primary" disabled={busy || !selected || !data.campaign.active || Date.parse(data.coupon.expiresAt) < Date.now()}>Usar cupom neste modelo · grátis</button></form>}</div> : <><p>Com as etapas concluídas, clique para conferir as regras e liberar seu cupom pessoal.</p><button className="button primary" disabled={busy || !data.emailVerified || !data.instagram || !data.campaign.open} onClick={() => action('instagram-promotion/claim', {}, 'Cupom liberado! Escolha o seu modelo abaixo.')}>{busy ? 'Conferindo…' : 'Verificar e gerar meu cupom'}</button>{(!data.emailVerified || !data.instagram) && <p>Confirme seu e-mail e seu Instagram para continuar.</p>}{!data.campaign.open && <p>A emissão ficará disponível quando a campanha estiver aberta.</p>}</>}
        </PromotionStep>
      </div>
      {checks && !data.coupon && <p className="ig-progress-updated">Última consulta: {date(checks.checkedAt)}. As regras serão conferidas novamente ao gerar o cupom.</p>}
    </section>
  </section>;
}
