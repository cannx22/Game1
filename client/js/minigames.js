// Görev ve onarım mini oyunları. Her biri bir DOM kabına kurulur ve bitince done() çağırır.
const el = (tag, cls = '', text = '') => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
};
const shuffle = a => {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; }
  return b;
};
const rint = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

function shake(node) {
  node.classList.remove('mg-shake');
  void node.offsetWidth;
  node.classList.add('mg-shake');
}

// Drag `item` and drop it on an element matching `.mg-slot`; accept(slot) decides.
function draggable(item, accept) {
  let sx = 0, sy = 0, dragging = false;
  item.addEventListener('pointerdown', e => {
    dragging = true;
    sx = e.clientX; sy = e.clientY;
    item.setPointerCapture(e.pointerId);
    item.style.transition = 'none';
    item.classList.add('mg-dragging');
  });
  item.addEventListener('pointermove', e => {
    if (!dragging) return;
    item.style.transform = `translate(${e.clientX - sx}px, ${e.clientY - sy}px)`;
  });
  item.addEventListener('pointerup', e => {
    if (!dragging) return;
    dragging = false;
    item.classList.remove('mg-dragging');
    item.style.pointerEvents = 'none';
    const under = document.elementFromPoint(e.clientX, e.clientY);
    item.style.pointerEvents = '';
    const slot = under && under.closest('.mg-slot');
    item.style.transition = 'transform .2s';
    item.style.transform = '';
    if (slot) accept(slot);
  });
}

const GAMES = {
  eggs(host, { done, sfx }) {
    const info = el('div', 'mg-info', 'Sepet: 0 / 5');
    const grid = el('div', 'mg-nests');
    host.append(el('p', 'mg-hint', 'Sağlam yumurtalara tıkla. Yeşil çürük yumurtaları alma!'), info, grid);
    let got = 0, locked = false;
    for (const kind of shuffle(['g', 'g', 'g', 'g', 'g', 'r', 'r', 'e'])) {
      const nest = el('div', 'mg-nest');
      if (kind !== 'e') {
        const egg = el('div', `mg-egg ${kind === 'r' ? 'rotten' : ''}`, '🥚');
        egg.onclick = () => {
          if (locked || egg.classList.contains('taken')) return;
          if (kind === 'r') {
            sfx.fail(); shake(grid); locked = true;
            info.textContent = 'Çürük yumurta! Kokusu çok kötü...';
            setTimeout(() => { locked = false; info.textContent = `Sepet: ${got} / 5`; }, 900);
            return;
          }
          egg.classList.add('taken');
          sfx.pop();
          got++;
          info.textContent = `Sepet: ${got} / 5`;
          if (got === 5) done();
        };
        nest.append(egg);
      }
      grid.append(nest);
    }
  },

  clean(host, { done, sfx }) {
    host.append(el('p', 'mg-hint', 'Fareyi basılı tutup kirli alanların üzerinden geçir.'));
    const wrap = el('div', 'mg-canvas-wrap');
    const cv = el('canvas', 'mg-canvas mg-broom');
    cv.width = 440; cv.height = 260;
    wrap.append(cv);
    const bar = el('div', 'mg-bar'), fill = el('div', 'mg-bar-fill');
    bar.append(fill);
    host.append(wrap, bar);
    const g = cv.getContext('2d');
    for (let i = 0; i < 9; i++) {
      g.fillStyle = i % 3 ? 'rgba(110,78,50,0.95)' : 'rgba(90,110,40,0.9)';
      g.beginPath();
      const x = rint(50, 390), y = rint(40, 220);
      for (let k = 0; k < 6; k++) g.ellipse(x + rint(-25, 25), y + rint(-20, 20), rint(18, 40), rint(14, 30), Math.random() * 3, 0, Math.PI * 2);
      g.fill();
    }
    for (let i = 0; i < 40; i++) { g.fillStyle = 'rgba(233,196,106,0.95)'; g.fillRect(rint(20, 420), rint(20, 240), rint(10, 22), 3); }
    const count = () => { const d = g.getImageData(0, 0, 440, 260).data; let n = 0; for (let i = 3; i < d.length; i += 16) if (d[i] > 40) n++; return n; };
    const total = count();
    let down = false, finished = false;
    const scrub = e => {
      if (!down || finished) return;
      const r = cv.getBoundingClientRect();
      const x = (e.clientX - r.left) * (440 / r.width), y = (e.clientY - r.top) * (260 / r.height);
      g.globalCompositeOperation = 'destination-out';
      g.beginPath(); g.arc(x, y, 28, 0, Math.PI * 2); g.fill();
      g.globalCompositeOperation = 'source-over';
    };
    cv.addEventListener('pointerdown', e => { down = true; cv.setPointerCapture(e.pointerId); scrub(e); });
    cv.addEventListener('pointermove', scrub);
    cv.addEventListener('pointerup', () => { down = false; });
    const iv = setInterval(() => {
      const left = count() / total;
      fill.style.width = `${Math.round((1 - left) * 100)}%`;
      if (left < 0.06 && !finished) { finished = true; sfx.success(); done(); }
      else if (down) sfx.step();
    }, 250);
    return () => clearInterval(iv);
  },

  incubator(host, { done, sfx }) {
    host.append(el('p', 'mg-hint', 'İki göstergeyi de yeşil aralığa getir ve 2 saniye orada tut.'));
    const specs = [
      { name: 'Sıcaklık', unit: '°C', min: 30, max: 45, lo: rint(35, 38), w: 2, step: 0.1 },
      { name: 'Nem', unit: '%', min: 20, max: 90, lo: rint(45, 65), w: 8, step: 1 },
    ];
    const ok = [];
    specs.forEach((s, i) => {
      const row = el('div', 'mg-gauge');
      const label = el('div', 'mg-gauge-label', `${s.name}: hedef ${s.lo}–${s.lo + s.w} ${s.unit}`);
      const track = el('div', 'mg-track');
      const band = el('div', 'mg-band');
      band.style.left = `${((s.lo - s.min) / (s.max - s.min)) * 100}%`;
      band.style.width = `${(s.w / (s.max - s.min)) * 100}%`;
      const input = el('input', 'mg-range');
      Object.assign(input, { type: 'range', min: s.min, max: s.max, step: s.step, value: i ? s.min + 2 : s.max - 1 });
      const val = el('div', 'mg-gauge-val');
      const upd = () => {
        const v = Number(input.value);
        val.textContent = `${v.toFixed(s.step < 1 ? 1 : 0)} ${s.unit}`;
        ok[i] = v >= s.lo && v <= s.lo + s.w;
        val.classList.toggle('good', ok[i]);
      };
      input.oninput = upd;
      upd();
      track.append(band, input);
      row.append(label, track, val);
      host.append(row);
    });
    const bar = el('div', 'mg-bar'), fill = el('div', 'mg-bar-fill');
    bar.append(fill);
    host.append(bar);
    let held = 0, finished = false;
    const iv = setInterval(() => {
      held = ok.every(Boolean) ? held + 0.1 : 0;
      fill.style.width = `${Math.min(100, (held / 2) * 100)}%`;
      if (held >= 2 && !finished) { finished = true; sfx.success(); done(); }
    }, 100);
    return () => clearInterval(iv);
  },

  sorteggs(host, { done, sfx }) {
    host.append(el('p', 'mg-hint', 'Yumurtaları sürükleyip boyutlarına uygun kasaya bırak.'));
    const tray = el('div', 'mg-tray');
    const crates = el('div', 'mg-crates');
    const sizes = [['k', 'Küçük'], ['o', 'Orta'], ['b', 'Büyük']];
    for (const [k, name] of sizes) {
      const c = el('div', 'mg-slot mg-crate');
      c.dataset.key = k;
      c.append(el('div', 'mg-crate-label', name));
      crates.append(c);
    }
    let placed = 0;
    for (const k of shuffle(['k', 'k', 'o', 'o', 'b', 'b'])) {
      const egg = el('div', `mg-drag mg-egg-size size-${k}`, '🥚');
      draggable(egg, slot => {
        if (slot.dataset.key !== k) { sfx.fail(); shake(slot); return; }
        sfx.pop();
        egg.style.transform = '';
        slot.append(egg);
        egg.style.pointerEvents = 'none';
        if (++placed === 6) done();
      });
      tray.append(egg);
    }
    host.append(tray, crates);
  },

  packing(host, { done, sfx }) {
    host.append(el('p', 'mg-hint', 'Beyaz yumurtaları sola, kahverengileri sağa gönder (← → tuşları da çalışır).'));
    const info = el('div', 'mg-info', 'Paketlenen: 0 / 8');
    const belt = el('div', 'mg-belt');
    const egg = el('div', 'mg-belt-egg', '🥚');
    belt.append(egg);
    const btns = el('div', 'mg-row');
    const left = el('button', 'mg-btn', '◀ Beyaz kasa');
    const right = el('button', 'mg-btn', 'Kahverengi kasa ▶');
    btns.append(left, right);
    host.append(info, belt, btns);
    let n = 0, cur = 'w', t0 = 0, finished = false;
    const next = () => {
      cur = Math.random() < 0.5 ? 'w' : 'b';
      egg.classList.toggle('brown', cur === 'b');
      egg.style.transition = 'none';
      egg.style.left = '-10%';
      void egg.offsetWidth;
      egg.style.transition = 'left 2.6s linear';
      egg.style.left = '90%';
      t0 = performance.now();
    };
    const choose = side => {
      if (finished) return;
      if (side !== cur) { sfx.fail(); shake(belt); next(); return; }
      sfx.pop();
      info.textContent = `Paketlenen: ${++n} / 8`;
      if (n >= 8) { finished = true; done(); return; }
      next();
    };
    left.onclick = () => choose('w');
    right.onclick = () => choose('b');
    const key = e => { if (e.key === 'ArrowLeft') choose('w'); if (e.key === 'ArrowRight') choose('b'); };
    window.addEventListener('keydown', key);
    const iv = setInterval(() => { if (!finished && performance.now() - t0 > 2700) { sfx.fail(); next(); } }, 200);
    next();
    return () => { clearInterval(iv); window.removeEventListener('keydown', key); };
  },

  feedmix(host, { done, sfx }) {
    const ings = [['corn', '🌽', 'Mısır'], ['wheat', '🌾', 'Buğday'], ['sun', '🌻', 'Ayçiçeği'], ['carrot', '🥕', 'Havuç']];
    const used = shuffle(ings).slice(0, 3);
    const recipe = Object.fromEntries(used.map(i => [i[0], rint(1, 3)]));
    const have = Object.fromEntries(ings.map(i => [i[0], 0]));
    host.append(el('p', 'mg-hint', 'Tarifteki miktarları kaseye ekle, sonra karıştır.'));
    const rec = el('div', 'mg-recipe');
    rec.append(el('b', '', 'Tarif: '));
    for (const [id, icon, name] of used) rec.append(el('span', 'mg-chip', `${icon} ${name} × ${recipe[id]}`));
    const bowl = el('div', 'mg-bowl');
    const renderBowl = () => {
      bowl.textContent = ings.map(([id, icon]) => icon.repeat(have[id])).join('') || 'Kase boş';
    };
    const row = el('div', 'mg-row');
    for (const [id, icon, name] of ings) {
      const b = el('button', 'mg-btn', `${icon} ${name}`);
      b.onclick = () => { if (have[id] < 5) { have[id]++; sfx.click(); renderBowl(); } };
      row.append(b);
    }
    const row2 = el('div', 'mg-row');
    const reset = el('button', 'mg-btn ghost', 'Boşalt');
    const mix = el('button', 'mg-btn primary', 'Karıştır!');
    reset.onclick = () => { for (const k in have) have[k] = 0; renderBowl(); };
    mix.onclick = () => {
      const ok = ings.every(([id]) => have[id] === (recipe[id] || 0));
      if (!ok) { sfx.fail(); shake(bowl); bowl.textContent = 'Oranlar yanlış! Kase boşaltıldı.'; for (const k in have) have[k] = 0; return; }
      bowl.classList.add('spin');
      sfx.success();
      mix.disabled = true;
      setTimeout(done, 800);
    };
    row2.append(reset, mix);
    host.append(rec, bowl, row, row2);
    renderBowl();
  },

  tools(host, { done, sfx }) {
    host.append(el('p', 'mg-hint', 'Her aleti duvardaki gölgesinin üzerine sürükle.'));
    const list = shuffle([['hammer', '🔨'], ['axe', '🪓'], ['broom', '🧹'], ['bucket', '🪣'], ['wrench', '🔧']]).slice(0, 4);
    const wall = el('div', 'mg-wall');
    for (const [k, icon] of shuffle(list)) {
      const s = el('div', 'mg-slot mg-tool-slot', icon);
      s.dataset.key = k;
      wall.append(s);
    }
    const floor = el('div', 'mg-tray');
    let placed = 0;
    for (const [k, icon] of list) {
      const t = el('div', 'mg-drag mg-tool', icon);
      draggable(t, slot => {
        if (slot.dataset.key !== k || slot.classList.contains('filled')) { sfx.fail(); shake(slot); return; }
        sfx.pop();
        slot.classList.add('filled');
        t.remove();
        if (++placed === list.length) done();
      });
      floor.append(t);
    }
    host.append(wall, floor);
  },

  fence(host, { done, sfx }) {
    host.append(el('p', 'mg-hint', 'Tahtaları çitteki boşluklara sürükle.'));
    const fence = el('div', 'mg-fence');
    const gaps = new Set(shuffle([0, 1, 2, 3, 4, 5]).slice(0, 3));
    for (let i = 0; i < 6; i++) {
      const b = el('div', gaps.has(i) ? 'mg-slot mg-board gap' : 'mg-board');
      fence.append(b);
    }
    const pile = el('div', 'mg-tray');
    let placed = 0;
    for (let i = 0; i < 3; i++) {
      const p = el('div', 'mg-drag mg-plank');
      draggable(p, slot => {
        if (!slot.classList.contains('gap') || slot.classList.contains('filled')) return;
        slot.classList.add('filled');
        sfx.thud();
        p.remove();
        if (++placed === 3) done();
      });
      pile.append(p);
    }
    host.append(fence, pile);
  },

  tractor(host, { done, sfx }) {
    host.append(el('p', 'mg-hint', 'Adımları sırayla uygula. Yanlış sıra her şeyi sıfırlar!'));
    const steps = ['Kontağı aç', 'Yakıtı kontrol et', 'Motor göstergesini yeşile getir', 'Traktörü çalıştır'];
    const list = el('ol', 'mg-steps');
    const items = steps.map(s => { const li = el('li', '', s); list.append(li); return li; });
    let cur = 0;
    const mark = () => items.forEach((li, i) => { li.classList.toggle('done', i < cur); li.classList.toggle('now', i === cur); });
    const fail = () => { sfx.fail(); shake(list); cur = 0; gauge.value = 10; fuel.style.width = '0%'; mark(); };
    const advance = i => { if (i !== cur) return fail(); sfx.click(); cur++; mark(); };
    const row = el('div', 'mg-row');
    const key = el('button', 'mg-btn', '🔑 Kontak');
    const fuelBtn = el('button', 'mg-btn', '⛽ Yakıt');
    const start = el('button', 'mg-btn primary', '🟢 Çalıştır');
    const fuelBar = el('div', 'mg-bar'), fuel = el('div', 'mg-bar-fill');
    fuelBar.append(fuel);
    const gWrap = el('div', 'mg-track');
    const band = el('div', 'mg-band');
    band.style.left = '60%'; band.style.width = '18%';
    const gauge = el('input', 'mg-range');
    Object.assign(gauge, { type: 'range', min: 0, max: 100, value: 10 });
    gWrap.append(band, gauge);
    key.onclick = () => advance(0);
    fuelBtn.onclick = () => { if (cur !== 1) return fail(); fuel.style.width = '85%'; advance(1); };
    gauge.onchange = () => {
      const v = Number(gauge.value);
      if (v >= 60 && v <= 78) { if (cur === 2) advance(2); else fail(); }
    };
    start.onclick = () => {
      if (cur !== 3) return fail();
      cur = 4; mark();
      host.classList.add('mg-rumble');
      sfx.thud();
      setTimeout(done, 700);
    };
    row.append(key, fuelBtn, start);
    host.append(list, row, el('div', 'mg-gauge-label', 'Yakıt seviyesi'), fuelBar, el('div', 'mg-gauge-label', 'Motor göstergesi'), gWrap);
    mark();
  },

  watering(host, { done, sfx }) {
    const plants = [['carrot', '🥕', 'Havuç'], ['tomato', '🍅', 'Domates'], ['corn', '🌽', 'Mısır'], ['lettuce', '🥬', 'Marul']];
    const order = shuffle(plants);
    host.append(el('p', 'mg-hint', 'Vanaları şu sırayla aç:'));
    const seq = el('div', 'mg-recipe');
    order.forEach((p, i) => seq.append(el('span', 'mg-chip', `${i + 1}. ${p[1]} ${p[2]}`)));
    const bed = el('div', 'mg-bed');
    let cur = 0;
    const cells = new Map();
    for (const p of plants) {
      const c = el('div', 'mg-plant');
      const icon = el('div', 'mg-plant-icon', p[1]);
      const btn = el('button', 'mg-btn', '🔴 Vana');
      btn.onclick = () => {
        if (order[cur][0] !== p[0]) {
          sfx.fail(); shake(bed); cur = 0;
          for (const v of cells.values()) { v.c.classList.remove('wet'); v.btn.textContent = '🔴 Vana'; }
          return;
        }
        sfx.splash();
        c.classList.add('wet');
        btn.textContent = '🟢 Açık';
        if (++cur === 4) done();
      };
      c.append(el('div', 'mg-drops', '💧💧💧'), icon, btn);
      cells.set(p[0], { c, btn });
      bed.append(c);
    }
    host.append(seq, bed);
  },

  bugs(host, { done, sfx }) {
    host.append(el('p', 'mg-hint', 'Zararlı tırtılları (🐛) topla. Uğur böceklerine ve kelebeklere dokunma!'));
    const info = el('div', 'mg-info', 'Kalan tırtıl: 6');
    const area = el('div', 'mg-garden');
    host.append(info, area);
    let left = 6, locked = false;
    const critters = [];
    for (const kind of shuffle(['bad', 'bad', 'bad', 'bad', 'bad', 'bad', 'lady', 'lady', 'lady', 'fly'])) {
      const c = el('div', 'mg-bug', kind === 'bad' ? '🐛' : kind === 'lady' ? '🐞' : '🦋');
      const st = { c, x: rint(5, 88), y: rint(8, 85), dx: (Math.random() - 0.5) * 0.6, dy: (Math.random() - 0.5) * 0.6 };
      critters.push(st);
      c.onclick = () => {
        if (locked || c.classList.contains('gone')) return;
        if (kind !== 'bad') {
          sfx.fail(); shake(area); locked = true;
          info.textContent = 'O faydalı bir böcek! Dikkat et.';
          setTimeout(() => { locked = false; info.textContent = `Kalan tırtıl: ${left}`; }, 1000);
          return;
        }
        c.classList.add('gone');
        sfx.pop();
        info.textContent = `Kalan tırtıl: ${--left}`;
        if (left === 0) done();
      };
      area.append(c);
    }
    const iv = setInterval(() => {
      for (const s of critters) {
        s.x += s.dx; s.y += s.dy;
        if (s.x < 2 || s.x > 92) s.dx *= -1;
        if (s.y < 4 || s.y > 88) s.dy *= -1;
        if (Math.random() < 0.03) { s.dx = (Math.random() - 0.5) * 0.7; s.dy = (Math.random() - 0.5) * 0.7; }
        s.c.style.left = `${s.x}%`; s.c.style.top = `${s.y}%`;
      }
    }, 50);
    return () => clearInterval(iv);
  },

  pipes(host, { done, sfx }) {
    host.append(el('p', 'mg-hint', 'Borulara tıklayarak döndür; sudan (sol) hedefe (sağ) kesintisiz yol oluştur.'));
    const W = 5, H = 4;
    const N = 1, E = 2, S = 4, Wd = 8;
    const rot = (m, n) => { for (let i = 0; i < n; i++) m = ((m << 1) | (m >> 3)) & 15; return m; };
    // carve a random left-to-right path
    let r = rint(0, H - 1);
    const rs = r;
    const cells = [{ c: 0, r }];
    const seen = new Set([`0,${r}`]);
    let c = 0;
    while (c < W - 1) {
      const opts = [];
      if (r > 0 && !seen.has(`${c},${r - 1}`)) opts.push([0, -1]);
      if (r < H - 1 && !seen.has(`${c},${r + 1}`)) opts.push([0, 1]);
      const mv = Math.random() < 0.35 && opts.length ? opts[rint(0, opts.length - 1)] : [1, 0];
      c += mv[0]; r += mv[1];
      seen.add(`${c},${r}`);
      cells.push({ c, r });
    }
    const rt = r;
    const base = Array.from({ length: H }, () => Array(W).fill(0));
    const dirBit = (a, b) => (b.c > a.c ? E : b.c < a.c ? Wd : b.r > a.r ? S : N);
    cells.forEach((cell, i) => {
      let m = 0;
      m |= i === 0 ? Wd : dirBit(cell, cells[i - 1]);
      m |= i === cells.length - 1 ? E : dirBit(cell, cells[i + 1]);
      base[cell.r][cell.c] = m;
    });
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (!base[y][x]) base[y][x] = Math.random() < 0.5 ? (N | S) : (N | E);
    const turns = base.map(row => row.map(() => rint(0, 3)));
    // make sure the puzzle doesn't start solved
    turns[rs][0] = (turns[rs][0] + 1) % 4 || 1;
    const grid = el('div', 'mg-pipes');
    grid.style.gridTemplateColumns = `40px repeat(${W}, 64px) 40px`;
    const tiles = [];
    let finished = false;
    const mask = (x, y) => rot(base[y][x], turns[y][x]);
    const solved = () => {
      const flow = new Set();
      const q = [[0, rs]];
      if (!(mask(0, rs) & Wd)) return { ok: false, flow };
      flow.add(`0,${rs}`);
      while (q.length) {
        const [x, y] = q.shift();
        const m = mask(x, y);
        for (const [bit, dx, dy, opp] of [[N, 0, -1, S], [E, 1, 0, Wd], [S, 0, 1, N], [Wd, -1, 0, E]]) {
          if (!(m & bit)) continue;
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H || flow.has(`${nx},${ny}`)) continue;
          if (!(mask(nx, ny) & opp)) continue;
          flow.add(`${nx},${ny}`);
          q.push([nx, ny]);
        }
      }
      return { ok: flow.has(`${W - 1},${rt}`) && !!(mask(W - 1, rt) & E), flow };
    };
    const draw = () => {
      const { ok, flow } = solved();
      tiles.forEach(t => {
        const m = mask(t.x, t.y);
        t.node.classList.toggle('wet', flow.has(`${t.x},${t.y}`));
        for (const [bit, cls] of [[N, 'n'], [E, 'e'], [S, 's'], [Wd, 'w']]) t.arms[cls].style.display = m & bit ? 'block' : 'none';
      });
      if (ok && !finished) { finished = true; sfx.splash(); setTimeout(done, 500); }
    };
    for (let y = 0; y < H; y++) {
      grid.append(el('div', `mg-pipe-end ${y === rs ? 'src' : ''}`, y === rs ? '💧' : ''));
      for (let x = 0; x < W; x++) {
        const node = el('div', 'mg-pipe');
        const arms = {};
        node.append(el('div', 'arm c'));
        for (const k of ['n', 'e', 's', 'w']) { arms[k] = el('div', `arm ${k}`); node.append(arms[k]); }
        node.onclick = () => { if (finished) return; turns[y][x] = (turns[y][x] + 1) % 4; sfx.click(); draw(); };
        tiles.push({ x, y, node, arms });
        grid.append(node);
      }
      grid.append(el('div', `mg-pipe-end ${y === rt ? 'dst' : ''}`, y === rt ? '🎯' : ''));
    }
    host.append(grid);
    draw();
  },

  tank(host, { done, sfx }) {
    host.append(el('p', 'mg-hint', 'Butonu basılı tut, su yeşil çizgiler arasına gelince bırak. Taşırma!'));
    const lo = rint(50, 70), hi = lo + 12;
    const tank = el('div', 'mg-tank');
    const water = el('div', 'mg-water');
    const band = el('div', 'mg-tank-band');
    band.style.bottom = `${lo}%`;
    band.style.height = `${hi - lo}%`;
    tank.append(water, band);
    const info = el('div', 'mg-info', 'Seviye: %0');
    const btn = el('button', 'mg-btn primary big', '🚰 Vanayı aç (basılı tut)');
    host.append(info, tank, btn);
    let level = 0, filling = false, finished = false;
    const release = () => {
      if (!filling || finished) return;
      filling = false;
      if (level > hi) {
        sfx.splash(); shake(tank);
        info.textContent = 'Taştı! Depo boşaltıldı, tekrar dene.';
        level = 0;
      } else if (level >= lo) {
        finished = true; sfx.success();
        setTimeout(done, 400);
      }
    };
    btn.addEventListener('pointerdown', e => { if (!finished) { filling = true; btn.setPointerCapture(e.pointerId); } });
    btn.addEventListener('pointerup', release);
    btn.addEventListener('pointercancel', release);
    const iv = setInterval(() => {
      if (filling) { level = Math.min(100, level + 1.6); if (Math.random() < 0.3) sfx.step(); }
      water.style.height = `${level}%`;
      if (filling || level) info.textContent = `Seviye: %${Math.round(level)}  (hedef %${lo}–${hi})`;
      if (filling && level >= 100) release();
    }, 50);
    return () => clearInterval(iv);
  },

  herd(host, { done, sfx }) {
    host.append(el('p', 'mg-hint', 'Fareyi yavruların arkasına götürerek onları sağdaki ağıla kovala.'));
    const info = el('div', 'mg-info', 'Ağıldaki yavrular: 0 / 5');
    const cv = el('canvas', 'mg-canvas');
    cv.width = 440; cv.height = 260;
    host.append(info, cv);
    const g = cv.getContext('2d');
    const pen = { x: 340, y: 60, w: 90, h: 140 };
    const chicks = Array.from({ length: 5 }, () => ({ x: rint(30, 260), y: rint(30, 230), vx: 0, vy: 0, in: false }));
    let mx = -100, my = -100, finished = false;
    cv.addEventListener('pointermove', e => {
      const r = cv.getBoundingClientRect();
      mx = (e.clientX - r.left) * (440 / r.width); my = (e.clientY - r.top) * (260 / r.height);
    });
    cv.addEventListener('pointerleave', () => { mx = my = -100; });
    const iv = setInterval(() => {
      for (const c of chicks) {
        c.vx += (Math.random() - 0.5) * 0.6; c.vy += (Math.random() - 0.5) * 0.6;
        const dx = c.x - mx, dy = c.y - my, d = Math.hypot(dx, dy);
        if (d < 80 && !c.in) { c.vx += (dx / d) * 2.2; c.vy += (dy / d) * 2.2; }
        c.vx *= 0.82; c.vy *= 0.82;
        c.x += c.vx; c.y += c.vy;
        if (c.in) {
          c.x = Math.max(pen.x + 10, Math.min(pen.x + pen.w - 10, c.x));
          c.y = Math.max(pen.y + 10, Math.min(pen.y + pen.h - 10, c.y));
        } else {
          c.x = Math.max(10, Math.min(430, c.x)); c.y = Math.max(10, Math.min(250, c.y));
          // pen walls except its open left side
          if (c.x > pen.x - 6 && (c.y < pen.y || c.y > pen.y + pen.h)) c.x = pen.x - 6;
          if (c.x > pen.x + 12 && c.y > pen.y && c.y < pen.y + pen.h) { c.in = true; sfx.peep(); }
        }
      }
      const n = chicks.filter(c => c.in).length;
      info.textContent = `Ağıldaki yavrular: ${n} / 5`;
      g.fillStyle = '#8fd16a'; g.fillRect(0, 0, 440, 260);
      g.fillStyle = '#d9b98a'; g.fillRect(pen.x, pen.y, pen.w, pen.h);
      g.strokeStyle = '#7b4a24'; g.lineWidth = 6;
      g.beginPath(); g.moveTo(pen.x, pen.y); g.lineTo(pen.x + pen.w, pen.y); g.lineTo(pen.x + pen.w, pen.y + pen.h); g.lineTo(pen.x, pen.y + pen.h); g.stroke();
      for (const c of chicks) {
        g.fillStyle = '#ffd23f'; g.beginPath(); g.arc(c.x, c.y, 10, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#222'; g.beginPath(); g.arc(c.x + 3, c.y - 3, 2, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#ff9f1c'; g.beginPath(); g.moveTo(c.x + 9, c.y - 1); g.lineTo(c.x + 15, c.y + 1); g.lineTo(c.x + 9, c.y + 3); g.fill();
      }
      if (mx > 0) { g.font = '26px "Segoe UI Emoji"'; g.fillText('🖐️', mx - 13, my + 9); }
      if (n === 5 && !finished) { finished = true; sfx.success(); done(); }
    }, 33);
    return () => clearInterval(iv);
  },

  lights(host, { done, sfx }) {
    host.append(el('p', 'mg-hint', 'Bütün şalterleri yukarı (AÇIK) konuma getir.'));
    const bulbs = el('div', 'mg-row');
    const row = el('div', 'mg-row');
    const states = Array.from({ length: 5 }, () => Math.random() < 0.4);
    if (states.every(Boolean)) states[rint(0, 4)] = false;
    let finished = false;
    const sw = states.map((on, i) => {
      const b = el('div', 'mg-bulb', '💡');
      bulbs.append(b);
      const s = el('button', 'mg-switch');
      s.onclick = () => {
        if (finished) return;
        states[i] = !states[i]; sfx.click(); upd();
        if (states.every(Boolean)) { finished = true; sfx.success(); setTimeout(done, 400); }
      };
      row.append(s);
      return { b, s };
    });
    const upd = () => sw.forEach((o, i) => { o.b.classList.toggle('on', states[i]); o.s.classList.toggle('on', states[i]); o.s.textContent = states[i] ? 'AÇIK' : 'KAPALI'; });
    upd();
    host.append(bulbs, row);
  },

  doorlock(host, { done, sfx }) {
    host.append(el('p', 'mg-hint', 'Sıkışan kilidi açmak için hızlıca tıkla!'));
    const lock = el('button', 'mg-lock', '🔒');
    const bar = el('div', 'mg-bar'), fill = el('div', 'mg-bar-fill');
    bar.append(fill);
    host.append(lock, bar);
    let p = 0, finished = false;
    lock.onclick = () => {
      if (finished) return;
      p += 14; sfx.click(); shake(lock);
      if (p >= 100) { finished = true; lock.textContent = '🔓'; sfx.door(); setTimeout(done, 400); }
    };
    const iv = setInterval(() => { if (!finished) p = Math.max(0, p - 2); fill.style.width = `${Math.min(100, p)}%`; }, 100);
    return () => clearInterval(iv);
  },
};

export const MINIGAME_TITLES = {
  lights: 'Elektrik panosu', doorlock: 'Kapı kilidi',
};

export function openMinigame(type, host, opts) {
  host.innerHTML = '';
  const fn = GAMES[type];
  if (!fn) { host.textContent = 'Bilinmeyen görev'; return () => {}; }
  return fn(host, opts) || (() => {});
}
