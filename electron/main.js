// Masaüstü uygulaması: açılış ekranından bir sunucuya bağlanır ya da bu bilgisayarda sunucu açar.
import { app, BrowserWindow, ipcMain, shell, clipboard, Menu } from 'electron';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath, pathToFileURL } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const defaults = JSON.parse(fs.readFileSync(path.join(here, 'config.json'), 'utf8'));
const cfgFile = () => path.join(app.getPath('userData'), 'ayarlar.json');

let win = null;
let hosted = null; // { port }
let tunnel = null; // { proc, url }

function loadCfg() {
  try { return { ...defaults, ...JSON.parse(fs.readFileSync(cfgFile(), 'utf8')) }; } catch { return { ...defaults }; }
}
function saveCfg(patch) {
  const c = { ...loadCfg(), ...patch };
  fs.mkdirSync(path.dirname(cfgFile()), { recursive: true });
  fs.writeFileSync(cfgFile(), JSON.stringify(c, null, 2));
}

function normalize(raw) {
  let s = String(raw || '').trim().replace(/\/+$/, '');
  if (!s) return null;
  if (!/^https?:\/\//i.test(s)) s = (/^[\d.]+(:\d+)?$|^localhost/i.test(s) ? 'http://' : 'https://') + s;
  try { return new URL(s).origin; } catch { return null; }
}

async function isGameServer(origin) {
  try {
    const r = await fetch(`${origin}/health`, { signal: AbortSignal.timeout(8000) });
    const j = await r.json();
    return j && j.ok === true;
  } catch { return false; }
}

// auto: on startup, connect straight to the configured server instead of waiting for a click
function showLauncher(auto = false) { win.loadFile(path.join(here, 'launcher.html'), auto ? { query: { auto: '1' } } : {}); }

function createWindow() {
  win = new BrowserWindow({
    width: 1280, height: 800, minWidth: 960, minHeight: 600,
    title: 'Civciv Kıyameti',
    icon: path.join(here, 'icon.png'),
    backgroundColor: '#9ad7ff',
    autoHideMenuBar: true,
    webPreferences: { preload: path.join(here, 'preload.cjs'), contextIsolation: true, sandbox: true },
  });
  Menu.setApplicationMenu(null);
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'F11') { win.setFullScreen(!win.isFullScreen()); e.preventDefault(); }
    if (input.key === 'F10') { showLauncher(); e.preventDefault(); }
  });
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
  win.on('page-title-updated', e => e.preventDefault());
  showLauncher(!!normalize(loadCfg().defaultServer));
}

// ---------- hosting ----------
async function startHosting() {
  if (hosted) return hosted;
  const { startServer } = await import(pathToFileURL(path.join(here, '..', 'server', 'app.js')).href);
  for (let port = 4747; port < 4760; port++) {
    try {
      await startServer(port);
      hosted = { port };
      return hosted;
    } catch (err) {
      if (err.code !== 'EADDRINUSE') throw err;
    }
  }
  throw new Error('Boş port bulunamadı.');
}

async function lanAddresses() {
  const { lanAddresses: list } = await import(pathToFileURL(path.join(here, '..', 'server', 'app.js')).href);
  return list();
}

async function ensureCloudflared(onStatus) {
  const exe = path.join(app.getPath('userData'), 'cloudflared.exe');
  if (fs.existsSync(exe) && fs.statSync(exe).size > 1e6) return exe;
  onStatus('Tünel aracı indiriliyor (ilk seferde ~50 MB)…');
  const arch = process.arch === 'ia32' ? '386' : 'amd64';
  const r = await fetch(`https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-${arch}.exe`);
  if (!r.ok) throw new Error(`İndirme başarısız (${r.status})`);
  const tmp = `${exe}.part`;
  fs.writeFileSync(tmp, Buffer.from(await r.arrayBuffer()));
  fs.renameSync(tmp, exe);
  return exe;
}

async function startTunnel(onStatus) {
  if (tunnel && tunnel.url) return tunnel.url;
  const exe = await ensureCloudflared(onStatus);
  onStatus('İnternet bağlantısı kuruluyor…');
  const proc = spawn(exe, ['tunnel', '--no-autoupdate', '--url', `http://localhost:${hosted.port}`], { windowsHide: true });
  tunnel = { proc, url: null };
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { proc.kill(); tunnel = null; reject(new Error('Tünel 45 saniyede açılamadı.')); }, 45000);
    const scan = chunk => {
      const m = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/.exec(chunk.toString());
      if (m && !tunnel.url) {
        tunnel.url = m[0];
        clearTimeout(timer);
        resolve(m[0]);
      }
    };
    proc.stderr.on('data', scan);
    proc.stdout.on('data', scan);
    proc.on('exit', () => { clearTimeout(timer); if (tunnel && !tunnel.url) reject(new Error('Tünel aracı kapandı.')); tunnel = null; });
  });
}

// ---------- ipc (only the local launcher page may call these) ----------
const fromLauncher = e => e.senderFrame && e.senderFrame.url.startsWith('file:');
function handle(name, fn) {
  ipcMain.handle(name, async (e, ...args) => {
    if (!fromLauncher(e)) return { error: 'İzin yok.' };
    try { return await fn(e, ...args); } catch (err) { return { error: err.message || String(err) }; }
  });
}

handle('state', async () => ({
  cfg: loadCfg(),
  version: app.getVersion(),
  hosting: hosted ? { port: hosted.port, lan: await lanAddresses(), url: tunnel && tunnel.url } : null,
}));

handle('connect', async (_e, raw) => {
  const origin = normalize(raw === 'default' ? loadCfg().defaultServer : raw);
  if (!origin) return { error: 'Geçerli bir adres yaz.' };
  if (!(await isGameServer(origin))) return { error: `${origin} adresinde oyun sunucusu bulunamadı. Adresi ve sunucunun açık olduğunu kontrol et.` };
  saveCfg({ lastServer: origin });
  win.loadURL(origin);
  return { ok: true };
});

handle('host', async (e, { internet }) => {
  const status = text => { if (!e.sender.isDestroyed()) e.sender.send('status', text); };
  status('Sunucu başlatılıyor…');
  const h = await startHosting();
  const res = { port: h.port, lan: await lanAddresses() };
  if (internet) res.url = await startTunnel(status);
  return res;
});

handle('play-local', async () => {
  if (!hosted) return { error: 'Sunucu açık değil.' };
  win.loadURL(`http://localhost:${hosted.port}`);
  return { ok: true };
});

handle('copy', async (_e, text) => { clipboard.writeText(String(text)); return { ok: true }; });

app.whenReady().then(createWindow);
app.on('window-all-closed', () => {
  if (tunnel) tunnel.proc.kill();
  app.quit();
});
