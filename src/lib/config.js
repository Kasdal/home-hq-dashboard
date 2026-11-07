import { fetchJson } from './http.js'

// Location, names and thresholds are private. They live in /data/config.json
// on the NAS and never in this public repository.
export const DEFAULTS = {
  place: 'Home',
  latitude: null,
  longitude: null,
  timezone: 'auto',
  catName: 'Smrdljivi',
  theme: {
    lightStart: '06:00',
    darkStart: '18:00',
  },
}

let cached = null

export async function loadConfig() {
  if (cached) return cached
  try {
    const data = await fetchJson('/data/config.json', { timeout: 5000 })
    cached = {
      ...DEFAULTS,
      ...data,
      theme: { ...DEFAULTS.theme, ...(data.theme || {}) },
    }
  } catch {
    cached = { ...DEFAULTS, theme: { ...DEFAULTS.theme } }
  }
  return cached
}
