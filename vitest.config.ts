import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['tests/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/index.ts',
        'src/types.ts',
        'src/analyzer/**', // stubs — covered when implemented in v0.3.0
        'src/panel/**', // stub — covered when implemented in v0.2.0
      ],
      thresholds: {
        statements: 90,
        branches: 85,
        functions: 90,
        lines: 90,
      },
    },
    benchmark: {
      include: ['tests/benchmarks/**/*.bench.ts'],
    },
  },
});
