import { fetchJson } from './http.js'

// Location, names and thresholds are private. They live in /data/config.json
// on the NAS and never in this public repository.
export const DEFAULTS = {
  place: 'Home',
  latitude: null,
  longitude: null,
  timezone: 'auto',
  catName: 'Smrdljivi',
  cat: {
    hungry: 'https://media.tenor.com/0rPjitCLTt8AAAAM/cute-kitten.gif',
    fed: 'https://i.pinimg.com/736x/88/d2/e3/88d2e3118b3ce0bf527f9ed492f91698.jpg',
  },
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
      cat: { ...DEFAULTS.cat, ...(data.cat || {}) },
      theme: { ...DEFAULTS.theme, ...(data.theme || {}) },
    }
  } catch {
    cached = { ...DEFAULTS, cat: { ...DEFAULTS.cat }, theme: { ...DEFAULTS.theme } }
  }
  return cached
}
