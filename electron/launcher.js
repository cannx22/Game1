// Açılış ekranı: sunucuya bağlanma ve bu bilgisayarda sunucu açma.
const $ = id => document.getElementById(id);
const api = window.civciv;

function msg(id, text, bad = false) {
  $(id).textContent = text;
  $(id).className = `msg${bad ? ' bad' : ''}`;
}

function addrRow(label, value) {
  const row = document.createElement('div');
  row.className = 'addr';
  const code = document.createElement('code');
  const small = document.createElement('small');
  small.textContent = label;
  code.append(small, value);
  const btn = document.createElement('button');
  btn.className = 'btn';
  btn.textContent = '📋 Kopyala';
  btn.onclick = async () => { await api.copy(value); btn.textContent = '✔ Kopyalandı'; };
  row.append(code, btn);
  return row;
}

function showHosting(h) {
  $('host-buttons').classList.add('hidden');
  $('host-info').classList.remove('hidden');
  const box = $('host-addrs');
  box.innerHTML = '';
  if (h.url) box.append(addrRow('İnternet linki — arkadaşlarına bunu gönder:', h.url));
  for (const ip of h.lan || []) box.append(addrRow('Aynı Wi-Fi için adres:', `${ip}:${h.port}`));
  $('add-net').classList.toggle('hidden', !!h.url);
  msg('host-msg', h.url ? 'Sunucu açık! Linki arkadaşlarına gönder, sonra "Oyuna gir"e bas.' : 'Sunucu açık. Aynı ağdaki arkadaşların yukarıdaki adresle bağlanabilir.');
}

async function host(internet) {
  for (const b of document.querySelectorAll('#host-buttons button, #add-net')) b.disabled = true;
  const r = await api.host(internet);
  for (const b of document.querySelectorAll('#host-buttons button, #add-net')) b.disabled = false;
  if (r.error) {
    msg('host-msg', `Hata: ${r.error}`, true);
    const s = await api.state();
    if (s.hosting) showHosting(s.hosting);
    return;
  }
  showHosting(r);
}

async function connect() {
  $('connect').disabled = true;
  msg('connect-msg', 'Bağlanılıyor…');
  const r = await api.connect($('addr').value);
  $('connect').disabled = false;
  if (r.error) msg('connect-msg', r.error, true);
}

api.onStatus(text => msg('host-msg', text));
$('connect').onclick = connect;
$('addr').onkeydown = e => { if (e.key === 'Enter') connect(); };
$('host-net').onclick = () => host(true);
$('host-lan').onclick = () => host(false);
$('add-net').onclick = () => host(true);
$('play').onclick = () => api.playLocal();

// Startup with a built-in server address: connect right away, show the options only if that fails.
async function autoConnect() {
  $('cards').classList.add('hidden');
  $('auto').classList.remove('hidden');
  for (const id of ['auto-retry', 'auto-other']) $(id).classList.add('hidden');
  $('auto-title').textContent = '🐣 Çiftliğe bağlanılıyor…';
  $('auto-msg').textContent = 'Sunucuya bağlanılıyor, lütfen bekle.';
  const r = await api.connect('default');
  if (!r.error) return;
  $('auto-title').textContent = '😕 Sunucuya ulaşılamadı';
  $('auto-msg').textContent = 'İnternet bağlantını kontrol et. Sunucu kapalı ya da bakımda olabilir.';
  for (const id of ['auto-retry', 'auto-other']) $(id).classList.remove('hidden');
}
$('auto-retry').onclick = autoConnect;
$('auto-other').onclick = () => { $('auto').classList.add('hidden'); $('cards').classList.remove('hidden'); };

api.state().then(s => {
  $('addr').value = s.cfg.lastServer || s.cfg.defaultServer || '';
  $('ver').textContent = `sürüm ${s.version}`;
  if (s.hosting) showHosting(s.hosting);
  if (new URLSearchParams(location.search).get('auto') === '1' && s.cfg.defaultServer && !s.hosting) autoConnect();
});
