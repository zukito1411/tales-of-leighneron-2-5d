'use strict';
const {contextBridge, ipcRenderer} = require('electron');
if (location.protocol === 'leighneron:' && location.host === 'game') {
  // Expose only the two fixed downloader operations and sanitized progress.
  // No renderer-supplied paths, URLs, IPC channels or filesystem access.
  contextBridge.exposeInMainWorld('leighneronDesktopAssets', {
    status: () => ipcRenderer.invoke('leighneron-assets-status'),
    prepare: () => ipcRenderer.invoke('leighneron-assets-prepare'),
    onProgress: listener => {
      const handler = (_event, progress) => listener(progress);
      ipcRenderer.on('leighneron-assets-progress', handler);
      return () => ipcRenderer.removeListener('leighneron-assets-progress', handler);
    },
  });
}
