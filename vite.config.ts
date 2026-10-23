import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { assetManifestPlugin } from './scripts/assetManifestPlugin';
import {offlineShellPlugin} from './scripts/offlineShellPlugin';
import {publicAssetsPlugin} from './scripts/publicAssetsPlugin';

export default defineConfig({
  plugins: [react(),assetManifestPlugin(),publicAssetsPlugin(),offlineShellPlugin()],
  base: './',
  // The terrain worker uses the same immutable art metadata as the game.
  worker: {format:'es',plugins:()=>[assetManifestPlugin()]},
  build: {
    target: 'es2022',
    sourcemap: false,
  },
});
