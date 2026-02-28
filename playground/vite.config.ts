import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: 'perflens/panel', replacement: path.resolve(__dirname, '../src/panel/index.ts') },
      { find: 'perflens', replacement: path.resolve(__dirname, '../src/index.ts') },
    ],
  },
});
