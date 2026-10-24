'use strict';

const {app, BrowserWindow, net, protocol, shell} = require('electron');
const path = require('node:path');
const {pathToFileURL} = require('node:url');

// A fixed, secure origin keeps localStorage, IndexedDB, audio, workers and
// game saves stable between portable EXE launches. file:// would not.
const SCHEME = 'leighneron';
const START_URL = SCHEME + '://game/index.html';
const contentRoot = path.resolve(__dirname, '..', 'dist');

protocol.registerSchemesAsPrivileged([{
  scheme: SCHEME,
  privileges: {standard: true, secure: true, supportFetchAPI: true, stream: true},
}]);

function safeFileFor(requestUrl) {
  const url = new URL(requestUrl);
  if (url.protocol !== SCHEME + ':' || url.host !== 'game') return null;
  let requested;
  try {requested = decodeURIComponent(url.pathname);} catch {return null;}
  if (requested.includes('\\') || requested.includes('\0')) return null;
  const relativeName = requested.replace(/^\/+/, '') || 'index.html';
  const resolved = path.resolve(contentRoot, relativeName);
  const relativePath = path.relative(contentRoot, resolved);
  if (relativePath === '..' || relativePath.startsWith('..' + path.sep)
      || path.isAbsolute(relativePath)) return null;
  return resolved;
}

function openGame() {
  const window = new BrowserWindow({
    title: 'Tales of Leighneron 2.5D',
    width: 1440,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#17120d',
    autoHideMenuBar: true,
    icon: path.join(contentRoot, 'icons', 'tales-of-leighneron-512.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
    },
  });

  // External sites must not replace the packaged game or gain Electron APIs.
  const openExternal = (target) => {
    try {
      const url = new URL(target);
      if (url.protocol === 'https:' || url.protocol === 'http:') {
        void shell.openExternal(url.toString());
      }
    } catch { /* Ignore invalid external URLs. */ }
  };
  window.webContents.setWindowOpenHandler(({url}) => {
    openExternal(url);
    return {action: 'deny'};
  });
  window.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(SCHEME + '://game/')) {
      event.preventDefault();
      openExternal(url);
    }
  });
  void window.loadURL(START_URL);
}

app.setAppUserModelId('com.mernondna.rpg25d.desktop');
app.whenReady().then(async () => {
  protocol.handle(SCHEME, request => {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method not allowed', {status: 405});
    }
    const file = safeFileFor(request.url);
    if (!file) return new Response('Forbidden', {status: 403});
    // Electron's net.fetch handles application ASAR entries and MIME types,
    // while the renderer only sees our single stable application origin.
    return net.fetch(pathToFileURL(file).toString());
  });
  openGame();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) openGame();
  });
}).catch(error => {
  console.error('Unable to initialize Tales of Leighneron desktop:', error);
  app.quit();
});
app.on('window-all-closed', () => app.quit());
