import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // resolve perflens to the source, not the built dist
      // so changes in src/ reflect instantly with HMR
      perflens: path.resolve(__dirname, '../src/index.ts'),
    },
  },
});
