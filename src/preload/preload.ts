import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('backend', {
  getInfo: () => ipcRenderer.invoke('backend:get-info'),
  health: () => ipcRenderer.invoke('backend:health'),
});
