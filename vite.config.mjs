import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  define: {
    __BROWSER_TEST_ENABLED__: JSON.stringify(process.env.VITE_BROWSER_TEST === 'true'),
  },
  server: {
    host: '127.0.0.1',
    port: 4173,
  },
  preview: {
    host: '127.0.0.1',
    port: 4173,
  },
});
