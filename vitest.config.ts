import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/index.ts',
        'src/types.ts',
        'src/panel/**', // TODO: add panel integration tests
        'src/analyzer/rules/render-cascade.ts', // stub — v0.3.0
        'src/analyzer/rules/unnecessary-rerender.ts', // stub — v0.3.0
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
