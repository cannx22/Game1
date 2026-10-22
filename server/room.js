// Bir oda ve içindeki maçın bütün sunucu tarafı mantığı.
// İstemciden gelen her istek burada doğrulanır; roller ve gizli bilgiler yalnızca ilgili oyuncuya gönderilir.
import crypto from 'crypto';
import {
  COLORS, HATS, EMOTES, DEFAULT_SETTINGS, SETTING_LIMITS, GAME, TASK_DEFS, SAB_DEFS,
  defaultImpostors, maxImpostors,
} from '../shared/constants.js';
import {
  STATIONS, SPAWN, TUNNELS, FEED_SPOTS, CHICK_SPOTS, DOORS, BUILDINGS, ZONES,
  activeColliders, pathClear, inBounds,
} from '../shared/map.js';

const now = () => Date.now();
const MIN_PLAYERS = Number(process.env.MIN_PLAYERS) || GAME.minPlayers;
const TICK_MS = 1000 / 12;
const r2 = v => Math.round(v * 100) / 100;
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const pick = a => a[Math.floor(Math.random() * a.length)];
function shuffle(a) {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}
const finite = v => typeof v === 'number' && Number.isFinite(v);

export function cleanName(v, fallback) {
  const s = typeof v === 'string' ? v.replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 14) : '';
  return s || fallback;
}

// Picks `count` task types, spreading them over different zones where possible.
function assignTasks(count) {
  const types = shuffle(Object.keys(TASK_DEFS));
  const zoneOf = t => STATIONS[TASK_DEFS[t].stations[0]].zone;
  const chosen = [];
  const perZone = {};
  for (const t of types) {
    if (chosen.length >= count) break;
    if ((perZone[zoneOf(t)] || 0) >= 1) continue;
    chosen.push(t);
    perZone[zoneOf(t)] = 1;
  }
  for (const t of types) {
    if (chosen.length >= count) break;
    if (!chosen.includes(t)) chosen.push(t);
  }
  return chosen.map((type, i) => ({ id: `t${i}`, type, step: 0, done: false }));
}

export class Room {
  constructor(io, code, { name, isPublic }, onEmpty) {
    this.io = io;
    this.code = code;
    this.name = cleanName(name, `Oda ${code}`).slice(0, 24);
    this.isPublic = !!isPublic;
    this.onEmpty = onEmpty;
    this.players = new Map(); // pid -> member
    this.hostId = null;
    this.settings = { ...DEFAULT_SETTINGS };
    this.phase = 'lobby'; // lobby | intro | play | meeting
    this.game = null;
    this.timer = null;
  }

  // ---------- helpers ----------
  get members() { return [...this.players.values()]; }
  sendTo(p, ev, data) { if (p && p.socketId) this.io.to(p.socketId).emit(ev, data); }
  emitAll(ev, data) { for (const p of this.players.values()) this.sendTo(p, ev, data); }
  gp(p) { return this.game && p ? this.game.ps.get(p.id) : null; }
  inGame() { return this.phase !== 'lobby' && this.game; }
  sysChat(text, filter = () => true) {
    for (const p of this.players.values()) if (filter(p)) this.sendTo(p, 'chat', { sys: true, text });
  }

  lobbyState() {
    return {
      code: this.code, name: this.name, isPublic: this.isPublic, host: this.hostId,
      phase: this.phase === 'lobby' ? 'lobby' : 'game',
      settings: this.settings, minPlayers: MIN_PLAYERS,
      players: this.members.map(p => ({ id: p.id, name: p.name, color: p.color, hat: p.hat, ready: p.ready || p.id === this.hostId, connected: p.connected, waiting: p.waiting })),
    };
  }
  broadcastLobby() { this.emitAll('room:state', this.lobbyState()); }

  publicInfo() {
    return { code: this.code, name: this.name, count: this.players.size, max: this.settings.maxPlayers, phase: this.phase === 'lobby' ? 'lobby' : 'game' };
  }

  freeColor(pref, exceptId) {
    const used = new Set(this.members.filter(p => p.id !== exceptId).map(p => p.color));
    if (pref && COLORS.some(c => c.id === pref) && !used.has(pref)) return pref;
    const c = COLORS.find(c => !used.has(c.id));
    return c ? c.id : null;
  }

  // ---------- membership ----------
  addPlayer(socket, profile = {}) {
    if (this.players.size >= this.settings.maxPlayers) return { error: 'Oda dolu.' };
    const color = this.freeColor(profile.color);
    if (!color) return { error: 'Oda dolu.' };
    const p = {
      id: crypto.randomBytes(6).toString('hex'),
      token: crypto.randomBytes(16).toString('hex'),
      socketId: socket.id,
      name: cleanName(profile.name, `Civciv ${this.players.size + 1}`),
      color,
      hat: HATS.some(h => h.id === profile.hat) ? profile.hat : 'none',
      ready: false,
      connected: true,
      waiting: this.phase !== 'lobby',
      chatAt: 0,
      dropTimer: null,
    };
    this.players.set(p.id, p);
    if (!this.hostId) this.hostId = p.id;
    this.broadcastLobby();
    if (p.waiting) this.sysChat(`${p.name} odaya katıldı, maç bitince oyuna girecek.`, q => q.waiting);
    return { player: p };
  }

  attach(p, socket) {
    if (p.dropTimer) clearTimeout(p.dropTimer);
    p.dropTimer = null;
    p.socketId = socket.id;
    p.connected = true;
    const g = this.gp(p);
    if (g) g.connected = true;
    this.broadcastLobby();
    if (this.inGame() && g && !g.left) this.sendTo(p, 'game:sync', this.startPayload(p));
  }

  disconnect(p) {
    p.connected = false;
    p.socketId = null;
    const g = this.gp(p);
    if (g) { g.connected = false; g.busy = false; g.active = null; }
    this.broadcastLobby();
    const grace = this.inGame() && g ? 60000 : 15000;
    p.dropTimer = setTimeout(() => this.removePlayer(p.id), grace);
    if (this.members.every(m => !m.connected)) {
      // nobody left online: close the room soon unless someone comes back
      clearTimeout(this.emptyTimer);
      this.emptyTimer = setTimeout(() => {
        if (this.members.every(m => !m.connected)) this.destroy();
      }, grace);
    }
  }

  removePlayer(pid) {
    const p = this.players.get(pid);
    if (!p) return;
    if (p.dropTimer) clearTimeout(p.dropTimer);
    this.players.delete(pid);
    const g = this.gp(p);
    if (g && !g.left) {
      g.left = true;
      g.connected = false;
      if (g.alive) { g.alive = false; g.deathPublic = true; }
      g.carry = null;
      // unfinished tasks of a leaver no longer block the crew's task win
      if (g.role === 'crew') this.game.totalTasks -= g.tasks.filter(k => !k.done).length;
      this.sysChat(`${p.name} oyundan ayrıldı.`);
      this.emitRoster();
      this.checkWin();
    }
    if (this.hostId === pid) {
      const next = this.members.find(m => m.connected) || this.members[0];
      this.hostId = next ? next.id : null;
      if (next) this.sysChat(`${next.name} artık oda sahibi.`);
    }
    if (!this.players.size) return this.destroy();
    this.broadcastLobby();
  }

  destroy() {
    if (this.dead) return;
    this.dead = true;
    clearInterval(this.timer);
    this.timer = null;
    clearTimeout(this.emptyTimer);
    for (const p of this.players.values()) if (p.dropTimer) clearTimeout(p.dropTimer);
    this.players.clear();
    this.onEmpty(this);
  }

  // ---------- lobby actions ----------
  setProfile(p, d) {
    if (d.name !== undefined) p.name = cleanName(d.name, p.name);
    if (d.hat !== undefined && HATS.some(h => h.id === d.hat)) p.hat = d.hat;
    if (d.color !== undefined && !this.inGame()) {
      const c = this.freeColor(d.color, p.id);
      if (c === d.color) p.color = c;
      else return { error: 'Bu renk başka bir oyuncuda.' };
    }
    if (this.inGame() && this.gp(p)) this.emitRoster();
    this.broadcastLobby();
    return { ok: true };
  }

  setReady(p, v) {
    if (this.phase !== 'lobby') return;
    p.ready = !!v;
    this.broadcastLobby();
  }

  updateSettings(p, d) {
    if (p.id !== this.hostId) return { error: 'Ayarları yalnızca oda sahibi değiştirebilir.' };
    if (this.phase !== 'lobby') return { error: 'Maç sırasında ayar değiştirilemez.' };
    const s = this.settings;
    for (const [k, [lo, hi]] of Object.entries(SETTING_LIMITS)) {
      if (finite(d[k])) s[k] = Math.max(lo, Math.min(hi, Math.round(d[k])));
    }
    for (const k of ['confirmEjects', 'criticalWin', 'playChat', 'anonVotes']) {
      if (typeof d[k] === 'boolean') s[k] = d[k];
    }
    if (typeof d.isPublic === 'boolean') this.isPublic = d.isPublic;
    if (typeof d.name === 'string') this.name = cleanName(d.name, this.name).slice(0, 24);
    if (s.maxPlayers < this.players.size) s.maxPlayers = Math.max(this.players.size, SETTING_LIMITS.maxPlayers[0]);
    this.broadcastLobby();
    return { ok: true };
  }

  // ---------- match lifecycle ----------
  startGame(p) {
    if (p.id !== this.hostId) return { error: 'Maçı yalnızca oda sahibi başlatabilir.' };
    if (this.phase !== 'lobby') return { error: 'Maç zaten sürüyor.' };
    const active = this.members.filter(m => m.connected);
    if (active.length < MIN_PLAYERS) return { error: `Başlamak için en az ${MIN_PLAYERS} oyuncu gerekli.` };
    const notReady = active.filter(m => m.id !== this.hostId && !m.ready);
    if (notReady.length) return { error: `Hazır olmayanlar: ${notReady.map(m => m.name).join(', ')}` };
    const maxImp = maxImpostors(active.length);
    if (this.settings.impostors > maxImp) {
      return { error: `${active.length} oyuncuda en fazla ${maxImp} hain olabilir. Hain sayısını düşür.` };
    }

    const t = now();
    const ids = shuffle(active.map(m => m.id));
    const imps = new Set(ids.slice(0, this.settings.impostors));
    const g = {
      start: t,
      ps: new Map(),
      bodies: [],
      sab: null,
      sabReadyAt: t + GAME.introMs + 15000,
      meeting: null,
      phaseEnds: t + GAME.introMs,
      nextEventAt: t + GAME.introMs + 30000 + Math.random() * 20000,
      totalTasks: 0,
      doneTasks: 0,
    };
    shuffle(SPAWN).slice(0, active.length).forEach((sp, i) => {
      const m = this.players.get(ids[i]);
      const role = imps.has(m.id) ? 'imp' : 'crew';
      const tasks = assignTasks(this.settings.tasks);
      if (role === 'crew') g.totalTasks += tasks.length;
      g.ps.set(m.id, {
        id: m.id, role, alive: true, left: false, connected: true,
        x: sp.x, z: sp.z, ry: 0, m: false, busy: false, carry: null,
        budget: 2, lastMove: t,
        tasks, done: 0, bells: this.settings.emergencies,
        killAt: t + GAME.introMs + 10000, bellReadyAt: t + GAME.introMs + GAME.meetingCooldown * 1000,
        tunnelAt: 0, emoteAt: 0, active: null, deathPublic: false, killedBy: null,
      });
    });
    for (const m of this.members) { m.waiting = !g.ps.has(m.id); m.ready = false; }
    this.game = g;
    this.phase = 'intro';
    for (const m of this.members) if (g.ps.has(m.id)) this.sendTo(m, 'game:start', this.startPayload(m));
    this.broadcastLobby();
    clearInterval(this.timer);
    this.timer = setInterval(() => this.tick(), TICK_MS);
    return { ok: true };
  }

  roster() {
    const g = this.game;
    return [...g.ps.values()].map(q => {
      const m = this.players.get(q.id);
      return { id: q.id, name: m ? m.name : '?', color: m ? m.color : 'gri', hat: m ? m.hat : 'none', dead: q.deathPublic || q.left, left: q.left };
    });
  }
  emitRoster() {
    if (!this.game) return;
    const roster = this.roster();
    for (const m of this.members) {
      const g = this.gp(m);
      if (!g) continue;
      // the viewer always knows whether they themselves are dead
      this.sendTo(m, 'roster', roster.map(r => (r.id === m.id ? { ...r, dead: !g.alive } : r)));
    }
  }

  startPayload(m) {
    const g = this.gp(m);
    const partners = g.role === 'imp' ? [...this.game.ps.values()].filter(q => q.role === 'imp' && q.id !== m.id).map(q => q.id) : [];
    return {
      you: m.id, role: g.role, partners, phase: this.phase, settings: this.settings,
      roster: this.roster().map(r => (r.id === m.id ? { ...r, dead: !g.alive } : r)),
      x: g.x, z: g.z, alive: g.alive, introLeft: Math.max(0, this.game.phaseEnds - now()),
      impCount: this.settings.impostors,
    };
  }

  tick() {
    const g = this.game;
    if (!g) return;
    const t = now();
    if (this.phase === 'intro' && t >= g.phaseEnds) this.phase = 'play';
    if (this.phase === 'play') {
      if (g.sab && g.sab.ends && t >= g.sab.ends) {
        if (SAB_DEFS[g.sab.type].critical) {
          if (this.settings.criticalWin) return this.endGame('imp', 'sabotage');
        } else this.clearSab();
      }
      if (t >= g.nextEventAt) this.farmEvent(t);
    }
    if (this.phase === 'meeting') {
      this.meetingTick(t);
      if (!this.game) return;
    }
    for (const m of this.members) {
      const q = g.ps.get(m.id);
      if (q && !q.left && m.connected) this.sendTo(m, 's', this.snapshotFor(q, t));
    }
  }

  visionOf(q) {
    if (!q.alive) return 999;
    if (q.role === 'imp') return GAME.visionImp;
    return this.game.sab && this.game.sab.type === 'lights' ? GAME.visionLights : GAME.visionCrew;
  }
  canSee(viewer, q) {
    if (!viewer.alive) return true;
    if (!q.alive && q.id !== viewer.id) return false;
    return q.id === viewer.id || dist(viewer, q) <= this.visionOf(viewer) + 2;
  }
  lockedBuildings() {
    const s = this.game && this.game.sab;
    return s && s.type === 'doors' ? [s.target] : [];
  }
  progress() {
    const g = this.game;
    return g.totalTasks ? Math.min(1, g.doneTasks / g.totalTasks) : 0;
  }

  snapshotFor(viewer, t) {
    const g = this.game;
    const s = { ph: this.phase, pr: r2(this.progress()), doors: this.lockedBuildings() };
    if (this.phase === 'intro') s.left = g.phaseEnds - t;
    if (this.phase !== 'meeting') {
      s.pl = [];
      for (const q of g.ps.values()) {
        if (q.left || !this.canSee(viewer, q)) continue;
        s.pl.push([q.id, r2(q.x), r2(q.z), r2(q.ry), q.m ? 1 : 0, q.busy ? 1 : 0, q.carry || 0, q.alive ? 0 : 1]);
      }
      const vr = this.visionOf(viewer) + 2;
      s.bd = g.bodies.filter(b => !viewer.alive || dist(viewer, b) <= vr).map(b => [b.id, r2(b.x), r2(b.z)]);
    }
    if (g.sab) {
      s.sab = { type: g.sab.type, left: g.sab.ends ? g.sab.ends - t : null };
      if (g.sab.items) { s.sab.items = g.sab.items.map(i => [i.id, i.x, i.z]); s.sab.total = g.sab.total; }
      if (g.sab.target) s.sab.target = g.sab.target;
      if (g.sab.zone) s.sab.zone = g.sab.zone;
    }
    const me = { alive: viewer.alive, carry: viewer.carry, bells: viewer.bells, tasks: viewer.tasks.map(k => [k.id, k.type, k.step, k.done ? 1 : 0]) };
    me.bellIn = Math.max(0, viewer.bellReadyAt - t);
    if (viewer.role === 'imp') {
      me.killIn = Math.max(0, viewer.killAt - t);
      me.sabIn = Math.max(0, g.sabReadyAt - t);
    }
    s.me = me;
    if (g.meeting) s.mt = this.meetingPublic(t);
    return s;
  }

  // ---------- movement ----------
  onMove(p, d) {
    const g = this.gp(p);
    if (!g || g.left || this.phase !== 'play' || !finite(d.x) || !finite(d.z)) return;
    const t = now();
    const dt = Math.min(1, (t - g.lastMove) / 1000);
    g.lastMove = t;
    const maxSp = (g.alive ? GAME.speed : GAME.ghostSpeed) * 1.3;
    g.budget = Math.min(g.budget + maxSp * dt, 2.5);
    const dd = Math.hypot(d.x - g.x, d.z - g.z);
    let ok = dd <= g.budget && inBounds(d.x, d.z);
    if (ok && g.alive) ok = pathClear(g.x, g.z, d.x, d.z, GAME.radius * 0.85, activeColliders(this.lockedBuildings()));
    if (!ok) {
      this.sendTo(p, 'correct', { x: g.x, z: g.z });
      return;
    }
    g.budget -= dd;
    g.x = d.x; g.z = d.z;
    if (finite(d.r)) g.ry = d.r;
    g.m = !!d.m;
  }

  teleport(p, g, x, z) {
    g.x = x; g.z = z; g.budget = 2; g.lastMove = now();
    this.sendTo(p, 'tp', { x, z });
  }

  // ---------- tasks ----------
  near(g, pt, extra = 0.6) { return dist(g, pt) <= GAME.useRange + extra; }

  onTaskOpen(p, d) {
    const g = this.gp(p);
    if (!g || g.left || this.phase !== 'play') return { error: 'Şu an görev yapılamaz.' };
    const task = g.tasks.find(k => k.id === d.taskId);
    if (!task || task.done) return { error: 'Görev bulunamadı.' };
    const def = TASK_DEFS[task.type];
    const st = STATIONS[def.stations[task.step]];
    if (!this.near(g, st)) return { error: 'Göreve biraz daha yaklaş.' };
    if (def.power && this.game.sab && this.game.sab.type === 'lights') return { error: 'Elektrik yok! Önce elektriği onarın.' };
    if (def.carry) {
      if (task.step === 0) {
        if (g.carry) return { error: 'Elin dolu, önce taşıdığını bırak.' };
        if (!g.alive) { task.step = 1; return { ok: true, step: 1 }; }
        g.carry = def.carry;
        task.step = 1;
        return { ok: true, step: 1 };
      }
      g.carry = null;
      this.completeTask(p, g, task);
      return { ok: true, done: true };
    }
    g.active = { taskId: task.id, t: now() };
    g.busy = g.alive;
    return { ok: true, minigame: task.type };
  }

  onTaskDone(p, d) {
    const g = this.gp(p);
    if (!g || !g.active || g.active.taskId !== d.taskId || this.phase !== 'play') return { error: 'Görev geçersiz.' };
    const task = g.tasks.find(k => k.id === d.taskId);
    const def = TASK_DEFS[task.type];
    g.busy = false;
    const started = g.active.t;
    g.active = null;
    if (now() - started < (def.min || 0) * 1000) return { error: 'Görev çok hızlı tamamlandı.' };
    if (!this.near(g, STATIONS[def.stations[task.step]], 1.5)) return { error: 'Görev alanından uzaklaştın.' };
    this.completeTask(p, g, task);
    return { ok: true };
  }

  onTaskClose(p) {
    const g = this.gp(p);
    if (!g) return;
    g.active = null;
    g.busy = false;
  }

  completeTask(p, g, task) {
    if (task.done) return;
    task.done = true;
    // impostor tasks are fake and never count
    if (g.role === 'crew') {
      g.done++;
      this.game.doneTasks++;
      this.checkWin();
    }
  }

  // ---------- impostor actions ----------
  onKill(p, d) {
    const g = this.gp(p);
    const v = this.game && this.game.ps.get(d.target);
    const t = now();
    if (!g || !v || this.phase !== 'play' || g.role !== 'imp' || !g.alive) return { error: 'Geçersiz.' };
    if (t < g.killAt) return { error: 'Bekleme süresi dolmadı.' };
    if (!v.alive || v.role === 'imp' || v.left) return { error: 'Geçersiz hedef.' };
    if (dist(g, v) > GAME.killRange + 0.4) return { error: 'Hedef çok uzakta.' };
    v.alive = false;
    v.busy = false;
    v.active = null;
    v.carry = null;
    v.killedBy = g.id;
    this.game.bodies.push({ id: v.id, x: v.x, z: v.z });
    g.killAt = t + this.settings.killCooldown * 1000;
    this.teleport(p, g, v.x, v.z);
    const vm = this.players.get(v.id);
    this.sendTo(vm, 'killed', { by: g.id });
    for (const m of this.members) {
      const q = this.gp(m);
      if (q && (!q.alive || dist(q, v) <= this.visionOf(q) + 2)) this.sendTo(m, 'fx', { type: 'poof', x: v.x, z: v.z, id: v.id });
    }
    this.checkWin();
    return { ok: true };
  }

  onTunnel(p) {
    const g = this.gp(p);
    const t = now();
    if (!g || this.phase !== 'play' || g.role !== 'imp' || !g.alive || g.carry || t < g.tunnelAt) return { error: 'Geçit kullanılamaz.' };
    const i = TUNNELS.findIndex(tn => dist(g, tn) <= GAME.tunnelRange + 0.5);
    if (i < 0) return { error: 'Yakında gizli geçit yok.' };
    const to = TUNNELS[(i + 1) % TUNNELS.length];
    g.tunnelAt = t + 900;
    g.busy = false;
    g.active = null;
    this.teleport(p, g, to.x, to.z);
    return { ok: true };
  }

  onSabotage(p, d) {
    const g = this.gp(p);
    const G = this.game;
    const t = now();
    if (!g || this.phase !== 'play' || g.role !== 'imp' || g.left) return { error: 'Geçersiz.' };
    if (G.sab) return { error: 'Zaten bir sabotaj aktif.' };
    if (t < G.sabReadyAt) return { error: 'Sabotaj henüz hazır değil.' };
    const def = SAB_DEFS[d.type];
    if (!def) return { error: 'Bilinmeyen sabotaj.' };
    const s = { type: d.type, start: t };
    if (def.critical && this.settings.criticalWin) s.ends = t + def.time * 1000;
    if (d.type === 'doors') {
      const b = BUILDINGS.find(b => b.id === d.target && b.lock);
      if (!b) return { error: 'Geçersiz bina.' };
      s.target = b.id;
      s.ends = t + def.time * 1000;
    }
    if (d.type === 'alarm') {
      s.zone = pick(ZONES).id;
      s.ends = t + def.time * 1000;
    }
    if (d.type === 'feed' || d.type === 'chicks') {
      const spots = shuffle(d.type === 'feed' ? FEED_SPOTS : CHICK_SPOTS).slice(0, 5);
      s.items = spots.map((sp, i) => ({ id: i, x: sp.x, z: sp.z }));
      s.total = s.items.length;
    }
    G.sab = s;
    for (const m of this.members) if (G.ps.has(m.id)) this.sendTo(m, 'sab', { type: s.type, target: s.target, zone: s.zone });
    return { ok: true };
  }

  clearSab(fixedBy) {
    const G = this.game;
    if (!G.sab) return;
    const type = G.sab.type;
    G.sab = null;
    G.sabReadyAt = now() + GAME.sabCooldown * 1000;
    for (const m of this.members) if (G.ps.has(m.id)) this.sendTo(m, 'sabEnd', { type, by: fixedBy || null });
  }

  onFixOpen(p, d) {
    const g = this.gp(p);
    const s = this.game && this.game.sab;
    if (!g || !g.alive || this.phase !== 'play' || !s) return { error: 'Onarılacak bir şey yok.' };
    if (s.type === 'lights' && this.near(g, STATIONS.elec)) { g.active = { fix: 'lights', t: now() }; g.busy = true; return { ok: true, minigame: 'lights' }; }
    if (s.type === 'water' && this.near(g, STATIONS.sabpipe)) { g.active = { fix: 'water', t: now() }; g.busy = true; return { ok: true, minigame: 'pipes' }; }
    if (s.type === 'doors' && DOORS.some(dr => dr.b === s.target && Math.hypot(g.x - dr.cx, g.z - dr.cz) <= 2.6)) {
      g.active = { fix: 'doors', t: now() }; g.busy = true; return { ok: true, minigame: 'doorlock' };
    }
    if (s.items) {
      const it = s.items.find(i => i.id === d.id && dist(g, i) <= GAME.useRange + 0.6);
      if (!it) return { error: 'Biraz daha yaklaş.' };
      s.items = s.items.filter(i => i !== it);
      if (!s.items.length) this.clearSab(p.id);
      return { ok: true, collected: true };
    }
    return { error: 'Onarım noktasına yaklaş.' };
  }

  onFixDone(p) {
    const g = this.gp(p);
    const s = this.game && this.game.sab;
    if (!g || !g.active || !g.active.fix) return { error: 'Geçersiz.' };
    const { fix, t } = g.active;
    g.active = null;
    g.busy = false;
    if (!s || s.type !== fix) return { ok: true };
    if (now() - t < 1000) return { error: 'Çok hızlı.' };
    this.clearSab(p.id);
    return { ok: true };
  }

  // ---------- meetings ----------
  onReport(p, d) {
    const g = this.gp(p);
    if (!g || !g.alive || this.phase !== 'play') return { error: 'Şu an raporlanamaz.' };
    const body = this.game.bodies.find(b => b.id === d.body);
    if (!body || dist(g, body) > GAME.reportRange + 0.5) return { error: 'Yakında bayılmış civciv yok.' };
    this.startMeeting(p, body.id);
    return { ok: true };
  }

  onBell(p) {
    const g = this.gp(p);
    const t = now();
    if (!g || !g.alive || this.phase !== 'play') return { error: 'Şu an toplantı çağrılamaz.' };
    if (!this.near(g, STATIONS.bell)) return { error: 'Zile yaklaş.' };
    if (g.bells <= 0) return { error: 'Acil toplantı hakkın bitti.' };
    if (t < g.bellReadyAt) return { error: `Zil ${Math.ceil((g.bellReadyAt - t) / 1000)} sn sonra kullanılabilir.` };
    const s = this.game.sab;
    if (s && SAB_DEFS[s.type].critical) return { error: 'Kritik sabotaj sırasında zil çalınamaz!' };
    g.bells--;
    this.startMeeting(p, null);
    return { ok: true };
  }

  startMeeting(p, bodyId) {
    const G = this.game;
    const t = now();
    const disc = this.settings.discussion;
    G.meeting = {
      caller: p.id, body: bodyId,
      stage: disc > 0 ? 'discuss' : 'vote',
      ends: t + (disc > 0 ? disc : this.settings.voting) * 1000,
      votes: new Map(), result: null,
    };
    this.phase = 'meeting';
    if (G.sab) { G.sab = null; G.sabReadyAt = t + GAME.sabCooldown * 1000; }
    for (const q of G.ps.values()) {
      q.busy = false; q.active = null; q.m = false;
      if (!q.alive) q.deathPublic = true;
    }
    this.emitRoster();
    this.emitAll('meeting', { caller: p.id, body: bodyId });
  }

  meetingPublic(t) {
    const M = this.game.meeting;
    const o = { stage: M.stage, left: Math.max(0, M.ends - t), caller: M.caller, body: M.body, voted: [...M.votes.keys()] };
    if (M.result) o.result = M.result;
    return o;
  }

  onVote(p, d) {
    const g = this.gp(p);
    const M = this.game && this.game.meeting;
    if (!g || !M || this.phase !== 'meeting' || M.stage !== 'vote') return { error: 'Şu an oy verilemez.' };
    if (!g.alive) return { error: 'Elenen oyuncular oy kullanamaz.' };
    if (M.votes.has(g.id)) return { error: 'Zaten oy kullandın.' };
    const target = d.target === 'skip' ? 'skip' : this.game.ps.get(d.target);
    if (target !== 'skip' && (!target || !target.alive || target.left)) return { error: 'Geçersiz oy.' };
    M.votes.set(g.id, target === 'skip' ? 'skip' : target.id);
    this.emitAll('voted', { id: g.id });
    const alive = [...this.game.ps.values()].filter(q => q.alive && !q.left);
    if (alive.every(q => M.votes.has(q.id))) M.ends = now();
    return { ok: true };
  }

  meetingTick(t) {
    const G = this.game;
    const M = G.meeting;
    if (t < M.ends) return;
    if (M.stage === 'discuss') {
      M.stage = 'vote';
      M.ends = t + this.settings.voting * 1000;
      return;
    }
    if (M.stage === 'vote') {
      const tally = {};
      const byTarget = {};
      for (const [voter, target] of M.votes) {
        tally[target] = (tally[target] || 0) + 1;
        (byTarget[target] = byTarget[target] || []).push(voter);
      }
      let best = null, bestN = 0, tie = false;
      for (const [k, n] of Object.entries(tally)) {
        if (n > bestN) { best = k; bestN = n; tie = false; } else if (n === bestN) tie = true;
      }
      const ejected = !tie && best && best !== 'skip' ? G.ps.get(best) : null;
      const result = { ejected: ejected ? ejected.id : null, tie, skipped: !ejected && !tie, counts: tally };
      if (!this.settings.anonVotes) result.votes = byTarget;
      if (ejected) {
        ejected.alive = false;
        ejected.deathPublic = true;
        if (this.settings.confirmEjects) {
          result.wasImp = ejected.role === 'imp';
          result.impsLeft = [...G.ps.values()].filter(q => q.role === 'imp' && q.alive && !q.left).length;
        }
      }
      M.result = result;
      M.stage = 'result';
      M.ends = t + GAME.resultMs;
      this.emitRoster();
      return;
    }
    // result shown -> back to the farm
    this.endMeeting(t);
  }

  endMeeting(t) {
    const G = this.game;
    G.meeting = null;
    G.bodies = [];
    if (this.checkWin()) return;
    this.phase = 'play';
    G.sabReadyAt = Math.max(G.sabReadyAt, t + 15000);
    const order = shuffle(SPAWN);
    let i = 0;
    for (const m of this.members) {
      const q = G.ps.get(m.id);
      if (!q || q.left) continue;
      const sp = order[i++ % order.length];
      this.teleport(m, q, sp.x, sp.z);
      q.bellReadyAt = t + GAME.meetingCooldown * 1000;
      if (q.role === 'imp') q.killAt = t + this.settings.killCooldown * 1000;
    }
    this.emitAll('meetingEnd', {});
  }

  // ---------- chat & emotes ----------
  onChat(p, d) {
    const t = now();
    if (typeof d.text !== 'string') return;
    const text = d.text.replace(/[\u0000-\u001f]/g, '').trim().slice(0, GAME.chatMax);
    if (!text) return { error: 'Boş mesaj gönderilemez.' };
    if (t - p.chatAt < 700) return { error: 'Çok hızlı yazıyorsun.' };
    p.chatAt = t;
    const msg = { from: p.id, name: p.name, color: p.color, text };
    const g = this.gp(p);
    if (!this.inGame() || !g || p.waiting) {
      const lobbyOnly = this.inGame();
      for (const m of this.members) if (!lobbyOnly || m.waiting || !this.gp(m)) this.sendTo(m, 'chat', { ...msg, ch: 'lobby' });
      return { ok: true };
    }
    if (!g.alive) {
      for (const m of this.members) { const q = this.gp(m); if (q && !q.alive) this.sendTo(m, 'chat', { ...msg, ch: 'ghost' }); }
      return { ok: true };
    }
    if (this.phase === 'play' || this.phase === 'intro') {
      if (!this.settings.playChat) return { error: 'Bu odada maç sırasında sohbet kapalı. Toplantıyı bekle.' };
      for (const m of this.members) if (this.gp(m)) this.sendTo(m, 'chat', { ...msg, ch: 'play' });
      return { ok: true };
    }
    for (const m of this.members) if (this.gp(m)) this.sendTo(m, 'chat', { ...msg, ch: 'meeting' });
    return { ok: true };
  }

  onEmote(p, d) {
    const g = this.gp(p);
    const t = now();
    if (!g || g.left || this.phase !== 'play' || t - g.emoteAt < 900) return;
    if (!EMOTES.some(e => e.id === d.e) && d.e !== 'jump') return;
    g.emoteAt = t;
    for (const m of this.members) {
      const q = this.gp(m);
      if (q && this.canSee(q, g)) this.sendTo(m, 'emote', { id: g.id, e: d.e });
    }
  }

  onBusy(p, v) {
    // fake task animation for impostors (crew busy state is set by real task opening)
    const g = this.gp(p);
    if (g && g.alive && g.role === 'imp' && this.phase === 'play') g.busy = !!v;
  }

  farmEvent(t) {
    const G = this.game;
    G.nextEventAt = t + 35000 + Math.random() * 30000;
    const type = pick(['duck', 'rooster', 'egg', 'goat', 'tractor', 'hay', 'hens']);
    const ev = { type, seed: Math.floor(Math.random() * 1e6) };
    if (type === 'hay') {
      const alive = [...G.ps.values()].filter(q => q.alive && !q.left);
      if (alive.length) ev.target = pick(alive).id;
    }
    this.emitAll('farm', ev);
  }

  // ---------- win conditions ----------
  checkWin() {
    const G = this.game;
    if (!G || this.phase === 'lobby') return false;
    const ps = [...G.ps.values()].filter(q => !q.left);
    const crew = ps.filter(q => q.alive && q.role === 'crew').length;
    const imps = ps.filter(q => q.alive && q.role === 'imp').length;
    if (imps === 0) { this.endGame('crew', 'imps_gone'); return true; }
    if (imps >= crew) { this.endGame('imp', 'kills'); return true; }
    if (G.totalTasks > 0 && G.doneTasks >= G.totalTasks) { this.endGame('crew', 'tasks'); return true; }
    return false;
  }

  endGame(winner, reason) {
    const G = this.game;
    clearInterval(this.timer);
    this.timer = null;
    const result = {
      winner, reason,
      duration: Math.round((now() - G.start) / 1000),
      progress: this.progress(),
      players: [...G.ps.values()].map(q => {
        const m = this.players.get(q.id);
        return {
          id: q.id, name: m ? m.name : 'Ayrılan oyuncu', color: m ? m.color : 'gri', hat: m ? m.hat : 'none',
          role: q.role, alive: q.alive, left: q.left,
          tasksDone: q.role === 'crew' ? q.done : 0, tasksTotal: q.role === 'crew' ? q.tasks.length : 0,
        };
      }),
    };
    this.game = null;
    this.phase = 'lobby';
    for (const m of this.members) { m.waiting = false; m.ready = false; }
    this.emitAll('game:over', result);
    this.broadcastLobby();
  }
}
