'use strict';
const fs = require('node:fs');
const fsp = fs.promises;
const path = require('node:path');
const {createHash} = require('node:crypto');
const {setImmediate: nextTurn} = require('node:timers/promises');
const ASSET_BASE_URL = 'https://github.com/zukito1411/tales-of-leighneron-2-5d/releases/download/leighneron-assets-v1/';
const HASH = /^[a-f0-9]{64}$/;
const RECEIPT = 'verified-files-v1.json';
const SAFETY_BYTES = 32 * 1024 * 1024;

function validateManifest(value) {
  if (!value || value.version !== 1 || value.baseUrl !== ASSET_BASE_URL
      || !value.files || Array.isArray(value.files) || typeof value.files !== 'object'
      || !Array.isArray(value.packs)) throw new Error('Invalid pinned game-file manifest.');
  const expected = new Map(), files = new Map(), packs = [];
  for (const [name, entry] of Object.entries(value.files)) {
    if (!name.startsWith('assets/') || /[\\\0%?#]/.test(name)
        || name.split('/').some(part => !part || part === '.' || part === '..')
        || /\.(?:js|mjs|cjs|css|html|wasm)$/i.test(name)
        || !entry || !HASH.test(entry.hash) || !Number.isSafeInteger(entry.bytes) || entry.bytes < 0
        || expected.has(entry.hash) && expected.get(entry.hash) !== entry.bytes) {
      throw new Error('Invalid pinned game-file entry.');
    }
    expected.set(entry.hash, entry.bytes); files.set(name, entry);
  }
  const assigned = new Set(), packHashes = new Set();
  for (const pack of value.packs) {
    if (!pack || !HASH.test(pack.hash) || packHashes.has(pack.hash)
        || !Number.isSafeInteger(pack.bytes) || pack.bytes <= 0
        || !Array.isArray(pack.files) || !pack.files.length) throw new Error('Invalid game-file pack.');
    packHashes.add(pack.hash);
    for (const hash of pack.files) {
      if (!expected.has(hash) || assigned.has(hash)) throw new Error('Invalid game-file pack inventory.');
      assigned.add(hash);
    }
    packs.push(pack);
  }
  if (!files.size || assigned.size !== expected.size) throw new Error('Incomplete game-file manifest.');
  return {files, expected, packs};
}
function loadManifest(filename) {
  try {return validateManifest(JSON.parse(fs.readFileSync(filename, 'utf8')));}
  catch (error) {if (error.code === 'ENOENT') return null; throw error;}
}
async function fileDigest(filename, signal) {
  const digest = createHash('sha256');
  for await (const chunk of fs.createReadStream(filename, {highWaterMark: 65536})) {
    signal?.throwIfAborted(); digest.update(chunk);
  }
  return digest.digest('hex');
}
async function existsStat(filename) {
  try {return await fsp.lstat(filename);} catch (error) {if (error.code === 'ENOENT') return null; throw error;}
}
function receiptMatches(stat, record, bytes) {
  return stat?.isFile() && !stat.isSymbolicLink() && stat.size === bytes && record?.bytes === bytes
    && stat.mtimeMs === record.mtimeMs && stat.ctimeMs === record.ctimeMs;
}

/** This store runs in an owned worker thread. Network, hashing, ZIP inflation
 * and disk writes never run in the game renderer or Electron's window thread. */
class GameAssetStore {
  constructor(manifest, directory, fetchImpl = globalThis.fetch) {
    this.manifest = manifest; this.directory = directory; this.fetch = fetchImpl;
    this.receipts = {}; this.present = new Set(); this.checked = false;
  }
  blob(hash) {if (!HASH.test(hash)) throw new Error('Invalid game-file hash.'); return path.join(this.directory, hash);}
  async check(progress = () => {}, signal) {
    if (this.checked) return;
    await fsp.mkdir(this.directory, {recursive: true});
    try {
      const value = JSON.parse(await fsp.readFile(path.join(this.directory, RECEIPT), 'utf8'));
      if (value && typeof value === 'object' && !Array.isArray(value)) this.receipts = value;
    } catch (error) {if (error.code !== 'ENOENT' && !(error instanceof SyntaxError)) throw error;}
    let count = 0;
    for (const [hash, bytes] of this.manifest.expected) {
      signal?.throwIfAborted();
      const filename = this.blob(hash), stat = await existsStat(filename);
      if (stat?.isFile() && !stat.isSymbolicLink() && stat.size === bytes) {
        if (receiptMatches(stat, this.receipts[hash], bytes) || await fileDigest(filename, signal) === hash) {
          this.present.add(hash); this.remember(hash, stat);
        }
      }
      if (++count % 32 === 0) {progress({done: count, total: this.manifest.expected.size, message: 'Checking saved game files', stage: 'check'}); await nextTurn();}
    }
    this.checked = true;
    // Receipts are an acceleration cache, never a requirement for using
    // already verified offline files. Read-only/full disks may skip this.
    try {await this.saveReceipts();} catch {/* A later check can hash files again. */}
  }
  remember(hash, stat) {this.receipts[hash] = {bytes: stat.size, mtimeMs: stat.mtimeMs, ctimeMs: stat.ctimeMs};}
  needed(pack) {return pack.files.some(hash => !this.present.has(hash));}
  async status(progress, signal) {
    await this.check(progress, signal);
    let bytes = 0;
    for (const pack of this.manifest.packs) if (this.needed(pack)) bytes += pack.bytes;
    return {ready: bytes === 0, bytes};
  }
  async saveReceipts() {
    const temporary = path.join(this.directory, RECEIPT + '.tmp');
    await fsp.writeFile(temporary, JSON.stringify(this.receipts));
    await fsp.rename(temporary, path.join(this.directory, RECEIPT));
  }
  async install(progress = () => {}, signal) {
    const {bytes: total} = await this.status(progress, signal); let done = 0;
    for (const pack of this.manifest.packs) {
      signal?.throwIfAborted(); if (!this.needed(pack)) continue;
      const part = path.join(this.directory, pack.hash + '.part');
      let stat = await existsStat(part);
      if (stat && (!stat.isFile() || stat.isSymbolicLink() || stat.size > pack.bytes)) {await fsp.rm(part, {force: true}); stat = null;}
      const offset = stat?.size ?? 0;
      const unpackBytes = pack.files.reduce((sum, hash) => sum + (this.present.has(hash) ? 0 : this.manifest.expected.get(hash)), 0);
      const space = await fsp.statfs(this.directory, {bigint: true});
      if (space.bavail * space.bsize < BigInt(pack.bytes - offset + unpackBytes + SAFETY_BYTES)) {
        throw new Error('Not enough disk space to download and unpack game files. Free space and retry.');
      }
      if (offset < pack.bytes) await this.download(pack, part, offset, done, total, progress, signal);
      progress({done, total, message: 'Verifying downloaded pack', stage: 'check'});
      if ((await existsStat(part))?.size !== pack.bytes || await fileDigest(part, signal) !== pack.hash) {
        await fsp.rm(part, {force: true}); throw new Error('A downloaded pack failed verification. Retry to download that pack again.');
      }
      progress({done, total, message: 'Unpacking verified game files', stage: 'check'});
      await this.unpack(pack, part, signal);
      await this.saveReceipts();
      await fsp.rm(part, {force: true}); done += pack.bytes;
      progress({done, total, message: 'Game files prepared', stage: 'download'});
    }
    if (!(await this.status(progress, signal)).ready) throw new Error('Some game files are still missing. Retry to continue.');
    for (const hash of Object.keys(this.receipts)) if (!this.manifest.expected.has(hash)) delete this.receipts[hash];
    await this.saveReceipts();
    // Delete only obsolete downloader blobs after every current file is usable.
    // User saves/settings/backups live outside this directory and are never inspected.
    for (const name of await fsp.readdir(this.directory)) {
      if ((HASH.test(name) && !this.manifest.expected.has(name)) || /^[a-f0-9]{64}\.(?:tmp|part)$/.test(name)) {
        await fsp.rm(path.join(this.directory, name), {force: true}); delete this.receipts[name];
      }
    }
  }
  async download(pack, part, offset, done, total, progress, signal) {
    const controller = new AbortController(), abort = () => controller.abort(signal?.reason);
    signal?.addEventListener('abort', abort, {once: true});
    let timeout;
    const resetTimeout = () => {clearTimeout(timeout); timeout = setTimeout(() => controller.abort(new Error('The connection timed out. Retry to resume.')), 30000);};
    resetTimeout(); let handle;
    try {
      signal?.throwIfAborted();
      const response = await this.fetch(ASSET_BASE_URL + pack.hash + '.zip', {
        headers: {'Accept-Encoding': 'identity', ...(offset ? {Range: 'bytes=' + offset + '-'} : {})}, signal: controller.signal,
      });
      const range = response.headers.get('content-range');
      const append = response.status === 206 && offset > 0 && range === `bytes ${offset}-${pack.bytes - 1}/${pack.bytes}`;
      if ((response.status !== 200 && !append) || !response.body) throw new Error('Game download returned HTTP ' + response.status + '. Retry when connected.');
      if (!append) offset = 0;
      const length = response.headers.get('content-length');
      if (length !== null && Number(length) !== pack.bytes - offset) throw new Error('The pack download has an unexpected size. Retry to resume.');
      handle = await fsp.open(part, append ? 'a' : 'w');
      let last = 0;
      for await (const data of response.body) {
        signal?.throwIfAborted(); resetTimeout();
        if (offset + data.length > pack.bytes) throw new Error('Pack download exceeds its pinned size.');
        let written = 0;
        while (written < data.length) {const result = await handle.write(data, written, data.length - written); if (!result.bytesWritten) throw new Error('Could not write game files.'); written += result.bytesWritten;}
        offset += data.length;
        if (Date.now() - last > 150) {progress({done: done + offset, total, message: 'Downloading game files', stage: 'download'}); last = Date.now();}
      }
      if (offset !== pack.bytes) throw new Error('Download interrupted. Retry to resume the remaining bytes.');
    } finally {
      clearTimeout(timeout); signal?.removeEventListener('abort', abort); controller.abort(); await handle?.close();
    }
  }
  async unpack(pack, part, signal) {
    // The build copies this exact installed, pinned module and its license.
    const {Unzip, UnzipInflate} = fs.existsSync(path.join(__dirname, 'vendor/fflate.cjs'))
      ? require('./vendor/fflate.cjs') : require('fflate');
    const allowed = new Set(pack.files), active = new Set();
    const unzip = new Unzip(file => {
      const hash = file.name, bytes = this.manifest.expected.get(hash);
      if (!allowed.delete(hash) || bytes === undefined || file.originalSize !== bytes || ![0, 8].includes(file.compression)) throw new Error('Unexpected file in a verified asset pack.');
      const skip = this.present.has(hash), temporary = this.blob(hash) + '.tmp';
      if (!skip) {try {fs.unlinkSync(temporary);} catch (error) {if (error.code !== 'ENOENT') throw error;}}
      const state = {fd: skip ? undefined : fs.openSync(temporary, 'wx'), temporary};
      active.add(state); let count = 0; const digest = createHash('sha256');
      file.ondata = (error, data, final) => {
        if (error) throw error; signal?.throwIfAborted(); count += data.length;
        if (count > bytes) throw new Error('Unpacked asset exceeds its pinned size.');
        digest.update(data);
        if (state.fd !== undefined) {let written = 0; while (written < data.length) {const n = fs.writeSync(state.fd, data, written, data.length - written); if (!n) throw new Error('Could not unpack game files.'); written += n;}}
        if (final) {
          if (state.fd !== undefined) {fs.closeSync(state.fd); state.fd = undefined;}
          if (count !== bytes || digest.digest('hex') !== hash) throw new Error('Unpacked game file failed verification.');
          if (!skip) fs.renameSync(temporary, this.blob(hash));
          this.present.add(hash); this.remember(hash, fs.lstatSync(this.blob(hash))); active.delete(state);
        }
      };
      file.start();
    });
    unzip.register(UnzipInflate);
    try {
      // Bound each synchronous inflation step in this background worker.
      for await (const chunk of fs.createReadStream(part, {highWaterMark: 16384})) {signal?.throwIfAborted(); unzip.push(chunk, false);}
      unzip.push(new Uint8Array(0), true);
      if (allowed.size || active.size) throw new Error('Incomplete asset pack. Retry to continue.');
    } finally {
      for (const state of active) {if (state.fd !== undefined) fs.closeSync(state.fd); try {fs.unlinkSync(state.temporary);} catch (error) {if (error.code !== 'ENOENT') throw error;}}
    }
  }
}
module.exports = {ASSET_BASE_URL, validateManifest, loadManifest, GameAssetStore};
