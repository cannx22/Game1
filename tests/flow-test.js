// Uçtan uca sunucu testi: 4 bot oda kurar, maç başlatır, görev yapar, hain eler, rapor/toplantı/oylama yapılır, maç biter.
// Çalıştırma: npm test
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { io } from 'socket.io-client';
import { TASK_DEFS } from '../shared/constants.js';
import { STATIONS, COLLIDERS, blockedAt } from '../shared/map.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 3100 + Math.floor(Math.random() * 500);
const URL = `http://localhost:${PORT}`;
const sleep = ms => new Promise(r => setTimeout(r, ms));
let failures = 0;
const check = (cond, msg) => {
  console.log(`${cond ? '  ✔' : '  ✘'} ${msg}`);
  if (!cond) failures++;
};

// ---- grid A* path finding over the shared colliders ----
const STEP = 0.5;
function findPath(from, to) {
  const key = (i, j) => `${i},${j}`;
  const toCell = p => [Math.round(p.x / STEP), Math.round(p.z / STEP)];
  const free = (i, j) => !blockedAt(i * STEP, j * STEP, 0.55, COLLIDERS);
  const [si, sj] = toCell(from);
  const [ti, tj] = toCell(to);
  // breadth-first search; the grid is uniform so this is fast and close enough to shortest
  const open = [[si, sj]];
  const came = new Map([[key(si, sj), null]]);
  for (let head = 0; head < open.length; head++) {
    const [ci, cj] = open[head];
    if (Math.hypot(ci - ti, cj - tj) <= 2) {
      const out = [];
      let k = key(ci, cj);
      while (k) { const [a, b] = k.split(',').map(Number); out.unshift({ x: a * STEP, z: b * STEP }); k = came.get(k); }
      return out;
    }
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const ni = ci + di, nj = cj + dj, nk = key(ni, nj);
      if (came.has(nk) || !free(ni, nj)) continue;
      // no corner cutting: a diagonal step needs both orthogonal neighbours free
      if (di && dj && (!free(ci + di, cj) || !free(ci, cj + dj))) continue;
      came.set(nk, key(ci, cj));
      open.push([ni, nj]);
    }
  }
  return null;
}

class Bot {
  constructor(name) {
    this.name = name;
    this.s = io(URL, { transports: ['websocket'], forceNew: true });
    this.events = [];
    this.snap = null;
    this.chat = [];
    this.s.on('s', d => { this.snap = d; });
    this.s.on('tp', d => { this.x = d.x; this.z = d.z; });
    this.s.on('correct', d => { this.corrected = d; this.x = d.x; this.z = d.z; });
    this.s.on('chat', d => this.chat.push(d));
    for (const ev of ['game:start', 'game:over', 'meeting', 'killed', 'room:state', 'sab', 'sabEnd', 'meetingEnd']) {
      this.s.on(ev, d => this.events.push([ev, d]));
    }
    this.s.on('game:start', d => { this.start = d; this.x = d.x; this.z = d.z; });
    this.s.on('game:over', d => { this.over = d; });
  }
  emit(ev, d = {}) { return new Promise(r => this.s.emit(ev, d, r)); }
  async walkTo(target) {
    const path = findPath({ x: this.x, z: this.z }, target);
    if (!path) throw new Error(`${this.name}: yol bulunamadı`);
    const deadline = Date.now() + 90000;
    for (const pt of path) {
      // stay under the server speed limit (4.6 u/s); 0.25 units per 66 ms ≈ 3.8 u/s
      for (;;) {
        if (Date.now() > deadline) {
          throw new Error(`${this.name}: hedefe ulaşılamadı (${this.x.toFixed(1)},${this.z.toFixed(1)} → ${target.x},${target.z}, son düzeltme: ${JSON.stringify(this.corrected)})`);
        }
        const dx = pt.x - this.x, dz = pt.z - this.z, d = Math.hypot(dx, dz);
        if (d < 0.01) break;
        const step = Math.min(0.25, d);
        this.x += (dx / d) * step;
        this.z += (dz / d) * step;
        this.s.emit('move', { x: this.x, z: this.z, r: 0, m: 1 });
        await sleep(66);
      }
    }
    this.s.emit('move', { x: this.x, z: this.z, r: 0, m: 0 });
    await sleep(150);
  }
  waitFor(pred, ms = 15000, label = 'koşul') {
    return new Promise((res, rej) => {
      const t0 = Date.now();
      const iv = setInterval(() => {
        if (pred()) { clearInterval(iv); res(); }
        else if (Date.now() - t0 > ms) { clearInterval(iv); rej(new Error(`${this.name}: zaman aşımı (${label})`)); }
      }, 50);
    });
  }
}

async function main() {
  const server = spawn(process.execPath, ['server/index.js'], { cwd: root, env: { ...process.env, PORT: String(PORT) }, stdio: ['ignore', 'pipe', 'inherit'] });
  await new Promise(r => server.stdout.once('data', r));
  try {
    await run();
  } finally {
    server.kill();
  }
  console.log(failures ? `\n${failures} kontrol BAŞARISIZ` : '\nBütün kontroller başarılı ✔');
  process.exit(failures ? 1 : 0);
}

async function run() {
  console.log('Oda ve lobi');
  const bots = ['Ali', 'Ayşe', 'Can', 'Deniz'].map(n => new Bot(n));
  await Promise.all(bots.map(b => new Promise(r => b.s.on('connect', r))));
  const created = await bots[0].emit('room:create', { name: 'Test', profile: { name: 'Ali', color: 'kirmizi', hat: 'crown' }, settings: { discussion: 0, voting: 15 } });
  check(created.ok && /^[A-Z0-9]{5}$/.test(created.code), `oda oluşturuldu (${created.code})`);
  const bad = await bots[1].emit('room:join', { code: 'XXXXX', profile: {} });
  check(!!bad.error, 'geçersiz kodda hata: ' + bad.error);
  for (const b of bots.slice(1)) {
    const r = await b.emit('room:join', { code: created.code, profile: { name: b.name, color: 'kirmizi' } });
    check(r.ok, `${b.name} odaya katıldı`);
  }
  await sleep(200);
  const st = bots[0].events.filter(e => e[0] === 'room:state').pop()[1];
  check(new Set(st.players.map(p => p.color)).size === 4, 'renkler benzersiz (çakışan renk değiştirildi)');
  const early = await bots[0].emit('game:start');
  check(!!early.error, 'herkes hazır değilken başlatma engellendi');
  const notHost = await bots[1].emit('game:start');
  check(!!notHost.error, 'oda sahibi olmayan başlatamaz');
  for (const b of bots.slice(1)) await b.emit('lobby:ready', { ready: true });
  const tooMany = await bots[0].emit('lobby:settings', { impostors: 3 });
  const startBad = await bots[0].emit('game:start');
  check(!!startBad.error, '4 oyuncuda 3 hain engellendi');
  await bots[0].emit('lobby:settings', { impostors: 1 });
  check(tooMany.ok, 'ayar güncellendi');
  const started = await bots[0].emit('game:start');
  check(started.ok, 'maç başladı');
  await Promise.all(bots.map(b => b.waitFor(() => b.start, 5000, 'game:start')));

  console.log('Roller');
  const imp = bots.find(b => b.start.role === 'imp');
  const crew = bots.filter(b => b.start.role === 'crew');
  check(bots.filter(b => b.start.role === 'imp').length === 1 && crew.length === 3, '1 hain, 3 masum');
  check(crew.every(b => b.start.partners.length === 0), 'masumlar kimsenin rolünü bilmiyor');
  const leaked = JSON.stringify(crew[0].start).includes('"imp"');
  check(!leaked, 'masuma giden başlangıç verisinde hain bilgisi yok');

  await bots[0].waitFor(() => bots.every(b => b.snap && b.snap.ph === 'play'), 8000, 'play');
  console.log('Hareket doğrulama');
  const cheater = crew[2];
  cheater.s.emit('move', { x: cheater.x + 15, z: cheater.z, r: 0, m: 1 });
  await cheater.waitFor(() => cheater.corrected, 2000, 'correct');
  check(!!cheater.corrected, 'ışınlanma (hız hilesi) reddedildi');

  console.log('Görevler');
  const worker = crew[0];
  const myTasks = worker.snap.me.tasks;
  const t = myTasks.find(k => !TASK_DEFS[k[1]].carry) || myTasks[0];
  const def = TASK_DEFS[t[1]];
  const far = await worker.emit('task:open', { taskId: t[0] });
  check(!!far.error, 'uzaktan görev açılamıyor');
  await worker.walkTo(STATIONS[def.stations[0]]);
  let opened = await worker.emit('task:open', { taskId: t[0] });
  check(opened.ok, `görev açıldı: ${def.name}`);
  if (!def.carry) {
    const fast = await worker.emit('task:done', { taskId: t[0] });
    check(!!fast.error, 'çok hızlı tamamlama reddedildi');
    opened = await worker.emit('task:open', { taskId: t[0] });
    await sleep((def.min || 0) * 1000 + 200);
    const done = await worker.emit('task:done', { taskId: t[0] });
    check(done.ok, 'görev tamamlandı');
  } else {
    await worker.walkTo(STATIONS[def.stations[1]]);
    const dropped = await worker.emit('task:open', { taskId: t[0] });
    check(dropped.ok && dropped.done, 'taşıma görevi tamamlandı');
  }
  await sleep(200);
  const pr1 = worker.snap.pr;
  check(pr1 > 0, `ortak ilerleme arttı (${Math.round(pr1 * 100)}%)`);

  const it = imp.snap.me.tasks[0];
  const idef = TASK_DEFS[it[1]];
  await imp.walkTo(STATIONS[idef.stations[0]]);
  await imp.emit('task:open', { taskId: it[0] });
  if (idef.carry) {
    await imp.walkTo(STATIONS[idef.stations[1]]);
    await imp.emit('task:open', { taskId: it[0] });
  } else {
    await sleep((idef.min || 0) * 1000 + 200);
    await imp.emit('task:done', { taskId: it[0] });
  }
  await sleep(200);
  check(worker.snap.pr === pr1, 'hainin sahte görevi ilerleme oluşturmadı');

  console.log('Eliminasyon');
  const victim = crew[1];
  const crewKill = await crew[0].emit('kill', { target: victim.start.you });
  check(!!crewKill.error, 'masum kimseyi eleyemez');
  await imp.walkTo({ x: victim.x + 1, z: victim.z });
  await imp.waitFor(() => imp.snap.me.killIn === 0, 20000, 'kill cooldown');
  const kill = await imp.emit('kill', { target: victim.start.you });
  check(kill.ok, 'hain bir masumu saf dışı bıraktı');
  await victim.waitFor(() => victim.events.some(e => e[0] === 'killed'), 2000, 'killed');
  check(true, 'kurban bilgilendirildi');
  const again = await imp.emit('kill', { target: crew[2].start.you });
  check(!!again.error, 'bekleme süresi uygulanıyor');
  const ghostChat = await victim.emit('chat', { text: 'ben hayaletim' });
  await sleep(200);
  check(ghostChat.ok && !crew[2].chat.some(m => m.text === 'ben hayaletim'), 'hayalet mesajı canlılara gitmiyor');

  console.log('Raporlama ve toplantı');
  const reporter = crew[2];
  const body = { x: victim.x, z: victim.z };
  await reporter.walkTo(body);
  await reporter.waitFor(() => reporter.snap.bd && reporter.snap.bd.length, 3000, 'body visible');
  const rep = await reporter.emit('report', { body: victim.start.you });
  check(rep.ok, 'ceset raporlandı, toplantı başladı');
  await reporter.waitFor(() => reporter.snap.ph === 'meeting' && reporter.snap.mt.stage === 'vote', 3000, 'vote stage');
  const msg = await crew[0].emit('chat', { text: 'Bence hain o!' });
  const empty = await crew[0].emit('chat', { text: '   ' });
  await sleep(150);
  check(msg.ok && bots.filter(b => b.chat.some(m => m.text === 'Bence hain o!')).length === 4, 'toplantı mesajı herkese ulaştı');
  check(!!empty.error, 'boş mesaj engellendi');
  const ghostVote = await victim.emit('vote', { target: imp.start.you });
  check(!!ghostVote.error, 'elenen oyuncu oy kullanamaz');
  for (const b of [crew[0], crew[2]]) await b.emit('vote', { target: imp.start.you });
  const dbl = await crew[0].emit('vote', { target: 'skip' });
  check(!!dbl.error, 'ikinci oy reddedildi');
  await imp.emit('vote', { target: 'skip' });
  await reporter.waitFor(() => reporter.snap.mt && reporter.snap.mt.result, 3000, 'result');
  const res = reporter.snap.mt.result;
  check(res.ejected === imp.start.you && res.wasImp === true, 'hain oylamayla elendi ve rolü açıklandı');

  console.log('Maç sonu');
  await Promise.all(bots.map(b => b.waitFor(() => b.over, 10000, 'game:over')));
  check(bots.every(b => b.over.winner === 'crew' && b.over.reason === 'imps_gone'), 'herkese aynı sonuç: masumlar kazandı');
  check(bots[0].over.players.length === 4 && bots[0].over.players.some(p => p.role === 'imp'), 'maç sonunda bütün roller açıklandı');

  console.log('Yeniden başlatma ve kopma');
  for (const b of bots.slice(1)) await b.emit('lobby:ready', { ready: true });
  bots.forEach(b => { b.start = null; });
  const re = await bots[0].emit('game:start');
  check(re.ok, 'yeni maç başlatıldı');
  await Promise.all(bots.map(b => b.waitFor(() => b.start, 5000, 'restart')));
  const token = created.token;
  bots[0].s.disconnect();
  await sleep(300);
  const back = new Bot('Ali2');
  await new Promise(r => back.s.on('connect', r));
  const resumed = await back.emit('resume', { token });
  check(resumed.ok, 'kopan oyuncu aynı oturuma geri döndü');
  await back.waitFor(() => back.events.some(e => e[0] === 'game:sync') || back.snap, 3000, 'sync');
  check(!!back.snap, 'geri dönen oyuncu maç durumunu alıyor');
  for (const b of [...bots, back]) b.s.disconnect();
}

main().catch(err => {
  console.error('TEST HATASI:', err);
  process.exit(1);
});
