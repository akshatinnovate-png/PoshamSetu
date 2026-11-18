const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('psNative', {
  isElectron: true,
  platform: process.platform,
  minimize: () => ipcRenderer.send('win:minimize'),
  maximize: () => ipcRenderer.send('win:maximize'),
  close: () => ipcRenderer.send('win:close'),
  onState: (fn) => ipcRenderer.on('win:state', (_e, s) => fn(s)),
  saveFile: (name, data) => ipcRenderer.invoke('file:save', { name, data }),
  info: () => ipcRenderer.invoke('app:info'),
  loadState: () => ipcRenderer.invoke('state:load'),
  saveState: (ops) => ipcRenderer.invoke('state:save', ops),
  printPDF: (name) => ipcRenderer.invoke('print:pdf', { name }),
});
