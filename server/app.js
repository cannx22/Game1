// Civciv Kıyameti sunucusu: istemci dosyalarını sunar, odaları ve gerçek zamanlı bağlantıları yönetir.
// Hem komut satırından (server/index.js) hem de masaüstü uygulamasının içinden başlatılır.
import express from 'express';
import http from 'http';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { Server } from 'socket.io';
import { Room } from './room.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

export function lanAddresses() {
  return Object.values(os.networkInterfaces()).flat().filter(n => n && n.family === 'IPv4' && !n.internal).map(n => n.address);
}

// Resolves with { server, port } once listening; rejects (e.g. EADDRINUSE) instead of exiting.
export function startServer(port) {
  const app = express();
  app.use(express.static(path.join(root, 'client')));
  app.use('/shared', express.static(path.join(root, 'shared')));
  app.use('/vendor/three', express.static(path.join(root, 'node_modules/three/build')));
  app.use('/vendor/socket.io', express.static(path.join(root, 'node_modules/socket.io-client/dist')));
  app.get('/health', (_req, res) => res.json({ ok: true, game: 'civciv-kiyameti', rooms: rooms.size }));

  const server = http.createServer(app);
  const io = new Server(server, { maxHttpBufferSize: 16 * 1024, serveClient: false, pingInterval: 10000, pingTimeout: 8000 });

  const rooms = new Map(); // code -> Room
  const tokens = new Map(); // token -> { code, pid }
  const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

  function newCode() {
    for (;;) {
      let c = '';
      for (let i = 0; i < 5; i++) c += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
      if (!rooms.has(c)) return c;
    }
  }

  function onRoomEmpty(room) {
    rooms.delete(room.code);
    for (const [t, v] of tokens) if (v.code === room.code) tokens.delete(t);
  }

  const obj = d => (d && typeof d === 'object' && !Array.isArray(d) ? d : {});

  io.on('connection', socket => {
    // simple flood protection: at most 60 packets per second per connection
    let windowStart = Date.now();
    let count = 0;
    socket.use((_packet, next) => {
      const t = Date.now();
      if (t - windowStart > 1000) { windowStart = t; count = 0; }
      if (++count > 60) return next(new Error('rate'));
      next();
    });
    socket.on('error', () => {});

    const ctx = () => {
      const room = rooms.get(socket.data.code);
      const p = room && room.players.get(socket.data.pid);
      return p && p.socketId === socket.id ? { room, p } : null;
    };
    const reply = (ack, v) => { if (typeof ack === 'function') ack(v); };

    function enter(room, p, ack) {
      socket.data.code = room.code;
      socket.data.pid = p.id;
      tokens.set(p.token, { code: room.code, pid: p.id });
      reply(ack, { ok: true, code: room.code, id: p.id, token: p.token, state: room.lobbyState() });
    }

    function leaveCurrent() {
      const c = ctx();
      if (!c) return;
      tokens.delete(c.p.token);
      c.room.removePlayer(c.p.id);
      socket.data.code = null;
      socket.data.pid = null;
    }

    socket.on('room:create', (d, ack) => {
      d = obj(d);
      leaveCurrent();
      const code = newCode();
      const room = new Room(io, code, { name: d.name, isPublic: d.isPublic }, onRoomEmpty);
      rooms.set(code, room);
      const res = room.addPlayer(socket, obj(d.profile));
      if (res.error) return reply(ack, res);
      room.updateSettings(res.player, obj(d.settings));
      enter(room, res.player, ack);
    });

    socket.on('room:join', (d, ack) => {
      d = obj(d);
      const code = String(d.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      const room = rooms.get(code);
      if (!room) return reply(ack, { error: 'Bu kodla bir oda bulunamadı. Kodu kontrol et.' });
      const cur = ctx();
      if (cur && cur.room === room) return enter(room, cur.p, ack);
      leaveCurrent();
      const res = room.addPlayer(socket, obj(d.profile));
      if (res.error) return reply(ack, res);
      enter(room, res.player, ack);
    });

    socket.on('room:list', (_d, ack) => {
      reply(ack, [...rooms.values()].filter(r => r.isPublic && r.players.size).map(r => r.publicInfo()));
    });

    socket.on('room:leave', (_d, ack) => { leaveCurrent(); reply(ack, { ok: true }); });

    socket.on('resume', (d, ack) => {
      const info = tokens.get(String(obj(d).token || ''));
      const room = info && rooms.get(info.code);
      const p = room && room.players.get(info.pid);
      if (!p) return reply(ack, { error: 'Oturum bulunamadı.' });
      socket.data.code = room.code;
      socket.data.pid = p.id;
      room.attach(p, socket);
      reply(ack, { ok: true, code: room.code, id: p.id, token: p.token, state: room.lobbyState() });
    });

    // Room-scoped events: [event, handler, needs ack]
    const handlers = {
      'lobby:profile': (c, d) => c.room.setProfile(c.p, d),
      'lobby:ready': (c, d) => c.room.setReady(c.p, d.ready),
      'lobby:settings': (c, d) => c.room.updateSettings(c.p, d),
      'game:start': c => c.room.startGame(c.p),
      move: (c, d) => c.room.onMove(c.p, d),
      'task:open': (c, d) => c.room.onTaskOpen(c.p, d),
      'task:done': (c, d) => c.room.onTaskDone(c.p, d),
      'task:close': c => c.room.onTaskClose(c.p),
      kill: (c, d) => c.room.onKill(c.p, d),
      report: (c, d) => c.room.onReport(c.p, d),
      bell: c => c.room.onBell(c.p),
      tunnel: c => c.room.onTunnel(c.p),
      sabotage: (c, d) => c.room.onSabotage(c.p, d),
      'fix:open': (c, d) => c.room.onFixOpen(c.p, d),
      'fix:done': c => c.room.onFixDone(c.p),
      vote: (c, d) => c.room.onVote(c.p, d),
      chat: (c, d) => c.room.onChat(c.p, d),
      emote: (c, d) => c.room.onEmote(c.p, d),
      busy: (c, d) => c.room.onBusy(c.p, d.busy),
    };
    for (const [ev, fn] of Object.entries(handlers)) {
      socket.on(ev, (d, ack) => {
        const c = ctx();
        if (!c) return reply(ack, { error: 'Bir odada değilsin.' });
        try {
          const res = fn(c, obj(d));
          reply(ack, res || { ok: true });
        } catch (err) {
          console.error(`[${ev}]`, err);
          reply(ack, { error: 'Sunucu hatası.' });
        }
      });
    }

    socket.on('disconnect', () => {
      const c = ctx();
      if (c) c.room.disconnect(c.p);
    });
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '0.0.0.0', () => {
      server.off('error', reject);
      resolve({ server, io, port });
    });
  });
}
