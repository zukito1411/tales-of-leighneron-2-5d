'use strict';
const {parentPort, workerData} = require('node:worker_threads');
const {GameAssetStore, loadManifest} = require('./asset-store.cjs');
const manifest = loadManifest(workerData.manifestPath);
const store = manifest && new GameAssetStore(manifest, workerData.directory);
let busy = false;
parentPort.on('message', async ({id, command}) => {
  if (busy) {parentPort.postMessage({id, error: 'Game files are already being prepared.'}); return;}
  busy = true;
  const progress = value => parentPort.postMessage({id, progress: value});
  try {
    if (command === 'status') parentPort.postMessage({id, result: store ? await store.status(progress) : {ready: true, bytes: 0}});
    else if (command === 'prepare') {if (store) await store.install(progress); parentPort.postMessage({id, result: null});}
    else throw new Error('Unknown asset operation.');
  } catch (error) {
    const message = error.code === 'ENOSPC' ? 'There is not enough disk space. Free space and retry.' : error.message || String(error);
    parentPort.postMessage({id, error: message});
  } finally {busy = false;}
});
