'use strict';
const {app, BrowserWindow, net, protocol, shell, dialog, ipcMain} = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const {Worker} = require('node:worker_threads');
const {Readable} = require('node:stream');
const {pathToFileURL} = require('node:url');
const {loadManifest} = require('./asset-store.cjs');

// Preserve the previous edition's origin, product name and userData location:
// installing the launcher must not move or reset localStorage / IndexedDB saves.
const SCHEME = 'leighneron';
const START_URL = SCHEME + '://game/index.html';
const contentRoot = path.resolve(__dirname, '..', 'dist');
const manifestPath = path.join(contentRoot, 'native-assets.json');
let gameWindow, manifest, assetDirectory, worker, sequence = 0;
const pending = new Map();
protocol.registerSchemesAsPrivileged([{
  scheme: SCHEME, privileges: {standard: true, secure: true, supportFetchAPI: true, stream: true},
}]);

function requestPath(requestUrl) {
  let url, requested;
  try {url = new URL(requestUrl); requested = decodeURIComponent(url.pathname);} catch {return null;}
  if (url.protocol !== SCHEME + ':' || url.host !== 'game' || requested.includes('\\') || requested.includes('\0')) return null;
  const relativeName = requested.replace(/^\/+/, '') || 'index.html';
  const resolved = path.resolve(contentRoot, relativeName), relative = path.relative(contentRoot, resolved);
  if (relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) return null;
  return {relativeName, resolved};
}
async function assetResponse(request, entry, relativeName) {
  const filename = path.join(assetDirectory, entry.hash);
  let stat;
  try {stat = await fs.promises.lstat(filename);} catch {return new Response('Missing game file. Restart to repair downloads.', {status: 404});}
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size !== entry.bytes) return new Response('Incomplete game file. Restart to repair downloads.', {status: 404});
  const mime = {'.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
    '.svg': 'image/svg+xml', '.avif': 'image/avif', '.mp4': 'video/mp4', '.webm': 'video/webm', '.m4a': 'audio/mp4', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.json': 'application/json', '.txt': 'text/plain',
    '.woff2': 'font/woff2', '.ttf': 'font/ttf'}[path.extname(relativeName).toLowerCase()] || 'application/octet-stream';
  const headers = {'Content-Type': mime, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store'};
  let start = 0, end = stat.size - 1, status = 200;
  const range = request.headers.get('range');
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!match || !stat.size || !match[1] && !match[2]) return new Response(null, {status: 416, headers: {'Content-Range': 'bytes */' + stat.size}});
    if (!match[1]) start = Math.max(0, stat.size - Number(match[2]));
    else {start = Number(match[1]); if (match[2]) end = Math.min(end, Number(match[2]));}
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start > end || start >= stat.size) {
      return new Response(null, {status: 416, headers: {'Content-Range': 'bytes */' + stat.size}});
    }
    status = 206; headers['Content-Range'] = `bytes ${start}-${end}/${stat.size}`;
  }
  headers['Content-Length'] = String(Math.max(0, end - start + 1));
  const body = request.method === 'HEAD' || !stat.size ? null : Readable.toWeb(fs.createReadStream(filename, {start, end}));
  return new Response(body, {status, headers});
}
function stopWorker(reason = 'Download stopped. Reopen the game to resume.') {
  const owned = worker; worker = undefined;
  for (const job of pending.values()) job.reject(new Error(reason)); pending.clear();
  if (owned) void owned.terminate();
}
function assetOperation(command) {
  if (!manifest) return Promise.resolve(command === 'status' ? {ready: true, bytes: 0} : null);
  if (pending.size) return Promise.reject(new Error('Game files are already being prepared.'));
  if (!worker) {
    // Node workers use actual files; do not depend on Chromium/ASAR virtual paths.
    const root = app.isPackaged ? path.join(process.resourcesPath, 'app.asar.unpacked') : path.resolve(__dirname, '..');
    const owned = new Worker(path.join(root, 'desktop/asset-worker.cjs'), {
      workerData: {manifestPath: path.join(root, 'dist/native-assets.json'), directory: assetDirectory},
    });
    worker = owned;
    owned.on('message', value => {
      if (worker !== owned) return;
      const job = pending.get(value.id); if (!job) return;
      if (value.progress) {if (gameWindow && !gameWindow.isDestroyed()) gameWindow.webContents.send('leighneron-assets-progress', value.progress); return;}
      pending.delete(value.id);
      if (value.error) job.reject(new Error(value.error)); else job.resolve(value.result);
      // No downloader worker remains alive during gameplay.
      if (value.result?.ready || job.command === 'prepare') {worker = undefined; void owned.terminate();}
    });
    owned.on('error', error => {if (worker === owned) stopWorker(error.message);});
    owned.on('exit', code => {if (worker === owned) stopWorker('The file downloader stopped (' + code + '). Retry to resume.');});
  }
  return new Promise((resolve, reject) => {const id = ++sequence; pending.set(id, {resolve, reject, command}); worker.postMessage({id, command});});
}
function trustedSender(event) {
  return gameWindow && !gameWindow.isDestroyed() && event.sender === gameWindow.webContents
    && event.senderFrame === event.sender.mainFrame && event.senderFrame.url === START_URL;
}
function reportFailure(message, error) {
  const detail = error?.message || String(error || message); console.error(message, error);
  dialog.showErrorBox('Tales of Leighneron could not open', message + '\n\n' + detail + '\n\nYour save has not been deleted.');
}
function openGame() {
  const window = new BrowserWindow({
    title: 'Tales of Leighneron 2.5D', width: 1440, height: 900, minWidth: 900, minHeight: 600,
    backgroundColor: '#17120d', autoHideMenuBar: true,
    icon: path.join(contentRoot, 'icons', 'tales-of-leighneron-512.png'),
    webPreferences: {preload: path.join(__dirname, 'preload.cjs'), nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true},
  });
  gameWindow = window;
  const openExternal = target => {
    try {const url = new URL(target); if (url.protocol === 'https:' || url.protocol === 'http:') void shell.openExternal(url.toString());} catch {/* Invalid link. */}
  };
  window.webContents.setWindowOpenHandler(({url}) => {openExternal(url); return {action: 'deny'};});
  window.webContents.on('will-navigate', (event, url) => {if (!url.startsWith(SCHEME + '://game/')) {event.preventDefault(); openExternal(url);}});
  window.webContents.on('did-fail-load', (_event, code, description, _url, isMainFrame) => {if (isMainFrame && code !== -3) reportFailure('The packaged game page could not load.', new Error(description));});
  window.webContents.on('render-process-gone', (_event, details) => {if (details.reason !== 'clean-exit') reportFailure('The game window stopped unexpectedly.', new Error(details.reason));});
  window.on('closed', () => {if (gameWindow === window) gameWindow = undefined; stopWorker();});
  void window.loadURL(START_URL).catch(error => reportFailure('The game could not start.', error));
}
app.setAppUserModelId('com.mernondna.rpg25d.desktop');
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => {if (gameWindow) {if (gameWindow.isMinimized()) gameWindow.restore(); gameWindow.focus();}});
  app.whenReady().then(() => {
    manifest = loadManifest(manifestPath);
    assetDirectory = path.join(app.getPath('userData'), 'game-assets-v1');
    protocol.handle(SCHEME, async request => {
      if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Method not allowed', {status: 405});
      const file = requestPath(request.url); if (!file) return new Response('Forbidden', {status: 403});
      const entry = manifest?.files.get(file.relativeName);
      if (entry) return assetResponse(request, entry, file.relativeName);
      return net.fetch(pathToFileURL(file.resolved).toString(), {method: request.method, headers: request.headers});
    });
    for (const command of ['status', 'prepare']) ipcMain.handle('leighneron-assets-' + command, event => {
      if (!trustedSender(event)) throw new Error('Game-file requests must come from the packaged game.');
      return assetOperation(command);
    });
    openGame();
    app.on('activate', () => {if (BrowserWindow.getAllWindows().length === 0) openGame();});
  }).catch(error => {reportFailure('Unable to initialize the desktop application.', error); app.quit();});
}
app.on('before-quit', () => stopWorker());
app.on('window-all-closed', () => app.quit());
