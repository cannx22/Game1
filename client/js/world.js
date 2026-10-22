// Three.js sahnesi: stilize çiftlik haritası, civciv modelleri, animasyonlar ve görsel efektler.
import * as THREE from 'three';
import {
  BUILDINGS, FENCES, COLLIDERS, DOORS, PROPS, TUNNELS, BOUNDS, ZONES, PUDDLES, PUDDLE_R,
  WALL_H, FENCE_H, zoneById,
} from '/shared/map.js';
import { colorById } from '/shared/constants.js';

// ---------- materials ----------
const gradientMap = (() => {
  const t = new THREE.DataTexture(new Uint8Array([90, 170, 255]), 3, 1, THREE.RedFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
})();
const matCache = new Map();
export function toon(color, extra = {}) {
  const key = color + JSON.stringify(extra);
  if (!matCache.has(key)) matCache.set(key, new THREE.MeshToonMaterial({ color, gradientMap, ...extra }));
  return matCache.get(key);
}
const geoCache = new Map();
function geo(key, make) {
  if (!geoCache.has(key)) geoCache.set(key, make());
  return geoCache.get(key);
}
const sphere = (r, w = 18, h = 14) => geo(`s${r}_${w}`, () => new THREE.SphereGeometry(r, w, h));
const boxG = (x, y, z) => geo(`b${x}_${y}_${z}`, () => new THREE.BoxGeometry(x, y, z));
const cyl = (rt, rb, h, s = 16) => geo(`c${rt}_${rb}_${h}_${s}`, () => new THREE.CylinderGeometry(rt, rb, h, s));
const cone = (r, h, s = 12) => geo(`k${r}_${h}_${s}`, () => new THREE.ConeGeometry(r, h, s));

function mesh(g, m, x = 0, y = 0, z = 0, shadow = true) {
  const o = new THREE.Mesh(g, m);
  o.position.set(x, y, z);
  o.castShadow = shadow;
  o.receiveShadow = true;
  return o;
}

export function makeLabel(text, color = '#ffffff', size = 1) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 128;
  const g = c.getContext('2d');
  g.font = 'bold 64px "Baloo 2", "Segoe UI", sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineWidth = 12;
  g.strokeStyle = 'rgba(30,20,10,0.85)';
  g.strokeText(text, 256, 64);
  g.fillStyle = color;
  g.fillText(text, 256, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  s.scale.set(2.6 * size, 0.65 * size, 1);
  s.renderOrder = 10;
  return s;
}

function emojiSprite(emoji, scale = 1) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(255,255,255,0.92)';
  g.beginPath(); g.arc(64, 60, 54, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.moveTo(50, 108); g.lineTo(64, 126); g.lineTo(78, 108); g.fill();
  g.font = '72px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(emoji, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  s.scale.set(scale, scale, 1);
  s.renderOrder = 11;
  return s;
}

// ---------- chick model ----------
function addHat(hatGroup, root, body, id) {
  const brown = toon('#7b4a24'), gold = toon('#ffc300'), white = toon('#ffffff'), straw = toon('#e9c46a'), red = toon('#d62828'), black = toon('#222222');
  switch (id) {
    case 'cowboy':
      hatGroup.add(mesh(cyl(0.48, 0.48, 0.05), brown, 0, 0.02, 0));
      hatGroup.add(mesh(cyl(0.2, 0.25, 0.3), brown, 0, 0.18, 0));
      break;
    case 'crown': {
      hatGroup.add(mesh(cyl(0.22, 0.22, 0.14, 12), gold, 0, 0.07, 0));
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        hatGroup.add(mesh(cone(0.06, 0.16, 6), gold, Math.cos(a) * 0.19, 0.2, Math.sin(a) * 0.19));
      }
      break;
    }
    case 'chef':
      hatGroup.add(mesh(cyl(0.2, 0.2, 0.25), white, 0, 0.1, 0));
      hatGroup.add(mesh(sphere(0.27), white, 0, 0.32, 0));
      break;
    case 'straw':
      hatGroup.add(mesh(cyl(0.55, 0.55, 0.04), straw, 0, 0.02, 0));
      hatGroup.add(mesh(sphere(0.25), straw, 0, 0.06, 0));
      hatGroup.add(mesh(cyl(0.255, 0.255, 0.06), red, 0, 0.07, 0));
      break;
    case 'detective':
      hatGroup.add(mesh(sphere(0.3), toon('#8d6e4c'), 0, 0.02, 0));
      hatGroup.add(mesh(boxG(0.3, 0.04, 0.22), toon('#8d6e4c'), 0, -0.02, 0.32));
      hatGroup.add(mesh(boxG(0.3, 0.04, 0.22), toon('#8d6e4c'), 0, -0.02, -0.32));
      break;
    case 'pirate': {
      const cap = mesh(sphere(0.34), red, 0, -0.05, -0.02);
      cap.scale.set(1.08, 0.6, 1.08);
      hatGroup.add(cap);
      hatGroup.add(mesh(sphere(0.08), red, 0.1, -0.15, -0.38));
      hatGroup.add(mesh(boxG(0.06, 0.2, 0.06), red, 0.16, -0.25, -0.38));
      break;
    }
    case 'goggles': {
      const band = new THREE.Mesh(geo('gband', () => new THREE.TorusGeometry(0.36, 0.035, 8, 24)), brown);
      band.rotation.x = Math.PI / 2;
      band.position.y = -0.12;
      hatGroup.add(band);
      for (const s of [-1, 1]) {
        const lens = mesh(cyl(0.1, 0.1, 0.08), toon('#4cc9f0'), s * 0.13, -0.06, 0.33);
        lens.rotation.x = Math.PI / 2;
        hatGroup.add(lens);
      }
      break;
    }
    case 'bag': {
      const bag = mesh(boxG(0.45, 0.45, 0.25), toon('#2a9d8f'), 0, 0.62, -0.5);
      body.add(bag);
      body.add(mesh(boxG(0.3, 0.12, 0.08), toon('#264653'), 0, 0.5, -0.64));
      break;
    }
    case 'mustache': {
      for (const s of [-1, 1]) {
        const m = mesh(sphere(0.08), black, s * 0.09, -0.15, 0.4);
        m.scale.set(1.6, 0.6, 0.6);
        m.rotation.z = s * 0.3;
        root.userData.head.add(m);
      }
      break;
    }
    default:
  }
}

export function makeChick(hex, hat = 'none') {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const m = toon(hex);
  const torso = mesh(sphere(0.5, 22, 16), m, 0, 0.55, 0);
  torso.scale.set(1, 0.92, 1.05);
  body.add(torso);
  const head = new THREE.Group();
  head.position.set(0, 1.05, 0.06);
  body.add(head);
  root.userData.head = head;
  head.add(mesh(sphere(0.37, 22, 16), m));
  const eyeW = toon('#ffffff'), eyeB = toon('#1b1b1b');
  const pupils = [];
  for (const s of [-1, 1]) {
    head.add(mesh(sphere(0.11, 12, 10), eyeW, s * 0.15, 0.07, 0.29, false));
    const p = mesh(sphere(0.062, 10, 8), eyeB, s * 0.15, 0.08, 0.385, false);
    head.add(p);
    pupils.push(p);
    const ch = mesh(sphere(0.06, 8, 6), toon('#ff8fa3'), s * 0.25, -0.07, 0.26, false);
    ch.scale.z = 0.4;
    head.add(ch);
  }
  const beak = mesh(cone(0.09, 0.22, 8), toon('#ff9f1c'), 0, -0.04, 0.43, false);
  beak.rotation.x = Math.PI / 2;
  head.add(beak);
  for (let i = -1; i <= 1; i++) {
    const t = mesh(cone(0.05, 0.18, 6), m, i * 0.06, 0.4, -0.02, false);
    t.rotation.z = -i * 0.5;
    head.add(t);
  }
  const wings = [];
  for (const s of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(s * 0.46, 0.7, 0);
    const w = mesh(sphere(0.25, 12, 10), m, s * 0.04, -0.14, 0);
    w.scale.set(0.35, 0.85, 0.95);
    pivot.add(w);
    body.add(pivot);
    wings.push(pivot);
  }
  const feet = [];
  for (const s of [-1, 1]) {
    const f = mesh(boxG(0.16, 0.06, 0.26), toon('#ff9f1c'), s * 0.18, 0.03, 0.08);
    root.add(f);
    feet.push(f);
  }
  const hatGroup = new THREE.Group();
  hatGroup.position.set(0, 0.32, 0);
  head.add(hatGroup);
  addHat(hatGroup, root, body, hat);
  Object.assign(root.userData, { body, wings, feet, pupils, hatGroup, torso });
  return root;
}

function setGhostLook(model, on) {
  model.traverse(o => {
    if (!o.isMesh) return;
    if (on) {
      if (!o.userData.orig) o.userData.orig = o.material;
      o.material = o.userData.orig.clone();
      o.material.transparent = true;
      o.material.opacity = 0.42;
      o.material.depthWrite = false;
      o.castShadow = false;
    } else if (o.userData.orig) {
      o.material = o.userData.orig;
      o.castShadow = true;
    }
  });
  model.userData.feet.forEach(f => { f.visible = !on; });
}

function makeBody(hex) {
  const g = new THREE.Group();
  const chick = makeChick(hex, 'none');
  chick.rotation.z = Math.PI / 2;
  chick.position.y = 0.48;
  g.add(chick);
  const { pupils } = chick.userData;
  for (const p of pupils) {
    p.visible = false;
    for (const r of [-0.8, 0.8]) {
      const x = mesh(boxG(0.03, 0.17, 0.03), toon('#1b1b1b'), p.position.x, p.position.y, p.position.z, false);
      x.rotation.z = r;
      chick.userData.head.add(x);
    }
  }
  const stars = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const s = mesh(geo('star', () => new THREE.OctahedronGeometry(0.11)), toon('#ffd60a', { emissive: '#664400' }), Math.cos(i * 2.1) * 0.45, 0, Math.sin(i * 2.1) * 0.45, false);
    stars.add(s);
  }
  stars.position.set(-0.9, 1.0, 0);
  g.add(stars);
  const feathers = new THREE.Group();
  for (let i = 0; i < 6; i++) {
    const f = mesh(sphere(0.07, 6, 4), toon(hex), (Math.random() - 0.5) * 1.6, 0.04, (Math.random() - 0.5) * 1.6, false);
    f.scale.set(1.6, 0.3, 0.8);
    feathers.add(f);
  }
  g.add(feathers);
  g.userData.stars = stars;
  return g;
}

function makeHen(white = true) {
  const g = new THREE.Group();
  const m = toon(white ? '#fdfdf6' : '#b5651d');
  const b = mesh(sphere(0.42), m, 0, 0.5, 0);
  b.scale.set(0.85, 0.8, 1.15);
  g.add(b);
  g.add(mesh(sphere(0.22), m, 0, 0.9, 0.32));
  g.add(mesh(boxG(0.06, 0.16, 0.18), toon('#e63946'), 0, 1.12, 0.3));
  const bk = mesh(cone(0.06, 0.14, 6), toon('#ff9f1c'), 0, 0.88, 0.55);
  bk.rotation.x = Math.PI / 2;
  g.add(bk);
  g.add(mesh(sphere(0.04), toon('#111'), 0.1, 0.95, 0.47), mesh(sphere(0.04), toon('#111'), -0.1, 0.95, 0.47));
  const tail = mesh(cone(0.18, 0.35, 6), m, 0, 0.75, -0.45);
  tail.rotation.x = -0.8;
  g.add(tail);
  g.scale.setScalar(0.9);
  return g;
}

function makeDuck() {
  const g = new THREE.Group();
  const m = toon('#ffffff');
  const b = mesh(sphere(0.4), m, 0, 0.45, 0);
  b.scale.set(0.8, 0.7, 1.2);
  g.add(b);
  g.add(mesh(sphere(0.22), toon('#2d6a4f'), 0, 0.85, 0.35));
  const bk = mesh(boxG(0.2, 0.06, 0.22), toon('#ff9f1c'), 0, 0.8, 0.6);
  g.add(bk);
  return g;
}

// ---------- props ----------
function tree(x, z, s = 1) {
  const g = new THREE.Group();
  g.add(mesh(cyl(0.22 * s, 0.3 * s, 1.6 * s, 8), toon('#8b5a2b'), 0, 0.8 * s, 0));
  const leaf = toon(Math.random() > 0.5 ? '#3a7d44' : '#4f9d53');
  g.add(mesh(geo('ico1', () => new THREE.IcosahedronGeometry(1.3, 0)), leaf, 0, 2.2 * s, 0));
  const l2 = mesh(geo('ico2', () => new THREE.IcosahedronGeometry(0.95, 0)), leaf, 0.55, 2.9 * s, 0.2);
  g.add(l2);
  g.position.set(x, 0, z);
  g.scale.setScalar(s);
  g.rotation.y = Math.random() * 6;
  return g;
}

function hayBale(x, z, small = false) {
  const g = new THREE.Group();
  const s = small ? 0.6 : 1;
  const b = mesh(cyl(0.6 * s, 0.6 * s, 1.1 * s, 18), toon('#e9c46a'), 0, 0.6 * s, 0);
  b.rotation.z = Math.PI / 2;
  g.add(b);
  const band = mesh(cyl(0.62 * s, 0.62 * s, 0.08, 18), toon('#b08968'), 0, 0.6 * s, 0);
  band.rotation.z = Math.PI / 2;
  g.add(band);
  g.position.set(x, 0, z);
  return g;
}

function buildProp(p, scene) {
  const g = new THREE.Group();
  g.position.set(p.x, 0, p.z);
  const wood = toon('#9c6b3c'), dark = toon('#5c3d1e'), metal = toon('#8d99ae'), red = toon('#d62828');
  switch (p.type) {
    case 'bell': {
      g.add(mesh(cyl(0.08, 0.1, 2.6, 8), wood, -0.4, 1.3, 0), mesh(cyl(0.08, 0.1, 2.6, 8), wood, 0.4, 1.3, 0));
      g.add(mesh(boxG(1.2, 0.15, 0.2), wood, 0, 2.6, 0));
      g.add(mesh(cone(0.35, 0.45, 16), toon('#ffc300', { emissive: '#553300' }), 0, 2.25, 0));
      g.add(mesh(sphere(0.08), dark, 0, 1.98, 0));
      g.add(mesh(cyl(0.6, 0.7, 0.15, 16), toon('#bcb8b1'), 0, 0.07, 0));
      break;
    }
    case 'well': {
      g.add(mesh(cyl(1, 1, 0.9, 16), toon('#a8a29e'), 0, 0.45, 0));
      g.add(mesh(cyl(0.8, 0.8, 0.92, 16), toon('#3a86ff'), 0, 0.46, 0, false));
      g.add(mesh(boxG(0.12, 1.8, 0.12), wood, -0.8, 1.3, 0), mesh(boxG(0.12, 1.8, 0.12), wood, 0.8, 1.3, 0));
      const roof = mesh(cone(1.3, 0.8, 4), red, 0, 2.5, 0);
      roof.rotation.y = Math.PI / 4;
      g.add(roof);
      g.add(mesh(cyl(0.25, 0.2, 0.3, 10), wood, 0, 1.3, 0));
      break;
    }
    case 'hay': g.add(hayBale(0, 0, p.small)); break;
    case 'sign': {
      g.add(mesh(boxG(0.15, 1.6, 0.15), wood, 0, 0.8, 0));
      g.add(mesh(boxG(2.2, 0.8, 0.12), toon('#c08552'), 0, 1.6, 0));
      const l = makeLabel('CİVCİV ÇİFTLİĞİ', '#fff3c4', 0.75);
      l.position.set(0, 1.62, 0.2);
      g.add(l);
      break;
    }
    case 'nests': {
      for (let i = 0; i < 6; i++) {
        const nx = -3 + i * 1.2;
        const nest = mesh(cyl(0.45, 0.35, 0.3, 12), toon('#d4a373'), nx, 0.45, 0);
        g.add(mesh(boxG(1.1, 0.3, 0.9), wood, nx, 0.15, 0));
        g.add(nest);
        if (i % 2 === 0) {
          const egg = mesh(sphere(0.13, 10, 8), toon('#fff8e7'), nx, 0.66, 0.05);
          egg.scale.y = 1.3;
          g.add(egg);
        }
      }
      break;
    }
    case 'dirt': {
      for (let i = 0; i < 5; i++) {
        const d = mesh(geo('dirtc', () => new THREE.CircleGeometry(0.6, 12)), toon('#6f4e37'), (Math.random() - 0.5) * 3, 0.03, (Math.random() - 0.5) * 2, false);
        d.rotation.x = -Math.PI / 2;
        d.scale.setScalar(0.6 + Math.random() * 0.6);
        g.add(d);
      }
      break;
    }
    case 'incubator': {
      g.add(mesh(boxG(1.1, 1.3, 1.8), toon('#f1faee'), 0, 0.65, 0));
      const win = mesh(boxG(0.05, 0.5, 1.1), toon('#ffb703', { emissive: '#aa5500' }), -0.56, 0.85, 0);
      g.add(win);
      g.add(mesh(cyl(0.08, 0.08, 0.05, 10), red, -0.56, 0.35, 0.5));
      g.userData.powered = [win];
      break;
    }
    case 'trough': g.add(mesh(boxG(0.9, 0.5, 3), wood, 0, 0.25, 0), mesh(boxG(0.7, 0.1, 2.8), toon('#e9c46a'), 0, 0.5, 0, false)); break;
    case 'sorttable': {
      g.add(mesh(boxG(4, 0.9, 1), toon('#adb5bd'), 0, 0.45, 0));
      for (let i = 0; i < 3; i++) g.add(mesh(boxG(0.9, 0.3, 0.7), wood, -1.3 + i * 1.3, 1.05, 0));
      break;
    }
    case 'conveyor': {
      g.add(mesh(boxG(5, 0.7, 1.2), toon('#495057'), 0, 0.35, 0));
      g.add(mesh(boxG(5, 0.08, 1), toon('#212529'), 0, 0.74, 0));
      for (let i = 0; i < 6; i++) {
        const egg = mesh(sphere(0.13, 10, 8), toon(i % 2 ? '#fff8e7' : '#d4a373'), -2 + i * 0.8, 0.9, 0);
        egg.scale.y = 1.3;
        g.add(egg);
      }
      g.add(mesh(boxG(1, 1.6, 1.3), toon('#7fa6c9'), 2.7, 0.8, 0));
      break;
    }
    case 'crates': for (let i = 0; i < 3; i++) g.add(mesh(boxG(0.8, 0.6, 0.8), wood, (i % 2) * 0.5, 0.3 + Math.floor(i / 2) * 0.6, i * 0.5 - 0.5)); break;
    case 'mixer': {
      g.add(mesh(cyl(0.8, 0.9, 1.4, 16), metal, 0, 0.7, 0));
      g.add(mesh(cyl(0.85, 0.85, 0.1, 16), toon('#e9c46a'), 0, 1.42, 0, false));
      g.add(mesh(boxG(0.1, 1, 0.1), dark, 0.3, 1.7, 0));
      break;
    }
    case 'sacks': {
      for (let i = 0; i < 5; i++) {
        const s = mesh(sphere(0.45, 10, 8), toon('#e6ccb2'), (i % 2) * 0.6 - 0.3, 0.4 + Math.floor(i / 3) * 0.55, -0.9 + (i % 3) * 0.9);
        s.scale.set(1, 0.9, 0.7);
        g.add(s);
      }
      break;
    }
    case 'bales': g.add(hayBale(0, -1.2), hayBale(0, 0.4), hayBale(0, 2)); break;
    case 'toolrack': {
      g.add(mesh(boxG(0.2, 2, 4), wood, 0, 1.2, 0));
      g.add(mesh(boxG(0.1, 1.2, 0.08), dark, 0.2, 1.3, -1.2), mesh(boxG(0.1, 0.4, 0.5), metal, 0.2, 1.9, -1.2));
      g.add(mesh(boxG(0.1, 1.4, 0.08), dark, 0.2, 1.3, 0), mesh(cone(0.25, 0.4, 3), metal, 0.2, 0.6, 0));
      g.add(mesh(boxG(0.1, 1, 0.08), dark, 0.2, 1.4, 1.2));
      break;
    }
    case 'haypile': {
      const h = mesh(sphere(1.6, 12, 8), toon('#e9c46a'), 0, 0, 0);
      h.scale.set(1.1, 0.7, 0.8);
      g.add(h);
      break;
    }
    case 'tractor': {
      g.add(mesh(boxG(1.6, 1, 2.6), toon('#2a9d8f'), 0, 1, 0.2));
      g.add(mesh(boxG(1.4, 1.2, 1.2), toon('#e9f5f2'), 0, 2, -0.5));
      g.add(mesh(boxG(1.5, 0.08, 1.3), toon('#2a9d8f'), 0, 2.62, -0.5));
      for (const s of [-1, 1]) {
        const big = mesh(cyl(0.75, 0.75, 0.4, 16), toon('#222'), s * 1.0, 0.75, -0.6);
        big.rotation.z = Math.PI / 2;
        const small = mesh(cyl(0.45, 0.45, 0.3, 14), toon('#222'), s * 0.9, 0.45, 1.2);
        small.rotation.z = Math.PI / 2;
        g.add(big, small);
        const hub = mesh(cyl(0.3, 0.3, 0.42, 12), toon('#ffb703'), s * 1.0, 0.75, -0.6);
        hub.rotation.z = Math.PI / 2;
        g.add(hub);
      }
      g.add(mesh(cyl(0.08, 0.08, 0.8, 8), toon('#444'), 0.4, 1.8, 1.0));
      g.userData.tractor = true;
      break;
    }
    case 'panel': {
      g.add(mesh(boxG(0.3, 1.2, 1.1), toon('#adb5bd'), 0, 1.3, 0));
      g.add(mesh(boxG(0.32, 0.25, 0.25), toon('#ffd60a'), 0.02, 1.65, 0));
      break;
    }
    case 'tires': for (let i = 0; i < 3; i++) { const t = mesh(geo('tire', () => new THREE.TorusGeometry(0.45, 0.2, 8, 16)), toon('#222'), 0, 0.2 + i * 0.35, 0); t.rotation.x = Math.PI / 2; g.add(t); } break;
    case 'fuel': for (let i = 0; i < 3; i++) g.add(mesh(boxG(0.5, 0.7, 0.35), red, (i - 1) * 0.55, 0.35, 0)); break;
    case 'valves': {
      g.add(mesh(cyl(0.12, 0.12, 2, 8), toon('#6c757d'), 0, 0.5, 0));
      g.children[0].rotation.x = Math.PI / 2;
      for (let i = 0; i < 4; i++) {
        const v = mesh(geo('valve', () => new THREE.TorusGeometry(0.16, 0.04, 6, 12)), red, 0, 0.85, -0.75 + i * 0.5);
        v.rotation.y = Math.PI / 2;
        g.add(v, mesh(cyl(0.04, 0.04, 0.35, 6), toon('#6c757d'), 0, 0.68, -0.75 + i * 0.5));
      }
      break;
    }
    case 'scarecrow': {
      g.add(mesh(boxG(0.12, 2.4, 0.12), wood, 0, 1.2, 0), mesh(boxG(1.6, 0.1, 0.1), wood, 0, 1.8, 0));
      g.add(mesh(boxG(0.7, 0.8, 0.4), toon('#457b9d'), 0, 1.6, 0));
      g.add(mesh(sphere(0.3), toon('#e9c46a'), 0, 2.3, 0));
      g.add(mesh(cyl(0.5, 0.5, 0.05, 12), toon('#c9a227'), 0, 2.5, 0), mesh(cyl(0.2, 0.25, 0.3, 10), toon('#c9a227'), 0, 2.65, 0));
      break;
    }
    case 'crops': {
      g.position.set(0, 0, 0);
      for (let x = 23.5; x < 36.5; x += 1.3) {
        for (let z = -7; z <= -3.5; z += 1.1) {
          const c = mesh(cone(0.1, 0.35, 6), toon('#fb8500'), x, 0.1, z, false);
          c.rotation.x = Math.PI;
          g.add(c, mesh(cone(0.18, 0.4, 5), toon('#52b788'), x, 0.45, z, false));
        }
        for (let z = 2.5; z <= 7.5; z += 1.2) if (x > 25.5) g.add(mesh(sphere(0.32, 8, 6), toon('#95d5b2'), x, 0.22, z, false));
      }
      for (let x = 31.5; x < 37.5; x += 1) {
        for (let z = -1.8; z <= 1.8; z += 1.2) {
          g.add(mesh(cyl(0.06, 0.08, 1.8, 5), toon('#74c69d'), x, 0.9, z, false));
          g.add(mesh(cyl(0.12, 0.1, 0.45, 6), toon('#ffd60a'), x + 0.08, 1.2, z, false));
        }
      }
      break;
    }
    case 'tower': {
      for (const [sx, sz] of [[-1.4, -1.4], [1.4, -1.4], [-1.4, 1.4], [1.4, 1.4]]) g.add(mesh(cyl(0.15, 0.2, 5, 8), wood, sx, 2.5, sz));
      g.add(mesh(boxG(3.2, 0.15, 0.15), wood, 0, 2.5, -1.4), mesh(boxG(3.2, 0.15, 0.15), wood, 0, 2.5, 1.4));
      g.add(mesh(cyl(2.1, 2.1, 2.6, 20), toon('#4ea8de'), 0, 6.2, 0));
      g.add(mesh(cone(2.4, 1.3, 20), toon('#c0392b'), 0, 8.15, 0));
      g.add(mesh(cyl(0.18, 0.18, 4.8, 8), toon('#6c757d'), -1.9, 2.4, 0));
      const lbl = makeLabel('SU', '#ffffff', 1.2);
      lbl.position.set(0, 6.2, 2.2);
      g.add(lbl);
      break;
    }
    case 'haystack': {
      g.add(mesh(cyl(1.15, 1.25, 1.6, 14), toon('#e9c46a'), 0, 0.8, 0));
      g.add(mesh(cone(1.25, 1.4, 14), toon('#ddb24c'), 0, 2.3, 0));
      break;
    }
    case 'brokenfence': {
      for (let i = 0; i < 7; i++) {
        g.add(mesh(boxG(0.15, 1, 0.15), wood, -3 + i, 0.5, 0));
        if (i !== 3 && i !== 4) g.add(mesh(boxG(1, 0.12, 0.08), wood, -2.5 + i, 0.7, 0));
      }
      const fallen = mesh(boxG(1, 0.12, 0.08), wood, 0.6, 0.06, 0.8);
      fallen.rotation.y = 0.6;
      g.add(fallen);
      break;
    }
    default:
  }
  scene.add(g);
  return g;
}

// ---------- world ----------
const lerpAngle = (a, b, t) => {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
};

export class World {
  constructor(canvas, { shadows = true } = {}) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = shadows;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#9ad7ff');
    this.scene.fog = new THREE.Fog('#9ad7ff', 60, 120);
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.5, 300);
    this.camera.position.set(0, 30, 30);
    this.camTarget = new THREE.Vector3();
    this.entities = new Map();
    this.bodies = new Map();
    this.temps = [];
    this.selfId = null;
    this.time = 0;
    this.demo = true;
    this.buildLights();
    this.buildMap();
    this.buildDynamic();
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  setShadows(on) {
    this.renderer.shadowMap.enabled = on;
    this.scene.traverse(o => { if (o.material) o.material.needsUpdate = true; });
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  buildLights() {
    this.hemi = new THREE.HemisphereLight('#e8f6ff', '#5d8a3a', 1.2);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight('#fff3d6', 1.7);
    this.sun.position.set(-25, 40, 18);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const c = this.sun.shadow.camera;
    c.left = -50; c.right = 50; c.top = 45; c.bottom = -45; c.near = 1; c.far = 120;
    this.sun.shadow.bias = -0.0008;
    this.scene.add(this.sun);
  }

  buildMap() {
    const s = this.scene;
    // grass with soft speckles
    const gc = document.createElement('canvas');
    gc.width = gc.height = 256;
    const gg = gc.getContext('2d');
    gg.fillStyle = '#86c95f';
    gg.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 900; i++) {
      gg.fillStyle = Math.random() > 0.5 ? 'rgba(60,130,50,0.25)' : 'rgba(170,220,110,0.25)';
      gg.fillRect(Math.random() * 256, Math.random() * 256, 2 + Math.random() * 4, 2 + Math.random() * 4);
    }
    const gt = new THREE.CanvasTexture(gc);
    gt.wrapS = gt.wrapT = THREE.RepeatWrapping;
    gt.repeat.set(30, 26);
    gt.colorSpace = THREE.SRGBColorSpace;
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 170), new THREE.MeshToonMaterial({ map: gt, gradientMap }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    s.add(ground);

    const flat = (x1, z1, x2, z2, color, y = 0.02) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(x2 - x1, z2 - z1), toon(color));
      m.rotation.x = -Math.PI / 2;
      m.position.set((x1 + x2) / 2, y, (z1 + z2) / 2);
      m.receiveShadow = true;
      s.add(m);
      return m;
    };
    // dirt paths
    const path = '#d9b98a';
    const yard = new THREE.Mesh(new THREE.CircleGeometry(10, 40), toon(path));
    yard.rotation.x = -Math.PI / 2;
    yard.position.set(0, 0.015, 0.5);
    yard.receiveShadow = true;
    s.add(yard);
    [[-1.8, -17, 1.8, -8], [-25, -4.8, -8, -1.2], [8, -1.8, 20, 1.8], [-6, 8, -2, 19.5], [-31.8, 9, -8, 11.4], [-31.8, 3, -28.4, 13],
      [9, -24.4, 15, -21.6], [6, 9, 30.5, 12], [28.2, 9, 31, 18], [19, -16.6, 25, -6], [-31.4, -14, -28.4, -9], [-31, -16, -12, -13], [-12, -16, -9, -8], [-22, 22.5, -12, 25.5]]
      .forEach(r => flat(...r, path, 0.012));

    // building floors and walls
    for (const b of BUILDINGS) flat(b.x1, b.z1, b.x2, b.z2, b.floor, 0.03);
    for (const f of FENCES) flat(f.x1, f.z1, f.x2, f.z2, f.floor, 0.025);
    for (const c of COLLIDERS) {
      if (c.kind === 'wall') {
        const b = BUILDINGS.find(o => o.id === c.b);
        const w = c.x2 - c.x1, d = c.z2 - c.z1;
        s.add(mesh(new THREE.BoxGeometry(w, WALL_H, d), toon(b.wall), (c.x1 + c.x2) / 2, WALL_H / 2, (c.z1 + c.z2) / 2));
        s.add(mesh(new THREE.BoxGeometry(w + 0.1, 0.18, d + 0.1), toon('#f8f1e5'), (c.x1 + c.x2) / 2, WALL_H + 0.05, (c.z1 + c.z2) / 2));
      } else if (c.kind === 'fence') {
        const horiz = c.x2 - c.x1 > c.z2 - c.z1;
        const len = horiz ? c.x2 - c.x1 : c.z2 - c.z1;
        const cx = (c.x1 + c.x2) / 2, cz = (c.z1 + c.z2) / 2;
        for (const y of [0.35, 0.72]) s.add(mesh(new THREE.BoxGeometry(horiz ? len : 0.1, 0.12, horiz ? 0.1 : len), toon('#f4e3c3'), cx, y, cz));
        const n = Math.max(1, Math.round(len / 1.5));
        for (let i = 0; i <= n; i++) {
          const t = i / n;
          s.add(mesh(boxG(0.16, FENCE_H, 0.16), toon('#e9d8b4'), horiz ? c.x1 + len * t : cx, FENCE_H / 2, horiz ? cz : c.z1 + len * t));
        }
      }
    }
    // door frames
    for (const b of BUILDINGS) {
      const lbl = makeLabel(b.name, '#fff8e1', 0.85);
      const dr = b.doors[0];
      const pos = dr.s === 's' ? [dr.at, b.z2 + 0.6] : dr.s === 'n' ? [dr.at, b.z1 - 0.6] : dr.s === 'e' ? [b.x2 + 0.6, dr.at] : [b.x1 - 0.6, dr.at];
      lbl.position.set(pos[0], WALL_H + 0.9, pos[1]);
      s.add(lbl);
    }
    this.props = PROPS.map(p => buildProp(p, s));
    this.tractor = this.props.find(p => p.userData.tractor);
    this.powered = this.props.flatMap(p => p.userData.powered || []);

    // outer boundary fence and tree ring
    const B = BOUNDS;
    for (const [x1, z1, x2, z2] of [[B.x1, B.z1, B.x2, B.z1], [B.x1, B.z2, B.x2, B.z2], [B.x1, B.z1, B.x1, B.z2], [B.x2, B.z1, B.x2, B.z2]]) {
      const horiz = z1 === z2;
      const len = horiz ? x2 - x1 : z2 - z1;
      s.add(mesh(new THREE.BoxGeometry(horiz ? len : 0.12, 0.14, horiz ? 0.12 : len), toon('#fefae0'), (x1 + x2) / 2, 0.8, (z1 + z2) / 2));
      s.add(mesh(new THREE.BoxGeometry(horiz ? len : 0.12, 0.14, horiz ? 0.12 : len), toon('#fefae0'), (x1 + x2) / 2, 0.4, (z1 + z2) / 2));
    }
    let seed = 7;
    const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    for (let i = 0; i < 110; i++) {
      const a = rnd() * Math.PI * 2;
      const rx = 46 + rnd() * 18, rz = 36 + rnd() * 14;
      s.add(tree(Math.cos(a) * rx, Math.sin(a) * rz, 0.9 + rnd() * 0.7));
    }
    // flowers
    const flowerCols = ['#ff70a6', '#ffd670', '#ffffff', '#9b5de5', '#ff9770'];
    for (let i = 0; i < 160; i++) {
      const x = B.x1 + rnd() * (B.x2 - B.x1), z = B.z1 + rnd() * (B.z2 - B.z1);
      if (COLLIDERS.some(c => x > c.x1 - 1 && x < c.x2 + 1 && z > c.z1 - 1 && z < c.z2 + 1)) continue;
      if (BUILDINGS.some(b => x > b.x1 && x < b.x2 && z > b.z1 && z < b.z2)) continue;
      if (Math.hypot(x, z - 0.5) < 10.5) continue;
      s.add(mesh(sphere(0.12, 6, 4), toon(flowerCols[i % 5]), x, 0.12, z, false));
    }
    // clouds
    this.clouds = [];
    for (let i = 0; i < 7; i++) {
      const c = new THREE.Group();
      for (let j = 0; j < 4; j++) c.add(mesh(sphere(2 + rnd() * 1.5, 10, 8), toon('#ffffff'), j * 2.2 - 3, rnd(), rnd() * 1.5, false));
      c.position.set(-70 + rnd() * 140, 22 + rnd() * 6, -60 + rnd() * 50);
      s.add(c);
      this.clouds.push(c);
    }
    // impostor tunnels look like hay-covered hatches
    this.tunnelMeshes = TUNNELS.map(t => {
      const g = new THREE.Group();
      g.add(mesh(boxG(1.2, 0.08, 1.2), toon('#6b4423'), 0, 0.05, 0, false));
      for (let i = 0; i < 4; i++) g.add(mesh(boxG(1.1, 0.1, 0.06), toon('#3d2817'), 0, 0.09, -0.4 + i * 0.27, false));
      const glow = mesh(geo('tring', () => new THREE.RingGeometry(0.75, 0.9, 24)), new THREE.MeshBasicMaterial({ color: '#ff4d6d', transparent: true, opacity: 0.6 }), 0, 0.06, 0, false);
      glow.rotation.x = -Math.PI / 2;
      glow.visible = false;
      g.add(glow);
      g.userData.glow = glow;
      g.position.set(t.x, 0, t.z);
      s.add(g);
      return g;
    });
    // doors (only visible while locked)
    this.doorMeshes = DOORS.map(d => {
      const w = d.x2 - d.x1, dd = d.z2 - d.z1;
      const m = mesh(new THREE.BoxGeometry(w, WALL_H - 0.2, dd), toon('#8b4513', { emissive: '#330000' }), d.cx, (WALL_H - 0.2) / 2, d.cz);
      m.visible = false;
      m.userData.b = d.b;
      s.add(m);
      return m;
    });
    // ambient hens in the coop
    this.hens = [];
    for (let i = 0; i < 4; i++) {
      const h = makeHen(i !== 2);
      h.position.set(-6 + i * 3, 0, -21);
      h.userData.target = new THREE.Vector3(h.position.x, 0, h.position.z);
      h.userData.area = [-7.5, -26, 6, -18.5];
      s.add(h);
      this.hens.push(h);
    }
  }

  buildDynamic() {
    const s = this.scene;
    this.markerPool = [];
    this.itemGroup = new THREE.Group();
    s.add(this.itemGroup);
    this.puddles = PUDDLES.map(p => {
      const m = new THREE.Mesh(geo('puddle', () => new THREE.CircleGeometry(PUDDLE_R, 24)), new THREE.MeshBasicMaterial({ color: '#4cc9f0', transparent: true, opacity: 0.55 }));
      m.rotation.x = -Math.PI / 2;
      m.position.set(p.x, 0.05, p.z);
      m.visible = false;
      s.add(m);
      return m;
    });
    this.alarmBeam = mesh(cyl(1.2, 1.2, 14, 16, true), new THREE.MeshBasicMaterial({ color: '#ff0a54', transparent: true, opacity: 0.35, depthWrite: false }), 0, 7, 0, false);
    this.alarmBeam.visible = false;
    s.add(this.alarmBeam);
    this.leak = new THREE.Group();
    for (let i = 0; i < 10; i++) this.leak.add(mesh(sphere(0.12, 6, 4), new THREE.MeshBasicMaterial({ color: '#90e0ef' }), 0, 0, 0, false));
    this.leak.position.set(28, 3, 22);
    this.leak.visible = false;
    s.add(this.leak);
    this.targetRing = mesh(geo('tgt', () => new THREE.RingGeometry(0.7, 0.9, 24)), new THREE.MeshBasicMaterial({ color: '#ff0a54', transparent: true, opacity: 0.8, depthWrite: false }), 0, 0.07, 0, false);
    this.targetRing.rotation.x = -Math.PI / 2;
    this.targetRing.visible = false;
    s.add(this.targetRing);
  }

  // ---------- players ----------
  setRoster(roster, selfId) {
    this.selfId = selfId;
    const ids = new Set(roster.map(r => r.id));
    for (const [id, e] of this.entities) if (!ids.has(id) || e.demo) this.removeEntity(id);
    for (const r of roster) {
      const e = this.entities.get(r.id);
      const key = `${r.color}|${r.hat}|${r.name}`;
      if (e && e.key === key) continue;
      if (e) this.removeEntity(r.id);
      this.addEntity(r.id, r, key);
    }
  }

  addEntity(id, r, key, demo = false) {
    const hex = colorById(r.color).hex;
    const model = makeChick(hex, r.hat);
    const label = makeLabel(r.name, id === this.selfId ? '#fff3b0' : '#ffffff', 0.9);
    label.position.y = 2.05;
    model.add(label);
    model.visible = false;
    this.scene.add(model);
    const e = {
      id, model, label, key, demo, color: hex,
      pos: new THREE.Vector3(), target: new THREE.Vector3(), ry: 0, tRy: 0,
      moving: false, busy: false, carry: null, ghost: false, seen: 0,
      t: Math.random() * 10, jumpT: 0, emoteT: 0, emote: null, bubble: null, stumbleT: 0, carryMesh: null,
    };
    this.entities.set(id, e);
    return e;
  }

  removeEntity(id) {
    const e = this.entities.get(id);
    if (!e) return;
    this.scene.remove(e.model);
    this.entities.delete(id);
  }

  // state: {x,z,ry,moving,busy,carry,ghost}; snap=true places immediately
  updateEntity(id, st, snap = false) {
    const e = this.entities.get(id);
    if (!e) return;
    const wasHidden = !e.model.visible;
    e.target.set(st.x, 0, st.z);
    if (snap || wasHidden || e.pos.distanceTo(e.target) > 6) e.pos.copy(e.target);
    e.tRy = st.ry;
    if (wasHidden) e.ry = st.ry;
    e.moving = st.moving;
    e.busy = st.busy;
    if (e.ghost !== !!st.ghost) {
      e.ghost = !!st.ghost;
      setGhostLook(e.model, e.ghost);
      if (e.ghost && !e.halo) {
        e.halo = mesh(geo('halo', () => new THREE.TorusGeometry(0.25, 0.04, 8, 20)), toon('#fff3b0', { emissive: '#887700' }), 0, 1.65, 0, false);
        e.halo.rotation.x = Math.PI / 2;
        e.model.userData.body.add(e.halo);
      }
      if (e.halo) e.halo.visible = e.ghost;
    }
    if ((st.carry || null) !== e.carry) {
      e.carry = st.carry || null;
      if (e.carryMesh) { e.model.userData.body.remove(e.carryMesh); e.carryMesh = null; }
      if (e.carry === 'sack') {
        e.carryMesh = mesh(sphere(0.4, 10, 8), toon('#e6ccb2'), 0, 1.75, 0.1);
        e.carryMesh.scale.set(1.1, 0.7, 0.8);
      } else if (e.carry === 'hay') {
        e.carryMesh = mesh(boxG(0.9, 0.55, 0.6), toon('#e9c46a'), 0, 1.75, 0.1);
      }
      if (e.carryMesh) e.model.userData.body.add(e.carryMesh);
    }
    e.model.visible = true;
    e.seen = this.time;
  }

  hideEntity(id) {
    const e = this.entities.get(id);
    if (e) e.model.visible = false;
  }

  entityPos(id) {
    const e = this.entities.get(id);
    return e && e.model.visible ? e.pos : null;
  }

  emote(id, emote, icon) {
    const e = this.entities.get(id);
    if (!e || !e.model.visible) return;
    if (emote === 'jump') { e.jumpT = 0.6; return; }
    e.emote = emote;
    e.emoteT = 2.4;
    if (e.bubble) e.model.remove(e.bubble);
    e.bubble = emojiSprite(icon, 0.9);
    e.bubble.position.y = 2.75;
    e.model.add(e.bubble);
    if (emote === 'wow') e.jumpT = 0.5;
  }

  stumble(id) {
    const e = this.entities.get(id);
    if (e && e.stumbleT <= 0) e.stumbleT = 0.6;
  }

  setTarget(id) {
    const e = id && this.entities.get(id);
    this.targetRing.visible = !!(e && e.model.visible);
    if (this.targetRing.visible) this.targetRing.position.set(e.pos.x, 0.07, e.pos.z);
  }

  // bodies: [{id, x, z, color}]
  setBodies(list) {
    const ids = new Set(list.map(b => b.id));
    for (const [id, m] of this.bodies) if (!ids.has(id)) { this.scene.remove(m); this.bodies.delete(id); }
    for (const b of list) {
      if (this.bodies.has(b.id)) continue;
      const m = makeBody(colorById(b.color).hex);
      m.position.set(b.x, 0, b.z);
      m.rotation.y = Math.random() * 6;
      this.scene.add(m);
      this.bodies.set(b.id, m);
    }
  }

  // ---------- markers & sabotage visuals ----------
  // list: [{x, z, kind: 'task' | 'fix' | 'carry'}]
  setMarkers(list) {
    while (this.markerPool.length < list.length) {
      const g = new THREE.Group();
      const ring = mesh(geo('mring', () => new THREE.RingGeometry(0.85, 1.05, 28)), new THREE.MeshBasicMaterial({ color: '#ffd60a', transparent: true, opacity: 0.85, depthWrite: false }), 0, 0.06, 0, false);
      ring.rotation.x = -Math.PI / 2;
      const ex = makeLabel('!', '#ffd60a', 1.3);
      ex.position.y = 2.2;
      g.add(ring, ex);
      g.userData = { ring, ex };
      this.scene.add(g);
      this.markerPool.push(g);
    }
    this.markerPool.forEach((g, i) => {
      const m = list[i];
      g.visible = !!m;
      if (!m) return;
      g.position.set(m.x, 0, m.z);
      const col = m.kind === 'fix' ? '#ff0a54' : m.kind === 'carry' ? '#4cc9f0' : '#ffd60a';
      g.userData.ring.material.color.set(col);
      g.userData.ex.material.color.set(col);
    });
  }

  setSabotage(sab, lockedBuildings, isImp) {
    const type = sab ? sab.type : null;
    const dark = type === 'lights' && !isImp;
    this.hemi.intensity = dark ? 0.35 : 1.2;
    this.sun.intensity = dark ? 0.25 : 1.7;
    this.scene.background.set(dark ? '#20304a' : '#9ad7ff');
    this.scene.fog.color.set(dark ? '#20304a' : '#9ad7ff');
    for (const p of this.powered) p.material = toon(type === 'lights' ? '#333333' : '#ffb703', type === 'lights' ? {} : { emissive: '#aa5500' });
    this.puddles.forEach(p => { p.visible = type === 'water'; });
    this.leak.visible = type === 'water';
    for (const d of this.doorMeshes) d.visible = lockedBuildings.includes(d.userData.b);
    this.alarmBeam.visible = type === 'alarm';
    if (type === 'alarm' && sab.zone) {
      const z = zoneById(sab.zone);
      this.alarmBeam.position.set((z.x1 + z.x2) / 2, 7, (z.z1 + z.z2) / 2);
    }
    // feed piles / runaway chicks
    const items = sab && sab.items ? sab.items : [];
    const key = type + items.map(i => i[0]).join(',');
    if (key !== this.itemKey) {
      this.itemKey = key;
      this.itemGroup.clear();
      for (const [id, x, z] of items) {
        const g = new THREE.Group();
        if (type === 'feed') {
          for (let i = 0; i < 7; i++) g.add(mesh(sphere(0.22, 6, 5), toon('#f4d35e'), (Math.random() - 0.5) * 1.2, 0.1, (Math.random() - 0.5) * 1.2, false));
          g.add(mesh(sphere(0.4, 8, 6), toon('#e6ccb2'), 0.4, 0.25, 0.3));
        } else {
          const c = makeChick('#ffe066');
          c.scale.setScalar(0.45);
          g.add(c);
          g.userData.hop = true;
        }
        g.position.set(x, 0, z);
        g.userData.id = id;
        this.itemGroup.add(g);
      }
    }
  }

  showTunnels(on) { for (const t of this.tunnelMeshes) t.userData.glow.visible = on; }

  // ---------- effects ----------
  poof(x, z, hex = '#ffffff') {
    const g = new THREE.Group();
    const parts = [];
    for (let i = 0; i < 26; i++) {
      const f = mesh(sphere(0.09, 6, 4), toon(i % 3 ? hex : '#ffffff'), 0, 0.8, 0, false);
      f.scale.set(1.8, 0.5, 0.9);
      f.userData.v = new THREE.Vector3((Math.random() - 0.5) * 5, 2 + Math.random() * 4, (Math.random() - 0.5) * 5);
      parts.push(f);
      g.add(f);
    }
    g.position.set(x, 0, z);
    this.scene.add(g);
    let life = 1.6;
    this.temps.push(dt => {
      life -= dt;
      for (const f of parts) {
        f.userData.v.y -= 6 * dt;
        f.userData.v.multiplyScalar(0.97);
        f.position.addScaledVector(f.userData.v, dt);
        if (f.position.y < 0.05) { f.position.y = 0.05; f.userData.v.set(0, 0, 0); }
        f.rotation.z += dt * 5;
      }
      if (life <= 0) { this.scene.remove(g); return false; }
      return true;
    });
  }

  farmEvent(ev, sfx) {
    const rnd = (() => { let s = ev.seed || 1; return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; }; })();
    const scene = this.scene;
    const walker = (model, from, to, dur, hop = 0) => {
      scene.add(model);
      let t = 0;
      model.rotation.y = Math.atan2(to.x - from.x, to.z - from.z);
      this.temps.push(dt => {
        t += dt;
        const p = Math.min(1, t / dur);
        model.position.set(from.x + (to.x - from.x) * p, Math.abs(Math.sin(t * 14)) * hop, from.z + (to.z - from.z) * p);
        if (p >= 1) { scene.remove(model); return false; }
        return true;
      });
    };
    switch (ev.type) {
      case 'duck': {
        const z = -6 + rnd() * 14;
        walker(makeDuck(), { x: -20, z }, { x: 20, z: z + 3 }, 5, 0.15);
        sfx.quack();
        return 'Bir ördek avludan koşarak geçti! 🦆';
      }
      case 'rooster': {
        sfx.rooster();
        for (const e of this.entities.values()) if (e.model.visible && !e.ghost) e.jumpT = 0.5;
        const hen = makeHen(false);
        hen.scale.setScalar(1.3);
        hen.position.set(8, 0, -6);
        scene.add(hen);
        let t = 0;
        this.temps.push(dt => { t += dt; hen.position.y = Math.abs(Math.sin(t * 8)) * 0.3; if (t > 3) { scene.remove(hen); return false; } return true; });
        return 'Horoz öttü! Herkes irkildi. 🐓';
      }
      case 'egg': {
        const egg = mesh(sphere(0.9, 16, 12), toon('#fff8e7'), 0, 0.9, 0);
        egg.scale.y = 1.25;
        const g = new THREE.Group();
        g.add(egg);
        scene.add(g);
        let t = 0;
        this.temps.push(dt => {
          t += dt;
          g.position.set(-1 + Math.sin(t) * 0.5, 0, -16 + t * 5);
          egg.rotation.x += dt * 5;
          if (t > 6) { scene.remove(g); return false; }
          return true;
        });
        return 'Dev bir yumurta yoldan yuvarlanıyor! 🥚';
      }
      case 'goat': {
        const goat = new THREE.Group();
        const gm = toon('#f1f1f1');
        const b = mesh(boxG(0.7, 0.6, 1.2), gm, 0, 0.8, 0);
        goat.add(b, mesh(boxG(0.4, 0.4, 0.5), gm, 0, 1.2, 0.7), mesh(cone(0.06, 0.3, 5), toon('#777'), 0.1, 1.5, 0.6), mesh(cone(0.06, 0.3, 5), toon('#777'), -0.1, 1.5, 0.6));
        for (const [x, z] of [[-0.25, -0.4], [0.25, -0.4], [-0.25, 0.4], [0.25, 0.4]]) goat.add(mesh(boxG(0.12, 0.5, 0.12), gm, x, 0.25, z));
        walker(goat, { x: -24, z: -3 }, { x: -12, z: -3 }, 4, 0.2);
        setTimeout(() => { sfx.thud(); this.poof(-14, -3, '#e6ccb2'); }, 3500);
        return 'Bir keçi yem çuvallarını devirdi! 🐐';
      }
      case 'tractor': {
        if (!this.tractor) return null;
        const base = this.tractor.position.clone();
        let t = 0;
        this.temps.push(dt => {
          t += dt;
          this.tractor.position.z = base.z - Math.sin(Math.min(1, t / 3) * Math.PI) * 2.5;
          this.tractor.rotation.z = Math.sin(t * 30) * 0.02;
          if (t > 3) { this.tractor.position.copy(base); this.tractor.rotation.z = 0; return false; }
          return true;
        });
        return 'Traktör bir anlığına kendi kendine hareket etti! 🚜';
      }
      case 'hay': {
        const e = this.entities.get(ev.target);
        if (!e || !e.model.visible) return null;
        const hay = mesh(cyl(0.35, 0.28, 0.4, 10), toon('#c08552'), 0, 6, 0);
        hay.add(mesh(sphere(0.35, 8, 6), toon('#e9c46a'), 0, -0.25, 0));
        e.model.add(hay);
        let t = 0;
        this.temps.push(dt => {
          t += dt;
          hay.position.y = Math.max(1.45, 6 - t * 12);
          if (hay.position.y === 1.45 && !hay.userData.hit) { hay.userData.hit = true; e.stumbleT = 1; sfx.thud(); }
          if (t > 2.2) { e.model.remove(hay); return false; }
          return true;
        });
        return null;
      }
      case 'hens': {
        sfx.squawk();
        for (let i = 0; i < 4; i++) {
          walker(makeHen(i % 2 === 0), { x: -1 + i * 0.5, z: -16 }, { x: -6 + i * 4, z: 6 + rnd() * 3 }, 3 + rnd(), 0.25);
        }
        return 'Tavuklar panikleyip kümesten kaçtı! 🐔';
      }
      default: return null;
    }
  }

  // ---------- frame ----------
  project(x, z, y = 0.6) {
    const v = new THREE.Vector3(x, y, z).project(this.camera);
    return { x: (v.x * 0.5 + 0.5) * window.innerWidth, y: (-v.y * 0.5 + 0.5) * window.innerHeight };
  }

  animateEntity(e, dt) {
    const u = e.model.userData;
    e.t += dt;
    // remote players are smoothed toward the latest snapshot; self and demo chicks move themselves
    if (e.id !== this.selfId && !e.demo) {
      e.pos.lerp(e.target, Math.min(1, dt * 12));
    }
    e.ry = lerpAngle(e.ry, e.tRy, Math.min(1, dt * 12));
    e.model.position.copy(e.pos);
    e.model.rotation.y = e.ry;
    const body = u.body;
    let y = 0, rz = 0, rx = 0, wing = 0.15, headRx = 0, spin = 0;
    if (e.ghost) {
      y = 0.35 + Math.sin(e.t * 2.5) * 0.15;
      wing = 0.4 + Math.sin(e.t * 4) * 0.3;
    } else if (e.moving) {
      const s = Math.sin(e.t * 14);
      y = Math.abs(s) * 0.12;
      rz = s * 0.12;
      wing = 0.25 + Math.abs(s) * 0.4;
      u.feet[0].position.z = 0.08 + s * 0.14;
      u.feet[1].position.z = 0.08 - s * 0.14;
    } else {
      u.feet[0].position.z = u.feet[1].position.z = 0.08;
      y = Math.sin(e.t * 2) * 0.02;
    }
    if (e.busy && !e.moving) {
      headRx = Math.sin(e.t * 12) > 0 ? 0.45 : 0.05;
      wing = 0.3 + Math.sin(e.t * 12) * 0.2;
    }
    if (e.carry) wing = 2.4;
    if (e.jumpT > 0) {
      e.jumpT -= dt;
      y += Math.sin(Math.max(0, e.jumpT) / 0.6 * Math.PI) * 1.1;
      wing = 0.6 + Math.sin(e.t * 40) * 0.6;
    }
    if (e.stumbleT > 0) {
      e.stumbleT -= dt;
      rx = Math.sin(e.stumbleT * 25) * 0.25;
    }
    if (e.emoteT > 0) {
      e.emoteT -= dt;
      const t = e.t;
      switch (e.emote) {
        case 'dance': spin = t * 9; y += Math.abs(Math.sin(t * 9)) * 0.2; wing = 1 + Math.sin(t * 18) * 0.8; break;
        case 'laugh': rx = Math.sin(t * 30) * 0.08; headRx = -0.3; break;
        case 'panic': wing = 1 + Math.sin(t * 45) * 1; rz = Math.sin(t * 35) * 0.1; break;
        case 'wave': u.wings[1].rotation.z = -2.2 + Math.sin(t * 12) * 0.4; break;
        case 'sad': headRx = 0.5; y -= 0.05; wing = 0; break;
        case 'sus': rz = 0.3; headRx = 0.15; break;
        default:
      }
      if (e.emoteT <= 0 && e.bubble) { e.model.remove(e.bubble); e.bubble = null; e.emote = null; }
    }
    body.position.y = y;
    body.rotation.z = rz;
    body.rotation.x = rx;
    body.rotation.y = spin;
    u.head.rotation.x = headRx;
    u.wings[0].rotation.z = wing;
    if (!(e.emote === 'wave' && e.emoteT > 0)) u.wings[1].rotation.z = -wing;
  }

  render(dt, focus) {
    this.time += dt;
    const t = this.time;
    for (const e of this.entities.values()) if (e.model.visible) this.animateEntity(e, dt);
    for (const b of this.bodies.values()) b.userData.stars.rotation.y += dt * 3;
    for (const g of this.markerPool) if (g.visible) {
      g.userData.ex.position.y = 2.2 + Math.sin(t * 4) * 0.15;
      g.userData.ring.scale.setScalar(1 + Math.sin(t * 5) * 0.08);
    }
    for (const g of this.itemGroup.children) if (g.userData.hop) g.position.y = Math.abs(Math.sin(t * 6 + g.userData.id)) * 0.3;
    if (this.alarmBeam.visible) this.alarmBeam.material.opacity = 0.2 + Math.abs(Math.sin(t * 6)) * 0.35;
    if (this.leak.visible) this.leak.children.forEach((d, i) => {
      const p = (t * 1.5 + i / 10) % 1;
      d.position.set(-p * 2.5, -p * p * 3, Math.sin(i) * 0.4);
    });
    if (this.targetRing.visible) this.targetRing.scale.setScalar(1 + Math.sin(t * 8) * 0.1);
    for (const c of this.clouds) { c.position.x += dt * 0.8; if (c.position.x > 80) c.position.x = -80; }
    for (const h of this.hens) {
      const u = h.userData;
      if (h.position.distanceTo(u.target) < 0.2) {
        if (Math.random() < dt * 0.5) u.target.set(u.area[0] + Math.random() * (u.area[2] - u.area[0]), 0, u.area[1] + Math.random() * (u.area[3] - u.area[1]));
        h.children[1].position.y = 0.9 - (Math.sin(t * 8 + h.id) > 0.6 ? 0.25 : 0);
      } else {
        const d = u.target.clone().sub(h.position).setY(0).normalize();
        h.position.addScaledVector(d, dt * 1.2);
        h.rotation.y = Math.atan2(d.x, d.z);
        h.position.y = Math.abs(Math.sin(t * 12)) * 0.08;
      }
    }
    this.temps = this.temps.filter(fn => fn(dt));

    if (this.demo) {
      const a = t * 0.05;
      this.camera.position.set(Math.cos(a) * 34, 26, Math.sin(a) * 34);
      this.camera.lookAt(0, 0, 0);
      this.demoTick(dt);
    } else if (focus) {
      this.camTarget.lerp(new THREE.Vector3(focus.x, 0, focus.z), Math.min(1, dt * 8));
      this.camera.position.set(this.camTarget.x, 19, this.camTarget.z + 12.5);
      this.camera.lookAt(this.camTarget.x, 0.6, this.camTarget.z);
    }
    this.renderer.render(this.scene, this.camera);
  }

  // menu background: a few chicks wandering around the yard
  setDemo(on) {
    this.demo = on;
    if (on) {
      for (const id of [...this.entities.keys()]) this.removeEntity(id);
      this.setBodies([]);
      this.setMarkers([]);
      this.setSabotage(null, [], false);
      this.targetRing.visible = false;
      const cols = ['sari', 'kirmizi', 'mavi', 'yesil', 'pembe', 'mor', 'turuncu', 'camgobegi'];
      const hats = ['none', 'cowboy', 'crown', 'chef', 'straw', 'pirate', 'goggles', 'detective'];
      cols.forEach((c, i) => {
        const e = this.addEntity(`demo${i}`, { color: c, hat: hats[i], name: '' }, '', true);
        e.label.visible = false;
        const a = (i / cols.length) * Math.PI * 2;
        this.updateEntity(e.id, { x: Math.cos(a) * 5, z: Math.sin(a) * 5, ry: 0, moving: false }, true);
        e.wait = Math.random() * 2;
      });
    } else {
      for (const [id, e] of this.entities) if (e.demo) this.removeEntity(id);
    }
  }

  demoTick(dt) {
    for (const e of this.entities.values()) {
      if (!e.demo) continue;
      e.wait -= dt;
      if (e.pos.distanceTo(e.target) < 0.1) {
        e.moving = false;
        if (e.wait <= 0) {
          e.wait = 1 + Math.random() * 3;
          const a = Math.random() * Math.PI * 2, r = Math.random() * 8;
          e.target.set(Math.cos(a) * r, 0, 0.5 + Math.sin(a) * r);
          e.tRy = Math.atan2(e.target.x - e.pos.x, e.target.z - e.pos.z);
          if (Math.random() < 0.2) e.jumpT = 0.6;
        }
      } else {
        e.moving = true;
        const d = e.target.clone().sub(e.pos);
        const step = Math.min(d.length(), dt * 3);
        e.pos.addScaledVector(d.normalize(), step);
      }
    }
  }
}

// small standalone renderer for the character preview
export class Preview {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.scene = new THREE.Scene();
    this.scene.add(new THREE.HemisphereLight('#ffffff', '#88aa66', 1.3));
    const d = new THREE.DirectionalLight('#fff3d6', 1.4);
    d.position.set(2, 4, 3);
    this.scene.add(d);
    this.camera = new THREE.PerspectiveCamera(35, 1, 0.1, 50);
    this.camera.position.set(0, 1.6, 4.4);
    this.camera.lookAt(0, 0.9, 0);
    this.model = null;
    this.t = 0;
  }
  set(color, hat) {
    if (this.model) this.scene.remove(this.model);
    this.model = makeChick(colorById(color).hex, hat);
    this.scene.add(this.model);
  }
  render(dt) {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    if (!w || !h) return;
    if (this.canvas.width !== Math.round(w * this.renderer.getPixelRatio())) {
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    }
    this.t += dt;
    if (this.model) {
      this.model.rotation.y = Math.sin(this.t * 0.8) * 0.7;
      this.model.userData.body.position.y = Math.abs(Math.sin(this.t * 3)) * 0.08;
      this.model.userData.wings[0].rotation.z = 0.2 + Math.abs(Math.sin(this.t * 3)) * 0.3;
      this.model.userData.wings[1].rotation.z = -0.2 - Math.abs(Math.sin(this.t * 3)) * 0.3;
    }
    this.renderer.render(this.scene, this.camera);
  }
}
