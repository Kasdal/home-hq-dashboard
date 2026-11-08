import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

// The frame runs Android 6 with WebView 106. Keep the output at that level.
export default defineConfig({
  base: '/',
  plugins: [svelte()],
  build: {
    target: 'chrome106',
  },
  server: {
    // The local API is optional. Start it on port 8099 to test edits and
    // uploads in dev. The page falls back to public/data when it is absent.
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8099',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
