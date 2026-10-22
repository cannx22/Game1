// Masaüstü uygulaması: açılınca doğrudan oyun sunucusuna bağlanır. Başka bir seçenek sunmaz.
import { app, BrowserWindow, ipcMain, shell, Menu } from 'electron';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const { defaultServer } = JSON.parse(fs.readFileSync(path.join(here, 'config.json'), 'utf8'));
const SERVER = new URL(defaultServer).origin;

let win = null;

async function serverUp() {
  try {
    const r = await fetch(`${SERVER}/health`, { signal: AbortSignal.timeout(8000) });
    return (await r.json()).ok === true;
  } catch { return false; }
}

// Shows the local loading screen, then the game once the server answers.
async function connect() {
  await win.loadFile(path.join(here, 'loading.html'));
  if (await serverUp()) win.loadURL(SERVER);
  else win.webContents.send('offline');
}

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
    if (input.type === 'keyDown' && input.key === 'F11') { win.setFullScreen(!win.isFullScreen()); e.preventDefault(); }
  });
  // the game page failed to load (e.g. internet dropped while opening): back to the retry screen
  win.webContents.on('did-fail-load', (_e, code, _desc, url, isMainFrame) => {
    if (isMainFrame && url.startsWith(SERVER) && code !== -3) connect();
  });
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
  win.on('page-title-updated', e => e.preventDefault());
  connect();
}

ipcMain.handle('retry', e => {
  if (e.senderFrame && e.senderFrame.url.startsWith('file:')) connect();
});

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
