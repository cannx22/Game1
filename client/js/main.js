// İstemci: menüler, lobi, ağ, hareket, etkileşim, toplantı ve maç sonu akışı.
import { io } from '/vendor/socket.io/socket.io.esm.min.js';
import { World, Preview } from './world.js';
import { sfx, audioSettings } from './audio.js';
import { openMinigame } from './minigames.js';
import {
  COLORS, HATS, EMOTES, SETTING_LIMITS, GAME, TASK_DEFS, SAB_DEFS, END_REASONS,
  colorById, defaultImpostors, maxImpostors,
} from '/shared/constants.js';
import {
  STATIONS, TUNNELS, DOORS, BUILDINGS, FENCES, ZONES, BOUNDS, PUDDLES, PUDDLE_R,
  activeColliders, slideMove, zoneAt, zoneById,
} from '/shared/map.js';

const $ = id => document.getElementById(id);
const h = (tag, cls = '', text = '') => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== '') e.textContent = text;
  return e;
};
const dot = color => {
  const d = h('span', 'dot');
  d.style.background = colorById(color).hex;
  return d;
};
const store = {
  get(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } },
};
const session = {
  get() { try { return JSON.parse(sessionStorage.getItem('ck_session')); } catch { return null; } },
  set(v) { try { if (v) sessionStorage.setItem('ck_session', JSON.stringify(v)); else sessionStorage.removeItem('ck_session'); } catch { /* ignore */ } },
};

const profile = Object.assign({ name: '', color: 'sari', hat: 'none' }, store.get('ck_profile', {}));
const gfx = Object.assign({ shadows: true }, store.get('ck_gfx', {}));
const saveProfile = () => store.set('ck_profile', profile);

const world = new World($('world'), { shadows: gfx.shadows });
let demoOn = null;
const setDemo = on => { if (demoOn !== on) { demoOn = on; world.setDemo(on); } };
setDemo(true);

const previews = new Set();
const S = { screen: 'menu', me: null, lobby: null, G: null };
// read-only debugging handle (used by the automated browser test); holds nothing the client doesn't already know
window.__ck = { S, world };

// ---------------------------------------------------------------- networking
const socket = io({ transports: ['websocket', 'polling'] });
const emit = (ev, d = {}) => new Promise(res => {
  socket.timeout(8000).emit(ev, d, (err, r) => res(err ? { error: 'Sunucu yanıt vermedi.' } : (r || { ok: true })));
});

socket.on('connect', async () => {
  $('conn').classList.add('hidden');
  const sess = session.get();
  if (sess && sess.token) {
    const r = await emit('resume', { token: sess.token });
    if (r.ok) {
      S.me = { id: r.id, token: r.token, code: r.code };
      S.lobby = r.state;
      // if a match is running the server follows up with game:sync; otherwise show the lobby
      const onEndScreen = !$('end').classList.contains('hidden');
      if (r.state.phase === 'lobby' && !onEndScreen && S.screen !== 'lobby') { S.G = null; showScreen('lobby'); }
      if (S.screen === 'menu') showScreen('lobby');
      renderLobby();
      return;
    }
    session.set(null);
    if (S.screen !== 'menu') { toast('Oturum sona erdi, ana menüye dönüldü.', 'bad'); backToMenu(); }
  }
  const code = new URLSearchParams(location.search).get('oda');
  if (code && S.screen === 'menu' && !S.me) openJoin(code);
});
socket.on('disconnect', () => $('conn').classList.remove('hidden'));

// ---------------------------------------------------------------- ui helpers
function toast(text, kind = '', ms = 2600) {
  const t = h('div', `toast ${kind}`, text);
  $('toasts').append(t);
  setTimeout(() => t.remove(), ms);
  while ($('toasts').children.length > 4) $('toasts').firstChild.remove();
}
function flash(red = false) {
  const f = $('flash');
  f.classList.toggle('red', red);
  f.style.transition = 'none';
  f.style.opacity = '0.7';
  requestAnimationFrame(() => { f.style.transition = 'opacity .6s'; f.style.opacity = '0'; });
}

function showScreen(name) {
  for (const s of ['menu', 'lobby', 'game']) $(`scr-${s}`).classList.toggle('hidden', s !== name);
  S.screen = name;
  setDemo(name !== 'game');
  if (name !== 'game') { $('vision').style.background = 'none'; world.showTunnels(false); }
  placeChat();
}

function placeChat() {
  let slot = null;
  if (S.screen === 'lobby') slot = $('lobby-chat-slot');
  else if (S.screen === 'game') slot = $('meeting').classList.contains('hidden') ? $('hud-chat-slot') : $('meeting-chat-slot');
  if (slot) { slot.appendChild($('chat')); $('chat').classList.remove('hidden'); } else $('chat').classList.add('hidden');
}

function addChat(m) {
  const log = $('chat-log');
  const d = h('div', 'msg');
  if (m.sys) {
    d.classList.add('sys');
    d.textContent = m.text;
  } else {
    if (m.ch === 'ghost') { d.classList.add('ghost'); d.append(h('span', 'ch', '👻 hayalet')); }
    const c = dot(m.color);
    c.style.cssText += 'width:12px;height:12px;display:inline-block;vertical-align:middle;margin-right:4px;border-width:2px';
    d.append(c, h('b', '', `${m.name}:`), document.createTextNode(m.text));
  }
  const atBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 40;
  log.append(d);
  while (log.children.length > 200) log.firstChild.remove();
  if (atBottom) log.scrollTop = log.scrollHeight;
  if (!m.sys && S.screen === 'game') sfx.chirp();
}

$('chat-form').addEventListener('submit', async e => {
  e.preventDefault();
  const input = $('chat-input');
  const text = input.value.trim();
  if (!text) return;
  const r = await emit('chat', { text });
  if (r.error) return toast(r.error, 'bad');
  input.value = '';
  if (S.screen === 'game' && $('meeting').classList.contains('hidden')) input.blur();
});

// ---------------------------------------------------------------- modals
function openModal(title, build) {
  $('modal-title').textContent = title;
  const body = $('modal-body');
  body.innerHTML = '';
  for (const p of previews) if (p.modal) previews.delete(p);
  build(body);
  $('modal').classList.remove('hidden');
}
function closeModal() {
  $('modal').classList.add('hidden');
  for (const p of previews) if (p.modal) previews.delete(p);
}
$('modal-close').onclick = closeModal;

const SETTING_UI = [
  ['maxPlayers', 'Maksimum oyuncu', 'num', 1],
  ['impostors', 'Hain sayısı', 'num', 1],
  ['tasks', 'Oyuncu başına görev', 'num', 1],
  ['discussion', 'Tartışma süresi (sn)', 'num', 5],
  ['voting', 'Oylama süresi (sn)', 'num', 5],
  ['emergencies', 'Acil toplantı hakkı', 'num', 1],
  ['killCooldown', 'Bayıltma bekleme süresi (sn)', 'num', 5],
  ['confirmEjects', 'Elenenin rolü açıklansın', 'bool'],
  ['criticalWin', 'Kritik sabotajla kazanma', 'bool'],
  ['playChat', 'Maç sırasında yazılı sohbet', 'bool'],
  ['anonVotes', 'Gizli oylama', 'bool'],
];

// editable=false renders read-only values
function buildSettings(container, values, editable, onChange, playerCount) {
  container.innerHTML = '';
  for (const [key, label, kind, step] of SETTING_UI) {
    const l = h('label', '', label);
    if (key === 'impostors' && playerCount) l.append(h('span', 'muted small-text', ` (önerilen ${defaultImpostors(playerCount)}, en fazla ${maxImpostors(playerCount)})`));
    container.append(l);
    if (!editable) {
      container.append(h('span', 'val', kind === 'bool' ? (values[key] ? 'Açık' : 'Kapalı') : String(values[key])));
      continue;
    }
    const input = h('input');
    if (kind === 'bool') {
      input.type = 'checkbox';
      input.checked = !!values[key];
      input.onchange = () => onChange({ [key]: input.checked });
    } else {
      const [lo, hi] = SETTING_LIMITS[key];
      Object.assign(input, { type: 'number', min: lo, max: hi, step, value: values[key] });
      input.onchange = () => {
        const v = Math.max(lo, Math.min(hi, Math.round(Number(input.value) || lo)));
        input.value = v;
        onChange({ [key]: v });
      };
    }
    container.append(input);
  }
}

function playerName() {
  let n = ($('menu-name').value || profile.name || '').trim();
  if (!n) n = `Civciv${Math.floor(100 + Math.random() * 900)}`;
  profile.name = n.slice(0, 14);
  $('menu-name').value = profile.name;
  saveProfile();
  return profile.name;
}

async function enterRoom(r) {
  if (r.error) { toast(r.error, 'bad'); return false; }
  S.me = { id: r.id, token: r.token, code: r.code };
  S.lobby = r.state;
  session.set({ token: r.token, code: r.code });
  history.replaceState(null, '', location.pathname);
  closeModal();
  $('chat-log').innerHTML = '';
  addChat({ sys: true, text: `Odaya katıldın. Oda kodu: ${r.code} — arkadaşlarına gönder!` });
  showScreen('lobby');
  renderLobby();
  sfx.peep();
  return true;
}

function openCreate() {
  playerName();
  openModal('Oda oluştur', body => {
    const values = { ...store.get('ck_room_settings', {}) };
    const form = h('div', 'settings-form');
    form.append(h('label', '', 'Oda adı'));
    const name = h('input');
    name.maxLength = 24;
    name.value = `${profile.name} çiftliği`;
    form.append(name);
    form.append(h('label', '', 'Herkese açık oda (listede görünür)'));
    const pub = h('input');
    pub.type = 'checkbox';
    form.append(pub);
    const s = h('div', 'settings-form');
    const defaults = { maxPlayers: 10, impostors: 1, tasks: 5, discussion: 30, voting: 30, emergencies: 1, killCooldown: 25, confirmEjects: true, criticalWin: true, playChat: true, anonVotes: false };
    Object.assign(defaults, values);
    buildSettings(s, defaults, true, v => Object.assign(defaults, v));
    const go = h('button', 'btn primary big', '🏠 Odayı oluştur');
    go.onclick = async () => {
      go.disabled = true;
      store.set('ck_room_settings', defaults);
      const r = await emit('room:create', { name: name.value, isPublic: pub.checked, profile, settings: defaults });
      go.disabled = false;
      enterRoom(r);
    };
    body.append(form, h('h3', '', 'Oyun ayarları'), s, h('div', 'row center'));
    body.lastChild.append(go);
  });
}

function openJoin(code = '') {
  openModal('Odaya katıl', body => {
    body.append(h('p', 'muted', 'Arkadaşının sana verdiği 5 haneli oda kodunu yaz.'));
    const input = h('input', 'room-code');
    input.maxLength = 5;
    input.value = code.toUpperCase();
    input.style.cssText = 'width:100%;text-align:center;text-transform:uppercase';
    input.placeholder = 'ABCDE';
    const go = h('button', 'btn primary big', 'Katıl');
    const err = h('div', 'banner hidden');
    const join = async () => {
      playerName();
      go.disabled = true;
      const r = await emit('room:join', { code: input.value, profile });
      go.disabled = false;
      if (r.error) { err.textContent = r.error; err.classList.remove('hidden'); return; }
      enterRoom(r);
    };
    go.onclick = join;
    input.onkeydown = e => { if (e.key === 'Enter') join(); };
    const retry = h('button', 'btn', '🔄 Yeniden dene');
    retry.onclick = join;
    body.append(input, err, h('div', 'row center'));
    body.lastChild.append(go, retry);
    setTimeout(() => input.focus(), 50);
  });
}

function openPublic() {
  openModal('Açık odalar', body => {
    const list = h('div', 'public-list');
    const refresh = async () => {
      list.innerHTML = '';
      list.append(h('div', 'muted', 'Yükleniyor…'));
      const rooms = await emit('room:list');
      list.innerHTML = '';
      if (!Array.isArray(rooms) || !rooms.length) {
        list.append(h('p', 'muted', 'Şu an açık oda yok. Kendi odanı oluşturup arkadaşlarına kodu gönderebilirsin.'));
        return;
      }
      for (const r of rooms) {
        const it = h('div', 'item');
        it.append(h('b', '', r.name), h('span', 'muted', `${r.count}/${r.max} · ${r.phase === 'lobby' ? 'lobide' : 'maçta'}`));
        const b = h('button', 'btn primary small', 'Katıl');
        b.disabled = r.count >= r.max;
        b.onclick = async () => { playerName(); enterRoom(await emit('room:join', { code: r.code, profile })); };
        it.append(b);
        list.append(it);
      }
    };
    const rf = h('button', 'btn', '🔄 Yenile');
    rf.onclick = refresh;
    const mk = h('button', 'btn primary', '🏠 Oda oluştur');
    mk.onclick = openCreate;
    body.append(list, h('div', 'row'));
    body.lastChild.append(rf, mk);
    refresh();
  });
}

function openCustom() {
  openModal('Karakter', body => {
    const cv = h('canvas', 'preview');
    body.append(cv);
    const pv = new Preview(cv);
    pv.modal = true;
    previews.add(pv);
    pv.set(profile.color, profile.hat);
    const name = h('input', 'name-input');
    name.maxLength = 14;
    name.value = profile.name;
    name.placeholder = 'Civciv adı';
    name.oninput = () => { profile.name = name.value.trim(); $('menu-name').value = profile.name; saveProfile(); };
    const grid = h('div', 'color-grid');
    const draw = () => {
      grid.innerHTML = '';
      for (const c of COLORS) {
        const b = h('button', profile.color === c.id ? 'mine' : '');
        b.style.background = c.hex;
        b.title = c.name;
        b.onclick = () => { profile.color = c.id; saveProfile(); pv.set(profile.color, profile.hat); draw(); sfx.peep(); };
        grid.append(b);
      }
    };
    draw();
    const hats = h('div', 'hat-grid');
    const drawHats = () => {
      hats.innerHTML = '';
      for (const hat of HATS) {
        const b = h('button', `btn small ${profile.hat === hat.id ? 'active' : ''}`, hat.name);
        b.onclick = () => { profile.hat = hat.id; saveProfile(); pv.set(profile.color, profile.hat); drawHats(); };
        hats.append(b);
      }
    };
    drawHats();
    body.append(h('div', 'row center'), h('h3', '', 'Renk tercihi'), grid, h('h3', '', 'Aksesuar'), hats,
      h('p', 'muted small-text', 'Renk tercihin odada boştaysa sana verilir. Aksesuarlar yalnızca görünüştür, oyunu etkilemez.'));
    body.children[1].append(name);
  });
}

function openSettings() {
  openModal('Ayarlar', body => {
    const form = h('div', 'settings-form');
    form.append(h('label', '', 'Ses düzeyi'));
    const vol = h('input');
    Object.assign(vol, { type: 'range', min: 0, max: 1, step: 0.05, value: audioSettings.volume });
    vol.oninput = () => { audioSettings.volume = Number(vol.value); sfx.peep(); };
    form.append(vol, h('label', '', 'Sesleri kapat'));
    const mute = h('input');
    mute.type = 'checkbox';
    mute.checked = audioSettings.muted;
    mute.onchange = () => { audioSettings.muted = mute.checked; };
    form.append(mute, h('label', '', 'Gölgeler (kapatmak performansı artırır)'));
    const sh = h('input');
    sh.type = 'checkbox';
    sh.checked = gfx.shadows;
    sh.onchange = () => { gfx.shadows = sh.checked; store.set('ck_gfx', gfx); world.setShadows(sh.checked); };
    form.append(sh);
    body.append(form, h('p', 'muted small-text', 'Oyunda sesli sohbet yoktur; yalnızca oyunun kendi efekt sesleri çalar.'));
    if (S.me) {
      const leave = h('button', 'btn danger', S.G ? '🚪 Maçtan ve odadan çık' : '🚪 Odadan ayrıl');
      leave.onclick = () => { if (!S.G || confirm('Maçtan çıkmak istediğine emin misin?')) leaveRoom(); };
      body.append(h('div', 'row'));
      body.lastChild.append(leave);
    }
  });
}

function openHowto() {
  openModal('Nasıl oynanır?', body => {
    body.innerHTML = `
      <p><b>Civciv Kıyameti</b> bir gizli hain oyunudur. Herkes civcivdir ama aranızda gizlice <b style="color:#e63946">hainler</b> var!</p>
      <h3>🐤 Masumsan</h3>
      <ul><li>Sol üstteki görevlerini yap (sarı ünlemli yerler). Ortak çubuk dolarsa kazanırsınız.</li>
      <li>Baygın bir civciv bulursan <b>Rapor</b> et ya da avludaki <b>zili</b> çal.</li>
      <li>Toplantıda yazışarak tartışın ve haini oylayarak çiftlikten uzaklaştırın.</li></ul>
      <h3>😈 Hainsen</h3>
      <ul><li>Masumların arasına karış; sahte görev yap (ilerleme sağlamaz).</li>
      <li>Yakındaki bir masumu <b>bayılt</b>, <b>sabotaj</b> yap, gizli <b>geçitlerden</b> kaç.</li>
      <li>Hain sayısı masumlara yetişirse ya da kritik bir sabotaj çözülmezse kazanırsınız.</li></ul>
      <h3>⌨️ Kontroller</h3>
      <ul><li><b>WASD / Ok tuşları</b> ya da <b>farenin sol tuşunu basılı tutarak</b> yürü</li>
      <li><b>E</b> kullan · <b>R</b> rapor · <b>Q</b> bayılt · <b>F</b> sabotaj · <b>V</b> geçit</li>
      <li><b>Boşluk</b> zıpla · <b>1–7</b> ifadeler · <b>Enter</b> sohbet · <b>M</b> büyük harita · <b>Esc</b> kapat</li></ul>
      <p class="muted">Bayılan oyuncular hayalet olur: görev yapabilir ama canlılarla konuşamaz ve oy veremez. Oyunda sesli sohbet yoktur — yazılı sohbeti kullanın.</p>`;
  });
}

$('menu-name').value = profile.name;
$('menu-name').oninput = () => { profile.name = $('menu-name').value.trim(); saveProfile(); };
$('btn-create').onclick = openCreate;
$('btn-join').onclick = () => openJoin();
$('btn-play').onclick = openPublic;
$('btn-custom').onclick = openCustom;
$('btn-settings').onclick = openSettings;
$('btn-howto').onclick = openHowto;
$('btn-hud-settings').onclick = openSettings;

// ---------------------------------------------------------------- lobby
const lobbyPreview = new Preview($('preview'));
previews.add(lobbyPreview);
let previewKey = '';

for (const hat of HATS) {
  const o = h('option', '', hat.name);
  o.value = hat.id;
  $('lobby-hat').append(o);
}
$('lobby-hat').onchange = async () => {
  profile.hat = $('lobby-hat').value;
  saveProfile();
  const r = await emit('lobby:profile', { hat: profile.hat });
  if (r.error) toast(r.error, 'bad');
};
$('lobby-name-input').onchange = async () => {
  const name = $('lobby-name-input').value.trim();
  if (!name) return;
  profile.name = name;
  saveProfile();
  await emit('lobby:profile', { name });
};
$('btn-ready').onclick = () => {
  const me = S.lobby && S.lobby.players.find(p => p.id === S.me.id);
  emit('lobby:ready', { ready: !(me && me.ready) });
  sfx.click();
};
$('btn-start').onclick = async () => {
  const r = await emit('game:start');
  if (r.error) toast(r.error, 'bad', 4000);
};
$('btn-leave').onclick = leaveRoom;
$('btn-copy-code').onclick = () => copy(S.lobby.code, 'Oda kodu kopyalandı!');
$('btn-copy-link').onclick = () => copy(`${location.origin}/?oda=${S.lobby.code}`, 'Davet linki kopyalandı! Arkadaşlarına gönder.');

function copy(text, msg) {
  const done = () => toast(msg, 'good');
  if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done, () => prompt('Kopyala:', text));
  else prompt('Kopyala:', text);
}

async function leaveRoom() {
  await emit('room:leave');
  session.set(null);
  backToMenu();
}

function backToMenu() {
  S.me = null;
  S.lobby = null;
  S.G = null;
  closeModal();
  for (const id of ['intro', 'dead', 'task', 'meeting', 'end']) $(id).classList.add('hidden');
  $('chat-log').innerHTML = '';
  showScreen('menu');
}

socket.on('room:state', st => {
  S.lobby = st;
  if (S.screen === 'lobby') renderLobby();
});

function renderLobby() {
  const L = S.lobby;
  if (!L || !S.me) return;
  const me = L.players.find(p => p.id === S.me.id);
  if (!me) return;
  const isHost = L.host === S.me.id;
  $('lobby-code').textContent = L.code;
  $('lobby-name').textContent = `${L.name} · ${L.isPublic ? 'herkese açık' : 'özel oda'}`;
  $('lobby-count').textContent = `(${L.players.length}/${L.settings.maxPlayers})`;
  $('lobby-wait').classList.toggle('hidden', L.phase !== 'game');

  const list = $('lobby-players');
  list.innerHTML = '';
  for (const p of L.players) {
    const li = h('li', p.connected ? '' : 'off');
    li.append(dot(p.color), h('span', '', `${p.id === L.host ? '👑 ' : ''}${p.name}${p.id === S.me.id ? ' (sen)' : ''}`));
    let tag = p.ready ? 'Hazır' : 'Bekliyor';
    if (!p.connected) tag = 'Bağlantı yok';
    else if (L.phase === 'game') tag = p.waiting ? 'Sırada' : 'Maçta';
    li.append(h('span', `tag ${p.ready && p.connected ? 'ok' : ''}`, tag));
    list.append(li);
  }

  const grid = $('lobby-colors');
  grid.innerHTML = '';
  const taken = new Set(L.players.filter(p => p.id !== me.id).map(p => p.color));
  for (const c of COLORS) {
    const b = h('button', `${taken.has(c.id) ? 'taken' : ''} ${me.color === c.id ? 'mine' : ''}`);
    b.style.background = c.hex;
    b.title = c.name + (taken.has(c.id) ? ' (alınmış)' : '');
    b.onclick = async () => {
      if (taken.has(c.id) || L.phase !== 'lobby') return;
      const r = await emit('lobby:profile', { color: c.id });
      if (r.error) return toast(r.error, 'bad');
      profile.color = c.id;
      saveProfile();
      sfx.peep();
    };
    grid.append(b);
  }
  $('lobby-hat').value = me.hat;
  if (document.activeElement !== $('lobby-name-input')) $('lobby-name-input').value = me.name;
  const key = `${me.color}|${me.hat}`;
  if (key !== previewKey) { previewKey = key; lobbyPreview.set(me.color, me.hat); }

  $('btn-ready').classList.toggle('hidden', isHost || L.phase !== 'lobby');
  $('btn-ready').textContent = me.ready ? '✅ Hazırsın (iptal)' : '✋ Hazırım';
  $('btn-start').classList.toggle('hidden', !isHost || L.phase !== 'lobby');
  const online = L.players.filter(p => p.connected);
  const notReady = online.filter(p => !p.ready);
  let hint = '';
  if (L.phase === 'game') hint = 'Maç sürüyor…';
  else if (online.length < L.minPlayers) hint = `Başlamak için en az ${L.minPlayers} oyuncu gerekli (${online.length}/${L.minPlayers}). Oda kodunu arkadaşlarına gönder!`;
  else if (notReady.length) hint = `Hazır olmayanlar: ${notReady.map(p => p.name).join(', ')}`;
  else hint = isHost ? 'Herkes hazır! Maçı başlatabilirsin.' : 'Herkes hazır, oda sahibinin başlatması bekleniyor.';
  $('start-hint').textContent = hint;

  $('settings-owner').textContent = isHost ? '(sen düzenleyebilirsin)' : '(oda sahibi belirler)';
  const sf = $('lobby-settings');
  if (!sf.contains(document.activeElement)) {
    buildSettings(sf, L.settings, isHost && L.phase === 'lobby', async v => {
      const r = await emit('lobby:settings', v);
      if (r.error) toast(r.error, 'bad');
    }, online.length);
    if (isHost && L.phase === 'lobby') {
      sf.append(h('label', '', 'Herkese açık oda'));
      const pub = h('input');
      pub.type = 'checkbox';
      pub.checked = L.isPublic;
      pub.onchange = () => emit('lobby:settings', { isPublic: pub.checked });
      sf.append(pub);
    }
  }
}

// ---------------------------------------------------------------- game state
const keys = new Set();
const mouse = { down: false, x: 0, y: 0 };

socket.on('game:start', d => onGameStart(d, false));
socket.on('game:sync', d => onGameStart(d, true));

function onGameStart(d, sync) {
  closeModal();
  for (const id of ['end', 'dead', 'task', 'meeting']) $(id).classList.add('hidden');
  S.G = {
    you: d.you, role: d.role, partners: new Set(d.partners), settings: d.settings,
    roster: new Map(d.roster.map(r => [r.id, r])),
    x: d.x, z: d.z, ry: 0, vx: 0, vz: 0, alive: d.alive, phase: d.phase,
    snap: null, me: null, carry: null, lastSend: 0, sent: '', task: null, actions: {},
    meetingKey: '', resultShown: false, myVote: null, taskKey: '', stepT: 0,
  };
  showScreen('game');
  world.setRoster(d.roster, d.you);
  world.updateEntity(d.you, { x: d.x, z: d.z, ry: 0 }, true);
  world.setBodies([]);
  world.showTunnels(d.role === 'imp');
  for (const el of document.querySelectorAll('.imp-only')) el.classList.toggle('hidden', d.role !== 'imp');
  $('role-tag').textContent = d.role === 'imp' ? '😈 HAİNSİN' : '🐤 Masum civcivsin';
  $('role-tag').className = d.role;
  $('ghost-tag').classList.toggle('hidden', d.alive);
  buildEmoteBar();
  buildSabMenu();
  if (!sync) {
    $('chat-log').innerHTML = '';
    showIntro(d);
  } else if (d.phase === 'meeting') {
    openMeeting(null);
  }
  placeChat();
}

function showIntro(d) {
  const box = $('intro');
  box.className = `overlay ${d.role}`;
  $('intro-role').textContent = d.role === 'imp' ? 'HAİN' : 'MASUM';
  $('intro-desc').textContent = d.role === 'imp'
    ? 'Masumların arasına karış, onları bayılt ve sabotaj yap. Yakalanma!'
    : `Görevlerini tamamla ve hainleri bul. Aranızda ${d.impCount} hain var.`;
  const team = $('intro-team');
  team.innerHTML = '';
  const ids = d.role === 'imp' ? [d.you, ...d.partners] : [d.you];
  for (const id of ids) {
    const r = d.roster.find(x => x.id === id);
    const m = h('div', 'mate');
    m.append(dot(r.color), h('span', '', r.name));
    team.append(m);
  }
  sfx.role(d.role === 'imp');
  setTimeout(() => box.classList.add('hidden'), Math.max(1500, d.introLeft || 4000));
}

socket.on('roster', list => {
  const G = S.G;
  if (!G) return;
  G.roster = new Map(list.map(r => [r.id, r]));
  world.setRoster(list, G.you);
});

socket.on('s', s => {
  const G = S.G;
  if (!G) return;
  const prev = G.phase;
  G.snap = s;
  G.phase = s.ph;
  G.me = s.me;
  if (G.alive && !s.me.alive) becomeGhost();
  G.alive = s.me.alive;
  G.carry = s.me.carry || null;
  if (s.pl) {
    const seen = new Set();
    for (const [id, x, z, ry, m, b, c, gh] of s.pl) {
      seen.add(id);
      if (id === G.you) continue;
      world.updateEntity(id, { x, z, ry, moving: !!m, busy: !!b, carry: c || null, ghost: !!gh });
    }
    for (const id of G.roster.keys()) if (id !== G.you && !seen.has(id)) world.hideEntity(id);
  }
  if (s.bd) world.setBodies(s.bd.map(([id, x, z]) => ({ id, x, z, color: (G.roster.get(id) || {}).color })));
  world.setSabotage(s.sab, s.doors || [], G.role === 'imp');
  if (s.ph === 'meeting') {
    if ($('meeting').classList.contains('hidden')) openMeeting(null);
    if (s.mt) updateMeeting(s.mt);
  } else if (prev === 'meeting') closeMeeting();
  updateHud();
});

socket.on('tp', d => { if (S.G) { S.G.x = d.x; S.G.z = d.z; S.G.vx = S.G.vz = 0; } });
socket.on('correct', d => { if (S.G) { S.G.x = d.x; S.G.z = d.z; S.G.vx = S.G.vz = 0; } });

socket.on('killed', d => {
  const G = S.G;
  if (!G) return;
  closeTask();
  becomeGhost();
  const k = G.roster.get(d.by);
  $('dead-by').textContent = k ? `${k.name} seni bayılttı!` : '';
  $('dead').classList.remove('hidden');
  flash(true);
  sfx.poof();
  setTimeout(() => $('dead').classList.add('hidden'), 3200);
});

function becomeGhost() {
  const G = S.G;
  if (!G || !G.alive) return;
  G.alive = false;
  G.carry = null;
  $('ghost-tag').classList.remove('hidden');
  world.showTunnels(false);
}

socket.on('fx', d => {
  const G = S.G;
  if (!G || d.type !== 'poof') return;
  const r = G.roster.get(d.id);
  world.poof(d.x, d.z, r ? colorById(r.color).hex : '#ffffff');
  if (Math.hypot(d.x - G.x, d.z - G.z) < 14) sfx.poof();
});

socket.on('emote', d => {
  const em = EMOTES.find(e => e.id === d.e);
  world.emote(d.id, d.e, em ? em.icon : '');
  if (d.e === 'jump' && d.id === (S.G && S.G.you)) sfx.peep();
});

socket.on('farm', ev => {
  const text = world.farmEvent(ev, sfx);
  if (text && S.screen === 'game') toast(text, '', 3500);
});

socket.on('sab', d => {
  const G = S.G;
  if (!G) return;
  const def = SAB_DEFS[d.type];
  sfx.alarm();
  if (d.type === 'alarm') {
    const z = zoneById(d.zone);
    toast(`🚨 ${z ? z.name : 'Bir bölge'} tarafından alarm sesi geliyor!`, 'bad', 4000);
    return;
  }
  flash(true);
  let text = `⚠️ Sabotaj: ${def.name}!`;
  if (d.type === 'doors') text += ` (${BUILDINGS.find(b => b.id === d.target).name} kilitlendi)`;
  toast(text, 'bad', 4000);
});

socket.on('sabEnd', d => {
  if (!S.G || d.type === 'alarm') return;
  if (d.by || d.type === 'doors') { sfx.success(); toast(`✔ ${SAB_DEFS[d.type].name} giderildi.`, 'good'); }
});

socket.on('chat', addChat);
socket.on('voted', () => sfx.vote());

socket.on('meeting', d => {
  const G = S.G;
  if (!G) return;
  openMeeting(d);
});
socket.on('meetingEnd', () => closeMeeting());
socket.on('game:over', showEnd);

// ---------------------------------------------------------------- HUD
function taskLabel(type, step) {
  const def = TASK_DEFS[type];
  if (!def.carry) return def.name;
  return `${def.name} (${step}/2)`;
}

function updateHud() {
  const G = S.G, s = G.snap, me = s.me;
  $('progress-fill').style.width = `${Math.round(s.pr * 100)}%`;
  const lightsOut = s.sab && s.sab.type === 'lights';
  const key = JSON.stringify(me.tasks) + lightsOut + G.alive;
  if (key !== G.taskKey) {
    G.taskKey = key;
    const ul = $('task-list');
    ul.innerHTML = '';
    if (G.role === 'imp') ul.append(h('li', 'muted', 'Sahte görevler (ilerleme sağlamaz):'));
    for (const [, type, step, done] of me.tasks) {
      const def = TASK_DEFS[type];
      const st = STATIONS[def.stations[done ? def.stations.length - 1 : step]];
      const li = h('li', done ? 'done' : (def.power && lightsOut ? 'off' : ''));
      li.append(document.createTextNode(`${done ? '✔' : '•'} ${taskLabel(type, step)} `), h('span', 'z', `— ${zoneById(st.zone).name}${def.power && lightsOut && !done ? ' (elektrik yok)' : ''}`));
      ul.append(li);
    }
  }
  const banner = $('sab-banner');
  if (s.sab && s.sab.type !== 'alarm') {
    const def = SAB_DEFS[s.sab.type];
    let t = `${def.icon} ${def.name}`;
    if (s.sab.type === 'doors') t += `: ${BUILDINGS.find(b => b.id === s.sab.target).name}`;
    if (s.sab.items) t += ` — ${s.sab.total - s.sab.items.length}/${s.sab.total}`;
    if (s.sab.left != null) t += ` — ${Math.ceil(s.sab.left / 1000)} sn`;
    if (s.sab.type === 'lights') t += ' — Garajdaki panoyu onar';
    if (s.sab.type === 'water') t += ' — Su kulesindeki ana boruyu onar';
    banner.textContent = t;
    banner.className = def.critical ? '' : 'calm';
  } else banner.className = 'hidden';
  const alive = [...G.roster.values()].filter(r => !r.dead).length;
  $('alive-count').textContent = `🐤 ${alive}/${G.roster.size}`;
  $('zone-name').textContent = `📍 ${zoneAt(G.x, G.z).name}`;
}

function nearestEntity(filter, range) {
  const G = S.G;
  let best = null, bd = range;
  for (const e of world.entities.values()) {
    if (e.id === G.you || e.demo || !e.model.visible || !filter(e)) continue;
    const d = Math.hypot(e.pos.x - G.x, e.pos.z - G.z);
    if (d <= bd) { bd = d; best = e; }
  }
  return best;
}

function computeActions() {
  const G = S.G, s = G.snap;
  const A = {};
  if (!s || !G.me || G.phase !== 'play') return A;
  const dd = p => Math.hypot(p.x - G.x, p.z - G.z);
  for (const [id, type, step, done] of G.me.tasks) {
    if (done) continue;
    const def = TASK_DEFS[type];
    const st = STATIONS[def.stations[step]];
    const d = dd(st);
    if (d <= GAME.useRange && (!A.use || d < A.use.dist)) {
      A.use = { kind: 'task', id, type, step, dist: d, label: def.carry ? (step === 0 ? 'Al (E)' : 'Bırak (E)') : 'Görev (E)' };
    }
  }
  if (G.alive) {
    if (!A.use && dd(STATIONS.bell) <= GAME.useRange) A.use = { kind: 'bell', label: 'Zil (E)' };
    const sab = s.sab;
    if (sab) {
      if (sab.type === 'lights' && dd(STATIONS.elec) <= GAME.useRange) A.use = { kind: 'fix', label: 'Onar (E)' };
      if (sab.type === 'water' && dd(STATIONS.sabpipe) <= GAME.useRange) A.use = { kind: 'fix', label: 'Onar (E)' };
      if (sab.type === 'doors' && DOORS.some(d => d.b === sab.target && Math.hypot(d.cx - G.x, d.cz - G.z) <= 2.4)) A.use = { kind: 'fix', label: 'Kilit (E)' };
      if (sab.items) {
        for (const [id, x, z] of sab.items) if (dd({ x, z }) <= GAME.useRange) A.use = { kind: 'item', id, label: sab.type === 'feed' ? 'Topla (E)' : 'Yakala (E)' };
      }
    }
    if (s.bd) {
      for (const [id, x, z] of s.bd) if (dd({ x, z }) <= GAME.reportRange) A.report = id;
    }
    if (G.role === 'imp') {
      const t = nearestEntity(e => !e.ghost && !G.partners.has(e.id), GAME.killRange);
      A.killTarget = t ? t.id : null;
      A.kill = G.me.killIn === 0 && !!t;
      A.tunnel = !G.carry && TUNNELS.some(tn => dd(tn) <= GAME.tunnelRange);
    }
  }
  return A;
}

function updateActions() {
  const G = S.G;
  const A = G.actions = computeActions();
  $('act-use').disabled = !A.use || !!G.task;
  $('use-label').textContent = A.use ? A.use.label : 'Kullan (E)';
  $('act-report').disabled = !A.report;
  $('act-report').classList.toggle('hidden', !G.alive);
  if (G.role === 'imp') {
    const me = G.me || {};
    $('act-kill').disabled = !A.kill;
    $('act-kill').querySelector('.cd').textContent = me.killIn > 0 ? Math.ceil(me.killIn / 1000) : '';
    $('act-kill').classList.toggle('hidden', !G.alive);
    $('act-tunnel').disabled = !A.tunnel;
    $('act-tunnel').classList.toggle('hidden', !G.alive);
    const sabBusy = G.snap && G.snap.sab;
    $('act-sab').disabled = G.phase !== 'play' || !!sabBusy || me.sabIn > 0;
    $('act-sab').querySelector('small').textContent = me.sabIn > 0 ? `Sabotaj ${Math.ceil(me.sabIn / 1000)}` : 'Sabotaj (F)';
    world.setTarget(A.kill ? A.killTarget : null);
  }
}

// ---------------------------------------------------------------- actions
async function doUse() {
  const G = S.G;
  const a = G && G.actions.use;
  if (!a || G.task || G.phase !== 'play') return;
  if (a.kind === 'task') {
    const r = await emit('task:open', { taskId: a.id });
    if (r.error) return toast(r.error, 'bad');
    if (r.minigame) openTask({ taskId: a.id, type: a.type, game: r.minigame });
    else if (r.done) {
      sfx.success();
      toast(G.role === 'imp' ? 'Sahte görev tamamlandı (ilerleme yok) 😈' : 'Görev tamamlandı! ✔', 'good');
    } else if (r.step === 1) {
      sfx.pop();
      const def = TASK_DEFS[a.type];
      toast(`${def.carry === 'sack' ? 'Çuvalı' : 'Balyayı'} aldın! ${zoneById(STATIONS[def.stations[1]].zone).name} bölgesine götür.`, 'good', 3500);
    }
  } else if (a.kind === 'bell') {
    const r = await emit('bell');
    if (r.error) toast(r.error, 'bad');
  } else if (a.kind === 'fix') {
    const r = await emit('fix:open', {});
    if (r.error) return toast(r.error, 'bad');
    if (r.minigame) openTask({ fix: true, game: r.minigame });
  } else if (a.kind === 'item') {
    const r = await emit('fix:open', { id: a.id });
    if (r.error) return toast(r.error, 'bad');
    sfx.pop();
  }
}

async function doReport() {
  const G = S.G;
  if (!G || !G.actions.report) return;
  const r = await emit('report', { body: G.actions.report });
  if (r.error) toast(r.error, 'bad');
}

async function doKill() {
  const G = S.G;
  if (!G || !G.actions.kill) return;
  const r = await emit('kill', { target: G.actions.killTarget });
  if (r.error) toast(r.error, 'bad');
}

async function doTunnel() {
  const G = S.G;
  if (!G || !G.actions.tunnel) return;
  const r = await emit('tunnel');
  if (r.error) return toast(r.error, 'bad');
  sfx.whoosh();
}

function doEmote(id) {
  if (!S.G || S.G.phase !== 'play') return;
  emit('emote', { e: id });
  $('emote-bar').classList.add('hidden');
}

function buildEmoteBar() {
  const bar = $('emote-bar');
  bar.innerHTML = '';
  EMOTES.forEach((em, i) => {
    const b = h('button', '', em.icon);
    b.title = `${em.name} (${i + 1})`;
    b.onclick = () => doEmote(em.id);
    bar.append(b);
  });
}

function buildSabMenu() {
  const m = $('sab-menu');
  m.innerHTML = '';
  m.append(h('b', '', '⚡ Sabotaj seç'));
  for (const [type, def] of Object.entries(SAB_DEFS)) {
    if (type === 'doors') {
      m.append(h('div', 'small-text muted', `${def.icon} ${def.name}:`));
      const sub = h('div', 'sub');
      for (const b of BUILDINGS.filter(x => x.lock)) {
        const btn = h('button', 'btn small', b.name);
        btn.onclick = () => startSab('doors', b.id);
        sub.append(btn);
      }
      m.append(sub);
      continue;
    }
    const btn = h('button', 'btn small', `${def.icon} ${def.name}${def.critical ? ' (kritik)' : ''}`);
    btn.title = def.desc;
    btn.onclick = () => startSab(type);
    m.append(btn);
  }
}

async function startSab(type, target) {
  const r = await emit('sabotage', { type, target });
  $('sab-menu').classList.add('hidden');
  if (r.error) toast(r.error, 'bad');
}

$('act-use').onclick = doUse;
$('act-report').onclick = doReport;
$('act-kill').onclick = doKill;
$('act-tunnel').onclick = doTunnel;
$('act-sab').onclick = () => { $('sab-menu').classList.toggle('hidden'); $('emote-bar').classList.add('hidden'); };
$('act-emote').onclick = () => { $('emote-bar').classList.toggle('hidden'); $('sab-menu').classList.add('hidden'); };
$('minimap').onclick = () => $('minimap').classList.toggle('big');

// ---------------------------------------------------------------- task overlay
const FIX_TITLES = { lights: 'Elektrik panosu', pipes: 'Ana su borusu', doorlock: 'Sıkışan kapı kilidi' };

function openTask(ctx) {
  const G = S.G;
  $('sab-menu').classList.add('hidden');
  $('emote-bar').classList.add('hidden');
  const def = ctx.type ? TASK_DEFS[ctx.type] : null;
  $('task-title').textContent = def ? `${def.name}${G.role === 'imp' ? ' (sahte)' : ''}` : FIX_TITLES[ctx.game] || 'Onarım';
  $('task-status').textContent = def ? def.desc : 'Sabotajı gider!';
  $('task').classList.remove('hidden');
  G.task = { ...ctx, openedAt: performance.now(), min: def ? def.min || 0 : 1.1, finishing: false };
  G.task.cleanup = openMinigame(ctx.game, $('task-body'), { sfx, done: finishTask });
}

function finishTask() {
  const G = S.G;
  const T = G && G.task;
  if (!T || T.finishing) return;
  T.finishing = true;
  $('task-status').textContent = 'Tamamlanıyor…';
  const wait = Math.max(0, T.min * 1000 - (performance.now() - T.openedAt) + 200);
  setTimeout(async () => {
    if (S.G !== G || G.task !== T) return;
    const r = await emit(T.fix ? 'fix:done' : 'task:done', { taskId: T.taskId });
    closeTask(false);
    if (r.error) return toast(r.error, 'bad');
    sfx.success();
    if (!T.fix) toast(G.role === 'imp' ? 'Sahte görev bitti 😈 (ilerleme sağlamaz)' : 'Görev tamamlandı! ✔', 'good');
  }, wait);
}

function closeTask(notify = true) {
  const G = S.G;
  if (!G || !G.task) { $('task').classList.add('hidden'); return; }
  try { G.task.cleanup(); } catch { /* ignore */ }
  G.task = null;
  $('task').classList.add('hidden');
  $('task-body').innerHTML = '';
  if (notify) emit('task:close');
}
$('task-close').onclick = () => closeTask();

// ---------------------------------------------------------------- meeting
function openMeeting(d) {
  const G = S.G;
  closeTask();
  $('sab-menu').classList.add('hidden');
  $('emote-bar').classList.add('hidden');
  $('dead').classList.add('hidden');
  $('intro').classList.add('hidden');
  G.myVote = null;
  G.resultShown = false;
  G.meetingKey = '';
  $('meeting-result').classList.add('hidden');
  $('meeting').classList.remove('hidden');
  if (d) {
    const caller = G.roster.get(d.caller);
    const victim = d.body && G.roster.get(d.body);
    $('meeting-title').textContent = d.body ? '📢 Baygın civciv bulundu!' : '🔔 Acil toplantı!';
    const sub = d.body ? `${caller ? caller.name : '?'}, ${victim ? victim.name : '?'} adlı civcivi baygın buldu.` : `${caller ? caller.name : '?'} acil toplantı zilini çaldı.`;
    $('meeting-sub').textContent = sub;
    addChat({ sys: true, text: `— ${sub} —` });
    if (d.body) sfx.meeting(); else sfx.bell();
    flash();
  }
  placeChat();
  if (G.alive) setTimeout(() => $('chat-input').focus(), 100);
}

function closeMeeting() {
  $('meeting').classList.add('hidden');
  placeChat();
}

function updateMeeting(mt) {
  const G = S.G;
  const stageName = { discuss: 'Tartışma', vote: 'Oylama', result: 'Sonuç' }[mt.stage];
  $('meeting-stage').textContent = stageName;
  $('meeting-time').textContent = Math.ceil(mt.left / 1000);
  if (!$('meeting-sub').textContent) $('meeting-sub').textContent = 'Toplantı sürüyor';
  const canVote = mt.stage === 'vote' && G.alive && !mt.voted.includes(G.you);
  const key = JSON.stringify([mt.stage, mt.voted, G.myVote, canVote, [...G.roster.values()].map(r => r.dead), !!mt.result]);
  if (key !== G.meetingKey) {
    G.meetingKey = key;
    const grid = $('meeting-players');
    grid.innerHTML = '';
    const res = mt.result;
    const votesFor = id => {
      const wrap = h('span', 'votes');
      if (!res) return wrap;
      if (res.votes) for (const v of res.votes[id] || []) { const r = G.roster.get(v); if (r) wrap.append(dot(r.color)); }
      else if (res.counts[id]) wrap.append(h('b', '', `${res.counts[id]} oy`));
      return wrap;
    };
    for (const r of G.roster.values()) {
      if (r.left) continue;
      const b = h('button', `vote-card ${r.dead ? 'dead' : ''} ${G.myVote === r.id ? 'picked' : ''}`);
      b.disabled = !canVote || r.dead;
      const meta = h('div', 'meta');
      meta.append(h('span', '', `${r.name}${r.id === G.you ? ' (sen)' : ''}`));
      const notes = [];
      if (r.dead) notes.push('😵 oyun dışı');
      if (r.id === mt.caller) notes.push('📢 toplantıyı başlattı');
      if (mt.voted.includes(r.id)) notes.push('✔ oy verdi');
      if (G.role === 'imp' && G.partners.has(r.id)) notes.push('😈 hain arkadaşın');
      meta.append(h('small', '', notes.join(' · ')));
      b.append(dot(r.color), meta, votesFor(r.id));
      b.onclick = () => castVote(r.id);
      grid.append(b);
    }
    $('btn-skip').disabled = !canVote;
    const sv = $('skip-votes');
    sv.innerHTML = '';
    sv.append(votesFor('skip'));
    if (mt.stage === 'discuss') $('btn-skip').textContent = '⏳ Oylama tartışmadan sonra başlar';
    else $('btn-skip').textContent = '⏭ Oy kullanmadan geç';
  }
  if (mt.result && !G.resultShown) showResult(mt.result);
}

async function castVote(target) {
  const G = S.G;
  const r = await emit('vote', { target });
  if (r.error) return toast(r.error, 'bad');
  G.myVote = target;
  G.meetingKey = '';
}
$('btn-skip').onclick = () => castVote('skip');

function showResult(res) {
  const G = S.G;
  G.resultShown = true;
  const box = $('meeting-result');
  box.innerHTML = '';
  if (res.ejected) {
    const r = G.roster.get(res.ejected);
    const flyer = dot(r ? r.color : 'gri');
    flyer.classList.add('eject-chick');
    flyer.style.cssText += 'width:90px;height:90px';
    box.append(flyer);
    let text = `${r ? r.name : '?'} çiftlikten uzaklaştırıldı.`;
    if (res.wasImp === true) text += ' Bir HAİNDİ! 😈';
    if (res.wasImp === false) text += ' Hain değildi... 😢';
    box.append(h('div', '', text));
    if (res.impsLeft != null) box.append(h('div', 'small-text', `${res.impsLeft} hain kaldı.`));
    addChat({ sys: true, text: `— ${text} —` });
  } else {
    const text = res.tie ? 'Oylar eşit! Kimse elenmedi.' : 'Kimse elenmedi (çoğunluk pas geçti).';
    box.append(h('div', '', `🤷 ${text}`));
    addChat({ sys: true, text: `— ${text} —` });
  }
  setTimeout(() => box.classList.remove('hidden'), 1800);
}

// ---------------------------------------------------------------- end
function showEnd(r) {
  const G = S.G;
  closeTask(false);
  closeMeeting();
  for (const id of ['intro', 'dead']) $(id).classList.add('hidden');
  const mine = r.players.find(p => p.id === (S.me && S.me.id));
  const won = mine ? (r.winner === 'crew') === (mine.role === 'crew') : null;
  const title = $('end-title');
  title.textContent = r.winner === 'crew' ? '🐣 Masumlar kazandı!' : '😈 Hainler kazandı!';
  title.className = won === null ? '' : won ? 'win' : 'lose';
  $('end-reason').textContent = `${END_REASONS[r.reason] || ''}${won === null ? '' : won ? ' — Kazandın!' : ' — Kaybettin.'}`;
  const mm = Math.floor(r.duration / 60), ss = String(r.duration % 60).padStart(2, '0');
  $('end-stats').textContent = `Maç süresi: ${mm}:${ss} · Görev ilerlemesi: %${Math.round(r.progress * 100)}`;
  const tb = $('end-players');
  tb.innerHTML = '';
  for (const p of r.players) {
    const tr = h('tr');
    const c = h('td');
    c.append(dot(p.color));
    tr.append(c, h('td', '', p.name), h('td', p.role === 'imp' ? 'imp' : '', p.role === 'imp' ? '😈 Hain' : '🐤 Masum'),
      h('td', '', p.role === 'imp' ? '—' : `${p.tasksDone}/${p.tasksTotal}`),
      h('td', '', p.left ? 'Ayrıldı' : p.alive ? 'Hayatta' : 'Oyun dışı'));
    tb.append(tr);
  }
  $('end').classList.remove('hidden');
  if (won === false) sfx.lose(); else sfx.win();
  if (G) G.phase = 'ended';
  const isHost = S.lobby && S.me && S.lobby.host === S.me.id;
  $('btn-again').textContent = isHost ? '🔁 Tekrar oyna' : '✋ Tekrar oyna (hazırım)';
}

function toLobby() {
  $('end').classList.add('hidden');
  S.G = null;
  world.setBodies([]);
  world.setSabotage(null, [], false);
  showScreen('lobby');
  renderLobby();
}
$('btn-to-lobby').onclick = toLobby;
$('btn-again').onclick = async () => {
  const isHost = S.lobby && S.me && S.lobby.host === S.me.id;
  toLobby();
  if (isHost) {
    const r = await emit('game:start');
    if (r.error) toast(r.error, 'bad', 4000);
  } else {
    emit('lobby:ready', { ready: true });
  }
};

// ---------------------------------------------------------------- input
const typing = () => {
  const a = document.activeElement;
  return a && (a.tagName === 'INPUT' || a.tagName === 'SELECT' || a.tagName === 'TEXTAREA');
};

window.addEventListener('keydown', e => {
  sfx.unlock();
  if (typing()) {
    if (e.key === 'Escape') document.activeElement.blur();
    return;
  }
  keys.add(e.code);
  if (e.key === 'Escape' && !$('modal').classList.contains('hidden')) { closeModal(); return; }
  const G = S.G;
  if (S.screen !== 'game' || !G) return;
  if (e.key === 'Escape') {
    if (G.task) closeTask();
    $('sab-menu').classList.add('hidden');
    $('emote-bar').classList.add('hidden');
    $('minimap').classList.remove('big');
    return;
  }
  if (e.key === 'Enter') { e.preventDefault(); $('hud-chat-slot').classList.remove('collapsed'); $('chat-input').focus(); return; }
  if (G.task || !$('meeting').classList.contains('hidden') || G.phase !== 'play') return;
  switch (e.code) {
    case 'KeyE': doUse(); break;
    case 'KeyR': doReport(); break;
    case 'KeyQ': doKill(); break;
    case 'KeyV': doTunnel(); break;
    case 'KeyF': if (G.role === 'imp') $('act-sab').click(); break;
    case 'KeyM': case 'Tab': e.preventDefault(); $('minimap').classList.toggle('big'); break;
    case 'Space': e.preventDefault(); doEmote('jump'); break;
    default: {
      const m = /^Digit([1-7])$/.exec(e.code);
      if (m) doEmote(EMOTES[Number(m[1]) - 1].id);
    }
  }
});
window.addEventListener('keyup', e => keys.delete(e.code));
window.addEventListener('blur', () => { keys.clear(); mouse.down = false; });
window.addEventListener('pointerdown', () => sfx.unlock());
$('world').addEventListener('pointerdown', e => {
  if (e.button !== 0) return;
  if (document.activeElement) document.activeElement.blur();
  mouse.down = true; mouse.x = e.clientX; mouse.y = e.clientY;
});
window.addEventListener('pointermove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });
window.addEventListener('pointerup', () => { mouse.down = false; });

// ---------------------------------------------------------------- game loop
function gameStep(dt, now) {
  const G = S.G;
  if (!G.snap) return;
  const canMove = G.phase === 'play' && !G.task && !typing() && $('modal').classList.contains('hidden');
  let ix = 0, iz = 0;
  if (canMove) {
    if (keys.has('KeyW') || keys.has('ArrowUp')) iz -= 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) iz += 1;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) ix -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) ix += 1;
    if (mouse.down && !ix && !iz) {
      const c = world.project(G.x, G.z);
      const mx = mouse.x - c.x, my = mouse.y - c.y;
      if (Math.hypot(mx, my) > 20) { ix = mx; iz = my * 1.3; }
    }
  }
  const len = Math.hypot(ix, iz);
  if (len) { ix /= len; iz /= len; }
  const sab = G.snap.sab;
  const speed = !G.alive ? GAME.ghostSpeed
    : G.carry ? GAME.carrySpeed
    : sab && sab.type === 'feed' && G.role === 'crew' ? GAME.slowSpeed
    : GAME.speed;
  const slippery = G.alive && sab && sab.type === 'water' && PUDDLES.some(p => Math.hypot(G.x - p.x, G.z - p.z) < PUDDLE_R);
  const a = 1 - Math.exp(-dt * (slippery ? 1.6 : 22));
  G.vx += (ix * speed - G.vx) * a;
  G.vz += (iz * speed - G.vz) * a;
  // gentle push between chicks; bumping hard makes both wobble
  if (G.alive && G.phase === 'play') {
    for (const e of world.entities.values()) {
      if (e.id === G.you || e.demo || e.ghost || !e.model.visible) continue;
      const dx = G.x - e.pos.x, dz = G.z - e.pos.z, d = Math.hypot(dx, dz);
      if (d < 0.9 && d > 0.001) {
        G.vx += (dx / d) * (0.9 - d) * 6;
        G.vz += (dz / d) * (0.9 - d) * 6;
        if (d < 0.6 && len && Math.random() < 0.05) { world.stumble(G.you); world.stumble(e.id); sfx.peep(); }
      }
    }
  }
  const sp = Math.hypot(G.vx, G.vz);
  if (sp > speed * 1.2) { G.vx *= (speed * 1.2) / sp; G.vz *= (speed * 1.2) / sp; }
  let nx = G.x + G.vx * dt, nz = G.z + G.vz * dt;
  if (G.phase !== 'play') { nx = G.x; nz = G.z; G.vx = G.vz = 0; }
  else if (G.alive) [nx, nz] = slideMove(G.x, G.z, G.vx * dt, G.vz * dt, GAME.radius, activeColliders(G.snap.doors));
  else {
    nx = Math.max(BOUNDS.x1 + 0.5, Math.min(BOUNDS.x2 - 0.5, nx));
    nz = Math.max(BOUNDS.z1 + 0.5, Math.min(BOUNDS.z2 - 0.5, nz));
  }
  const moved = Math.hypot(nx - G.x, nz - G.z);
  const moving = moved > 0.002 && (len > 0 || slippery);
  if (moving) G.ry = Math.atan2(nx - G.x, nz - G.z);
  G.x = nx; G.z = nz;
  if (moving && G.alive) { G.stepT += dt; if (G.stepT > 0.28) { G.stepT = 0; sfx.step(); } }
  world.updateEntity(G.you, { x: G.x, z: G.z, ry: G.ry, moving, busy: !!G.task, carry: G.carry, ghost: !G.alive }, true);

  const state = `${G.x.toFixed(2)},${G.z.toFixed(2)},${moving}`;
  if (G.phase === 'play' && now - G.lastSend > 66 && (state !== G.sent || now - G.lastSend > 1000)) {
    socket.emit('move', { x: Math.round(G.x * 100) / 100, z: Math.round(G.z * 100) / 100, r: Math.round(G.ry * 100) / 100, m: moving ? 1 : 0 });
    G.lastSend = now;
    G.sent = state;
  }
  updateActions();
  world.setMarkers(markers());
}

function markers() {
  const G = S.G, s = G.snap;
  const list = [];
  if (G.phase !== 'play' || !G.me) return list;
  for (const [, type, step, done] of G.me.tasks) {
    if (done) continue;
    const def = TASK_DEFS[type];
    const st = STATIONS[def.stations[step]];
    list.push({ x: st.x, z: st.z, kind: def.carry && step === 1 ? 'carry' : 'task' });
  }
  if (s.sab && G.alive) {
    if (s.sab.type === 'lights') list.push({ ...STATIONS.elec, kind: 'fix' });
    if (s.sab.type === 'water') list.push({ ...STATIONS.sabpipe, kind: 'fix' });
    if (s.sab.type === 'doors') for (const d of DOORS) if (d.b === s.sab.target) list.push({ x: d.cx, z: d.cz, kind: 'fix' });
  }
  return list;
}

function drawVision() {
  const G = S.G;
  const v = $('vision');
  if (!G.snap || !G.alive || (G.phase !== 'play' && G.phase !== 'intro')) { v.style.background = 'none'; return; }
  const lights = G.snap.sab && G.snap.sab.type === 'lights' && G.role !== 'imp';
  const r = G.role === 'imp' ? GAME.visionImp : lights ? GAME.visionLights : GAME.visionCrew;
  const c = world.project(G.x, G.z);
  const e = world.project(G.x + r, G.z);
  const R = Math.hypot(e.x - c.x, e.y - c.y);
  const shade = lights ? 'rgba(4,6,18,0.97)' : 'rgba(25,30,55,0.78)';
  v.style.background = `radial-gradient(circle at ${c.x}px ${c.y}px, transparent ${R * 0.78}px, ${shade} ${R}px)`;
}

const mmCtx = $('minimap').getContext('2d');
function drawMinimap() {
  const G = S.G;
  const cv = $('minimap');
  const big = cv.classList.contains('big');
  const W = big ? 560 : 240, H = big ? 434 : 186;
  if (cv.width !== W) { cv.width = W; cv.height = H; }
  const g = mmCtx;
  const sx = W / (BOUNDS.x2 - BOUNDS.x1 + 4), sz = H / (BOUNDS.z2 - BOUNDS.z1 + 4);
  const X = x => (x - BOUNDS.x1 + 2) * sx, Z = z => (z - BOUNDS.z1 + 2) * sz;
  g.fillStyle = '#86c95f';
  g.fillRect(0, 0, W, H);
  g.fillStyle = '#d9b98a';
  g.beginPath(); g.arc(X(0), Z(0.5), 10 * sx, 0, Math.PI * 2); g.fill();
  for (const f of FENCES) { g.fillStyle = f.floor; g.fillRect(X(f.x1), Z(f.z1), (f.x2 - f.x1) * sx, (f.z2 - f.z1) * sz); }
  for (const b of BUILDINGS) {
    g.fillStyle = b.floor;
    g.fillRect(X(b.x1), Z(b.z1), (b.x2 - b.x1) * sx, (b.z2 - b.z1) * sz);
    g.strokeStyle = b.wall;
    g.lineWidth = 2;
    g.strokeRect(X(b.x1), Z(b.z1), (b.x2 - b.x1) * sx, (b.z2 - b.z1) * sz);
  }
  g.font = `bold ${big ? 13 : 8}px "Baloo 2", sans-serif`;
  g.textAlign = 'center';
  g.fillStyle = 'rgba(40,25,10,.8)';
  for (const z of ZONES) g.fillText(z.name, X((z.x1 + z.x2) / 2), Z((z.z1 + z.z2) / 2));
  const s = G.snap;
  const pin = (x, z, color, r = 4) => { g.fillStyle = color; g.beginPath(); g.arc(X(x), Z(z), r * (big ? 1.6 : 1), 0, Math.PI * 2); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 1.5; g.stroke(); };
  pin(STATIONS.bell.x, STATIONS.bell.z, '#ffc300', 3);
  if (G.role === 'imp' && G.alive) for (const t of TUNNELS) pin(t.x, t.z, '#6b4423', 2.5);
  for (const m of markers()) pin(m.x, m.z, m.kind === 'fix' ? '#ff0a54' : m.kind === 'carry' ? '#4cc9f0' : '#ffd60a', 3.5);
  if (s && s.sab) {
    if (s.sab.items) for (const [, x, z] of s.sab.items) pin(x, z, '#ff0a54', 3);
    if (s.sab.type === 'alarm' && s.sab.zone) {
      const z = zoneById(s.sab.zone);
      g.strokeStyle = `rgba(255,10,84,${0.5 + Math.sin(performance.now() / 150) * 0.5})`;
      g.lineWidth = 3;
      g.strokeRect(X(z.x1), Z(z.z1), (z.x2 - z.x1) * sx, (z.z2 - z.z1) * sz);
    }
  }
  const me = G.roster.get(G.you);
  pin(G.x, G.z, me ? colorById(me.color).hex : '#fff', 5);
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  try {
    const inGame = S.screen === 'game' && S.G;
    if (inGame) gameStep(dt, now);
    world.render(dt, inGame ? { x: S.G.x, z: S.G.z } : null);
    if (inGame) { drawVision(); drawMinimap(); }
    for (const p of previews) p.render(dt);
  } catch (err) {
    console.error(err);
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// gentle farm ambience
setInterval(() => { if (Math.random() < 0.35 && S.screen !== 'lobby') sfx.chirp(); }, 2500);
