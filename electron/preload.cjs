// Açılış ekranının ana işlemle konuşması için dar bir köprü.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('civciv', {
  state: () => ipcRenderer.invoke('state'),
  connect: url => ipcRenderer.invoke('connect', url),
  host: internet => ipcRenderer.invoke('host', { internet }),
  playLocal: () => ipcRenderer.invoke('play-local'),
  copy: text => ipcRenderer.invoke('copy', text),
  onStatus: fn => ipcRenderer.on('status', (_e, text) => fn(text)),
});
