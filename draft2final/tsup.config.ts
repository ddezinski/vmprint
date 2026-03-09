import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: ['src/cli.ts'],
    format: ['cjs'],
    target: 'node18',
    clean: true,
    noExternal: [/(.*)/], // Bundle all dependencies for a standalone CLI
    outExtension() {
      return { js: '.js' };
    },
    banner: { js: '#!/usr/bin/env node' },
  },
  {
    entry: ['src/index.ts'],
    format: ['cjs'],
    target: 'node18',
    dts: true,
  }
]);
