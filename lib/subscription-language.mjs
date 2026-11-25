const supported = new Set(['pt', 'en', 'es', 'fr']);

export function subscriptionLanguage(acceptLanguage = '') {
  const preferences = String(acceptLanguage).split(',').map((entry, index) => {
    const [tag, ...parameters] = entry.trim().toLowerCase().split(';');
    const quality = parameters.find(value => /^\s*q\s*=/.test(value));
    const q = quality === undefined ? 1 : Number(quality.split('=')[1].trim() || NaN);
    return {lang: tag.split('-')[0], q, index};
  }).filter(({lang, q}) => supported.has(lang) && Number.isFinite(q) && q > 0 && q <= 1);
  preferences.sort((a, b) => b.q - a.q || a.index - b.index);
  return preferences[0]?.lang || 'en';
}
