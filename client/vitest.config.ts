import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';
import { fileURLToPath, URL } from 'url';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  plugins: [
    react(),
    tsconfigPaths({
      projects: ['./tsconfig.json'],
    }),
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/setup.ts'],
    include: ['src/**/__tests__/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', 'dist', '.tanstack', 'src/routes', 'coverage'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'node_modules/',
        'src/__tests__/',
        'src/routes/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mocks/**',
        '**/*.test.{ts,tsx}',
        '**/*.spec.{ts,tsx}',
        'coverage/',
        'dist/',
        '**/*.gen.ts',  // Exclude generated files
        '**/generated/**',  // Exclude generated folders
      ],
      thresholds: {
        global: {
          branches: 70,
          functions: 80,
          lines: 80,
          statements: 80,
        },
      },
    },
    // Fix for React 19
    poolOptions: {
      threads: {
        singleThread: true,
      },
    },
    // Disable deprecation warnings for now
    clearMocks: true,
  },
  esbuild: {
    target: 'es2020',
  },
});
