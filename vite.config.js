import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

// The frame runs Android 6 with WebView 106. Keep the output at that level.
export default defineConfig({
  base: '/',
  plugins: [svelte()],
  build: {
    target: 'chrome106',
  },
})
