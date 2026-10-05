const scanButton = document.getElementById('scan');
const cookieButton = document.getElementById('cookies');
const status = document.getElementById('status');
const results = document.getElementById('results');
let activeTab;
let siteUrl;
let found = [];
const cookieOrigins = [
  'https://monev.maganghub.kemnaker.go.id/*',
  'https://monev-api.maganghub.kemnaker.go.id/*'
];
const reloadHint = 'Izin API belum tersedia pada ekstensi yang dimuat. Buka chrome://extensions atau edge://extensions, klik Reload pada Monev Token Helper. Jika tetap gagal, hapus lalu Load unpacked kembali dari folder monev-token-extension/monev-token-extension yang berisi manifest.json.';

function tokenKey(key) {
  return /^(?:monev)?(?:refresh|access)token$/.test(key.toLowerCase().replace(/[^a-z0-9]/g, ''));
}

function render() {
  results.replaceChildren();
  for (const token of found) {
    const card = document.createElement('section');
    card.className = 'result';
    const title = document.createElement('h2');
    title.textContent = token.name;
    const source = document.createElement('div');
    source.className = 'source';
    source.textContent = token.source;
    const value = document.createElement('textarea');
    value.readOnly = true;
    value.rows = 3;
    value.setAttribute('aria-label', `Nilai ${token.name}`);
    value.value = '•••••••• (klik Tampilkan untuk melihat)';
    const reveal = document.createElement('button');
    reveal.className = 'secondary';
    reveal.textContent = 'Tampilkan';
    let visible = false;
    reveal.addEventListener('click', () => {
      visible = !visible;
      value.value = visible ? token.value : '•••••••• (klik Tampilkan untuk melihat)';
      reveal.textContent = visible ? 'Sembunyikan' : 'Tampilkan';
    });
    const copy = document.createElement('button');
    copy.textContent = 'Salin token';
    copy.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(token.value);
        status.textContent = `${token.name} disalin.`;
      } catch { status.textContent = 'Gagal menyalin. Tampilkan token dan salin secara manual.'; }
    });
    card.append(title, source, value, reveal, copy);
    results.append(card);
  }
}

async function scan(includeCookies) {
  scanButton.disabled = cookieButton.disabled = true;
  // Keep previous results while permission prompts/errors are handled.
  status.textContent = 'Mencari token…';
  const warnings = [];
  try {
    // Request must originate from this button gesture, before other asynchronous work.
    let cookieAccess = false;
    if (includeCookies) {
      const loadedManifest = chrome.runtime.getManifest();
      const declared = [...(loadedManifest.optional_host_permissions || []), ...(loadedManifest.host_permissions || [])];
      if (!cookieOrigins.every(origin => declared.includes(origin))) {
        warnings.push(reloadHint);
      } else {
        try {
          cookieAccess = await chrome.permissions.request({origins: cookieOrigins});
          if (!cookieAccess) warnings.push('Izin cookies ditolak. Access token tetap dapat dicari.');
        } catch (error) {
          warnings.push(/manifest|permissions specified/i.test(error.message || '') ? reloadHint :
            'Permintaan izin cookies gagal. Periksa izin situs di halaman pengaturan ekstensi, lalu coba kembali.');
        }
      }
    }
    const current = await chrome.tabs.get(activeTab.id);
    if (current.url !== activeTab.url) throw new Error('Halaman berubah. Tutup lalu buka kembali popup.');
    if (!includeCookies) found = [];
    try {
      const injected = await chrome.scripting.executeScript({
        target: {tabId: activeTab.id}, func: scanTokenStorage
      });
      const data = injected[0]?.result;
      if (data) { found.push(...data.tokens); warnings.push(...data.warnings); }
      else warnings.push('Penyimpanan halaman tidak memberikan hasil.');
    } catch { warnings.push('Penyimpanan halaman tidak dapat dibaca. Coba buka kembali popup.'); }
    try {
      const injected = await chrome.scripting.executeScript({
        target: {tabId: activeTab.id}, world: 'MAIN', func: scanMonevMemory
      });
      const data = injected[0]?.result;
      if (data) { found.push(...data.tokens); warnings.push(...data.warnings); }
    } catch { warnings.push('Memori aplikasi tidak dapat dibaca.'); }
    if (cookieAccess) {
      try {
        const stores = await chrome.cookies.getAllCookieStores();
        const store = stores.find((item) => item.tabIds.includes(activeTab.id));
        if (!store) throw new Error('Cookie store tidak ditemukan.');
        // Domain filtering also finds refresh cookies scoped to /api/v1/auth.
        const cookies = await chrome.cookies.getAll({domain: 'maganghub.kemnaker.go.id', storeId: store.id});
        for (const cookie of cookies) {
          if (tokenKey(cookie.name) && cookie.value) {
            found.push({name: cookie.name, value: cookie.value,
              source: `Cookie: ${cookie.domain}${cookie.path}${cookie.httpOnly ? ' (HttpOnly)' : ''}`});
          }
        }
      } catch { warnings.push('Cookies tidak dapat dibaca. Periksa izin situs ekstensi.'); }
    }
    found = found.filter((token, index, all) => all.findIndex(other =>
      other.name === token.name && other.value === token.value && other.source === token.source) === index);
    render();
    if (cookieAccess && !found.some(token => /refresh/i.test(token.name))) {
      warnings.push('Cookies berhasil dibaca, tetapi refresh token tidak ditemukan pada sesi ini.');
    }
    status.textContent = (found.length ? `${found.length} token ditemukan.` :
      'Token belum ditemukan. Pastikan dashboard selesai dimuat dan sudah login. Klik Cari refresh token + cookies API dan izinkan kedua domain.') +
      (warnings.length ? ` ${warnings.join(' ')}` : '');
  } catch (error) { status.textContent = error.message || 'Pencarian gagal.'; }
  finally { scanButton.disabled = cookieButton.disabled = false; }
}

scanButton.addEventListener('click', () => scan(false));
cookieButton.addEventListener('click', () => scan(true));

async function initialize() {
  try {
    const manifest = chrome.runtime.getManifest();
    document.getElementById('version').textContent = `v${manifest.version}`;
    [activeTab] = await chrome.tabs.query({active: true, currentWindow: true});
    siteUrl = new URL(activeTab?.url);
    if (siteUrl.origin !== 'https://monev.maganghub.kemnaker.go.id') throw new Error('Buka situs Monev terlebih dahulu.');
    document.getElementById('site').textContent = siteUrl.origin;
    scanButton.disabled = cookieButton.disabled = false;
    const declared = [...(manifest.optional_host_permissions || []), ...(manifest.host_permissions || [])];
    status.textContent = cookieOrigins.every(origin => declared.includes(origin)) ?
      'Siap mencari token di tab ini.' : reloadHint;
  } catch {
    document.getElementById('site').textContent = 'Tab ini tidak didukung.';
    status.textContent = 'Buka https://monev.maganghub.kemnaker.go.id/dashboard, login, lalu klik ekstensi kembali.';
  }
}
initialize();
