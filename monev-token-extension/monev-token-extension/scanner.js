/* Self-contained: Chrome serializes this function when executing in the active tab. */
function scanTokenStorage() {
  const tokens = [];
  const warnings = [];
  const isTokenKey = (key) => /^(?:monev)?(?:refresh|access)(?:token)$/.test(key.toLowerCase().replace(/[^a-z0-9]/g, ''));
  function walk(value, key, source, depth) {
    if (depth > 8 || value === null) return;
    if (typeof value === 'string' && isTokenKey(key) && value.trim()) {
      tokens.push({name: key, value: value.trim(), source});
      return;
    }
    if (typeof value === 'object') {
      for (const [childKey, child] of Object.entries(value)) {
        walk(child, childKey, `${source}.${childKey}`, depth + 1);
      }
    }
  }
  for (const storageName of ['localStorage', 'sessionStorage']) {
    try {
      const storage = window[storageName];
      for (let index = 0; index < storage.length; index++) {
        const key = storage.key(index);
        const raw = storage.getItem(key);
        let parsed;
        try { parsed = JSON.parse(raw); } catch { parsed = raw; }
        walk(parsed, key, `${storageName}: ${key}`, 0);
      }
    } catch { warnings.push(`${storageName} tidak dapat dibaca.`); }
  }
  return {tokens, warnings};
}

/* Read the known Nuxt useState slot; no API calls or session refresh. */
function scanMonevMemory() {
  if (window.location.origin !== 'https://monev.maganghub.kemnaker.go.id') {
    return {tokens: [], warnings: ['Halaman bukan situs Monev.']};
  }
  const tokens = [];
  const warnings = [];
  try {
    const root = document.getElementById('__nuxt');
    const app = root?.__vue_app__;
    const nuxt = app?.$nuxt || app?.config?.globalProperties?.$nuxt;
    const states = [nuxt?.payload?.state, window.__NUXT__?.state];
    for (const state of states) {
      for (const key of ['$smonev-access-token', 'monev-access-token']) {
        const slot = state?.[key];
        const value = typeof slot === 'string' ? slot : slot?.value;
        if (typeof value === 'string' && value.trim() && !tokens.some(t => t.value === value.trim())) {
          tokens.push({name: 'monev_access_token', value: value.trim(), source: `Memori Nuxt: ${key}`});
        }
      }
    }
  } catch { warnings.push('Memori aplikasi tidak dapat dibaca.'); }
  return {tokens, warnings};
}
