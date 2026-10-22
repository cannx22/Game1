// Çiftlik haritası: binalar, çitler, engeller, görev istasyonları ve çarpışma yardımcıları.
// Koordinatlar: x doğu (+), z güney (+). Ekranda kuzey yukarıdadır.

export const WALL_T = 0.5;
export const WALL_H = 2.4;
export const FENCE_H = 0.9;
export const BOUNDS = { x1: -40, x2: 40, z1: -31, z2: 31 };

// s: side (n/s/e/w), at: door center along that side, w: door width
export const BUILDINGS = [
  { id: 'kumes', name: 'Büyük Kümes', x1: -9, z1: -29, x2: 9, z2: -17, lock: true, wall: '#e0a458', floor: '#d9b77e',
    doors: [{ s: 's', at: 0, w: 3.2 }, { s: 'e', at: -23, w: 2.6 }] },
  { id: 'paket', name: 'Yumurta Paketleme', x1: 15, z1: -29, x2: 29, z2: -17, lock: false, wall: '#7fa6c9', floor: '#cfd8dc',
    doors: [{ s: 'w', at: -23, w: 2.6 }, { s: 's', at: 22, w: 5 }] },
  { id: 'depo', name: 'Yem Deposu', x1: -38, z1: -9, x2: -25, z2: 3, lock: true, wall: '#c47a3a', floor: '#b39b84',
    doors: [{ s: 'e', at: -3, w: 3 }, { s: 'n', at: -31.5, w: 2.6 }] },
  { id: 'ahir', name: 'Ahır', x1: -38, z1: 13, x2: -22, z2: 29, lock: true, wall: '#c0392b', floor: '#c8a165',
    doors: [{ s: 'n', at: -30, w: 3.2 }, { s: 'e', at: 24, w: 3 }] },
  { id: 'garaj', name: 'Traktör Garajı', x1: -12, z1: 19, x2: 4, z2: 29, lock: true, wall: '#8d99ae', floor: '#a7a7a7',
    doors: [{ s: 'n', at: -4, w: 4 }, { s: 'w', at: 24, w: 3 }] },
];

export const FENCES = [
  { id: 'bahce', name: 'Sebze Bahçesi', x1: 20, z1: -9, x2: 38, z2: 9, floor: '#8b5e3c',
    doors: [{ s: 'w', at: 0, w: 3.4 }, { s: 's', at: 29, w: 3.4 }, { s: 'n', at: 29, w: 3 }] },
  { id: 'agil', name: 'Ağıl', x1: -37, z1: -22, x2: -33, z2: -17, floor: '#a98b5b',
    doors: [{ s: 'e', at: -19.5, w: 2 }] },
];

// Decorative/physical props. box = collider [x1, z1, x2, z2] or null.
export const PROPS = [
  { type: 'bell', x: 0, z: -4, box: [-0.5, -4.5, 0.5, -3.5] },
  { type: 'well', x: 6, z: 4, box: [5, 3, 7, 5] },
  { type: 'hay', x: -6, z: 4, box: [-7, 3.4, -5, 4.6] },
  { type: 'hay', x: -5, z: 6, box: [-5.6, 5.5, -4.4, 6.5], small: true },
  { type: 'sign', x: 3.5, z: -6.5, box: null },
  { type: 'nests', x: -4.5, z: -28.2, box: [-8, -28.75, -1, -27.7] },
  { type: 'dirt', x: 3, z: -25, box: null },
  { type: 'incubator', x: 8.1, z: -21, box: [7.5, -22, 8.75, -20] },
  { type: 'trough', x: -8.2, z: -23.5, box: [-8.75, -25, -7.7, -22] },
  { type: 'sorttable', x: 18, z: -28.2, box: [16, -28.75, 20, -27.7] },
  { type: 'conveyor', x: 25.5, z: -27, box: [23, -27.6, 28, -26.4] },
  { type: 'crates', x: 27.8, z: -19, box: [27, -20, 28.75, -18] },
  { type: 'mixer', x: -36.8, z: -6.2, box: [-37.75, -7.2, -35.9, -5.2] },
  { type: 'sacks', x: -36.7, z: 0.5, box: [-37.75, -1, -35.6, 2] },
  { type: 'bales', x: -36.4, z: 15.4, box: [-37.75, 13.25, -35, 17.5] },
  { type: 'toolrack', x: -37.4, z: 26, box: [-37.75, 24, -37, 28] },
  { type: 'haypile', x: -24.8, z: 27.3, box: [-26.5, 26, -23, 28.75] },
  { type: 'tractor', x: -1.5, z: 25, box: [-3.4, 23.2, 0.4, 26.8] },
  { type: 'panel', x: -11.55, z: 21, box: [-11.75, 20.3, -11.3, 21.7] },
  { type: 'tires', x: 2.5, z: 20.5, box: [1.5, 19.5, 3.5, 21.5] },
  { type: 'fuel', x: -10.8, z: 27.8, box: [-11.75, 27, -10, 28.75] },
  { type: 'valves', x: 21, z: -5, box: [20.4, -6, 21.6, -4] },
  { type: 'scarecrow', x: 29, z: 0, box: [28.6, -0.4, 29.4, 0.4] },
  { type: 'crops', x: 0, z: 0, box: null },
  { type: 'tower', x: 30, z: 22, box: [28, 20, 32, 24] },
  { type: 'haystack', x: -20, z: -26, box: [-21.2, -27.2, -18.8, -24.8] },
  { type: 'haystack', x: -17, z: -26, box: [-18.2, -27.2, -15.8, -24.8] },
  { type: 'brokenfence', x: -28, z: -29.4, box: null },
];

export const STATIONS = {
  bell: { x: 0, z: -4, name: 'Acil toplantı zili', zone: 'avlu' },
  nests: { x: -4.5, z: -26.8, name: 'Yumurta yuvaları', zone: 'kumes' },
  coopclean: { x: 3, z: -24.5, name: 'Kirli zemin', zone: 'kumes' },
  incubator: { x: 6.6, z: -21, name: 'Kuluçka makinesi', zone: 'kumes' },
  trough: { x: -6.6, z: -23.5, name: 'Yemlik', zone: 'kumes' },
  sorttable: { x: 18, z: -26.6, name: 'Sınıflandırma masası', zone: 'paket' },
  conveyor: { x: 25.5, z: -25.2, name: 'Paketleme konveyörü', zone: 'paket' },
  mixer: { x: -34.6, z: -6.2, name: 'Yem karıştırıcı', zone: 'depo' },
  sackpick: { x: -34.3, z: 0.5, name: 'Yem çuvalları', zone: 'depo' },
  haypick: { x: -33.8, z: 15.4, name: 'Saman balyaları', zone: 'ahir' },
  toolrack: { x: -35.6, z: 26, name: 'Alet duvarı', zone: 'ahir' },
  tractor: { x: -5, z: 25, name: 'Traktör', zone: 'garaj' },
  elec: { x: -10.3, z: 21, name: 'Elektrik panosu', zone: 'garaj' },
  valves: { x: 22.8, z: -5, name: 'Sulama vanaları', zone: 'bahce' },
  bugs: { x: 32, z: 5, name: 'Marul tarhı', zone: 'bahce' },
  pipes: { x: 26.2, z: 22, name: 'Su boruları', zone: 'kule' },
  tank: { x: 33.8, z: 22, name: 'Depo vanası', zone: 'kule' },
  sabpipe: { x: 30, z: 18.4, name: 'Ana boru', zone: 'kule' },
  fence: { x: -28, z: -27.6, name: 'Kırık çit', zone: 'saman' },
  pen: { x: -31.4, z: -19.5, name: 'Ağıl', zone: 'saman' },
  haydrop: { x: -18.5, z: -23.2, name: 'Samanlık', zone: 'saman' },
};

// Impostor-only hidden passages, used in ring order.
export const TUNNELS = [
  { id: 't_kumes', x: -6.5, z: -19 },
  { id: 't_bahce', x: 23, z: 6.5 },
  { id: 't_kule', x: 36.5, z: 28 },
  { id: 't_garaj', x: 2, z: 27.5 },
  { id: 't_ahir', x: -24.5, z: 15.5 },
  { id: 't_depo', x: -27, z: 1 },
  { id: 't_saman', x: -15, z: -15 },
];

export const SPAWN = Array.from({ length: 12 }, (_, i) => {
  const a = (i / 12) * Math.PI * 2;
  return { x: Math.round(Math.cos(a) * 3 * 100) / 100, z: Math.round((1.5 + Math.sin(a) * 3) * 100) / 100 };
});

export const FEED_SPOTS = [
  { x: -22, z: -3 }, { x: -15, z: -2 }, { x: -10, z: 2 }, { x: -32, z: -3 },
  { x: -29, z: -6 }, { x: -20, z: 6 }, { x: -12, z: -7 }, { x: -30, z: -12 },
];
export const CHICK_SPOTS = [
  { x: -3, z: -12 }, { x: 12, z: -10 }, { x: 24, z: -14 }, { x: 33, z: -2 },
  { x: 14, z: 10 }, { x: 25, z: 14 }, { x: -8, z: 14 }, { x: -18, z: 4 },
  { x: -26, z: -14 }, { x: -12, z: -24 }, { x: 11, z: -23 }, { x: -34, z: 8 },
];
export const PUDDLES = [
  { x: 0, z: -10 }, { x: -3, z: 6 }, { x: 10, z: 0 }, { x: 15, z: -1 },
  { x: -16, z: -3 }, { x: -4, z: 13 }, { x: 24, z: 15 }, { x: 18, z: 10 },
];
export const PUDDLE_R = 1.5;

export const ZONES = [
  { id: 'kumes', name: 'Büyük Kümes', x1: -9, z1: -29, x2: 9, z2: -17, color: '#e0a458' },
  { id: 'paket', name: 'Paketleme', x1: 15, z1: -29, x2: 29, z2: -17, color: '#7fa6c9' },
  { id: 'depo', name: 'Yem Deposu', x1: -38, z1: -9, x2: -25, z2: 3, color: '#c47a3a' },
  { id: 'ahir', name: 'Ahır', x1: -38, z1: 13, x2: -22, z2: 29, color: '#c0392b' },
  { id: 'garaj', name: 'Garaj', x1: -12, z1: 19, x2: 4, z2: 29, color: '#8d99ae' },
  { id: 'bahce', name: 'Sebze Bahçesi', x1: 20, z1: -9, x2: 38, z2: 9, color: '#6a994e' },
  { id: 'kule', name: 'Su Kulesi', x1: 20, z1: 12, x2: 40, z2: 31, color: '#4ea8de' },
  { id: 'saman', name: 'Çit ve Samanlık', x1: -40, z1: -31, x2: -12, z2: -12, color: '#e9c46a' },
  { id: 'avlu', name: 'Merkez Avlu', x1: -12, z1: -13, x2: 14, z2: 14, color: '#d4a373' },
];
export const zoneAt = (x, z) => ZONES.find(o => x >= o.x1 && x <= o.x2 && z >= o.z1 && z <= o.z2) || { id: 'yol', name: 'Çiftlik yolu' };
export const zoneById = id => ZONES.find(o => o.id === id);

// ---- wall generation ----
function sideBoxes(b, side, kind) {
  const horiz = side === 'n' || side === 's';
  // horizontal sides overhang by half the thickness so corners close
  const start = horiz ? b.x1 - WALL_T / 2 : b.z1;
  const end = horiz ? b.x2 + WALL_T / 2 : b.z2;
  const gaps = b.doors.filter(d => d.s === side).map(d => [d.at - d.w / 2, d.at + d.w / 2]).sort((p, q) => p[0] - q[0]);
  const make = (a0, a1) => {
    if (side === 'n') return { x1: a0, x2: a1, z1: b.z1 - WALL_T / 2, z2: b.z1 + WALL_T / 2 };
    if (side === 's') return { x1: a0, x2: a1, z1: b.z2 - WALL_T / 2, z2: b.z2 + WALL_T / 2 };
    if (side === 'w') return { x1: b.x1 - WALL_T / 2, x2: b.x1 + WALL_T / 2, z1: a0, z2: a1 };
    return { x1: b.x2 - WALL_T / 2, x2: b.x2 + WALL_T / 2, z1: a0, z2: a1 };
  };
  const walls = [];
  const doors = [];
  let cur = start;
  for (const g of gaps) {
    if (g[0] > cur) walls.push({ ...make(cur, g[0]), kind, b: b.id });
    doors.push({ ...make(g[0], g[1]), b: b.id, side });
    cur = g[1];
  }
  if (cur < end) walls.push({ ...make(cur, end), kind, b: b.id });
  return { walls, doors };
}

export const COLLIDERS = [];
export const DOORS = [];
for (const [list, kind] of [[BUILDINGS, 'wall'], [FENCES, 'fence']]) {
  for (const b of list) {
    for (const side of ['n', 's', 'e', 'w']) {
      const { walls, doors } = sideBoxes(b, side, kind);
      COLLIDERS.push(...walls);
      if (kind === 'wall' && b.lock) {
        for (const d of doors) DOORS.push({ ...d, id: `${b.id}_${DOORS.length}`, kind: 'door', cx: (d.x1 + d.x2) / 2, cz: (d.z1 + d.z2) / 2 });
      }
    }
  }
}
for (const p of PROPS) {
  if (p.box) COLLIDERS.push({ x1: p.box[0], z1: p.box[1], x2: p.box[2], z2: p.box[3], kind: 'prop' });
}

// ---- collision helpers (shared so client prediction matches server validation) ----
export function circleHitsBox(x, z, r, b) {
  const cx = Math.max(b.x1, Math.min(x, b.x2));
  const cz = Math.max(b.z1, Math.min(z, b.z2));
  const dx = x - cx, dz = z - cz;
  return dx * dx + dz * dz < r * r;
}

export function inBounds(x, z, r = 0) {
  return x >= BOUNDS.x1 + r && x <= BOUNDS.x2 - r && z >= BOUNDS.z1 + r && z <= BOUNDS.z2 - r;
}

// lockedBuildings: iterable of building ids whose doors are shut
export function activeColliders(lockedBuildings) {
  const locked = lockedBuildings ? [...lockedBuildings] : [];
  if (!locked.length) return COLLIDERS;
  return COLLIDERS.concat(DOORS.filter(d => locked.includes(d.b)));
}

export function blockedAt(x, z, r, cols) {
  if (!inBounds(x, z, r)) return true;
  for (const c of cols) if (circleHitsBox(x, z, r, c)) return true;
  return false;
}

// Colliders the circle already overlaps are ignored, so a door closing on someone never traps them.
export function slideMove(x, z, dx, dz, r, cols) {
  const inside = cols.filter(c => circleHitsBox(x, z, r, c));
  const cs = inside.length ? cols.filter(c => !inside.includes(c)) : cols;
  let nx = x + dx, nz = z;
  if (blockedAt(nx, nz, r, cs)) nx = x;
  nz = z + dz;
  if (blockedAt(nx, nz, r, cs)) nz = z;
  return [nx, nz];
}

export function pathClear(x0, z0, x1, z1, r, cols) {
  const inside = cols.filter(c => circleHitsBox(x0, z0, r, c));
  const cs = inside.length ? cols.filter(c => !inside.includes(c)) : cols;
  const d = Math.hypot(x1 - x0, z1 - z0);
  const steps = Math.max(1, Math.ceil(d / 0.2));
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    if (blockedAt(x0 + (x1 - x0) * t, z0 + (z1 - z0) * t, r, cs)) return false;
  }
  return true;
}
