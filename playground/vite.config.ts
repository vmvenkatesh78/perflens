import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // For local source development, uncomment and add `import path from 'path'`:
  //
  // resolve: {
  //   alias: [
  //     { find: 'react-perflens/panel', replacement: path.resolve(__dirname, '../src/panel/index.ts') },
  //     { find: 'react-perflens', replacement: path.resolve(__dirname, '../src/index.ts') },
  //   ],
  // },
});
