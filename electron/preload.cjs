// Yükleme ekranının ana işlemle konuşması için dar bir köprü.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('civciv', {
  retry: () => ipcRenderer.invoke('retry'),
  onOffline: fn => ipcRenderer.on('offline', () => fn()),
});
