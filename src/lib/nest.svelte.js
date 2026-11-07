import { fetchJson } from './http.js'

// Indoor temperature from the Nest thermostat. The NAS writes /data/nest.json.
export const nest = $state({
  status: 'loading', // loading | ok | missing
  temperature: null,
  target: null,
  mode: '',
  updated: '',
})

let loadTimer = null

export async function loadNest() {
  try {
    const doc = await fetchJson('/data/nest.json', { cache: false, timeout: 6000 })
    const value = Number(doc.temperature)
    if (!Number.isFinite(value)) throw new Error('bad temperature')
    nest.temperature = value
    const target = Number(doc.target)
    nest.target = Number.isFinite(target) ? target : null
    nest.mode = doc.mode ? String(doc.mode) : ''
    nest.updated = doc.updated || ''
    nest.status = 'ok'
  } catch {
    if (nest.status !== 'ok') nest.status = 'missing'
  }
}

export function startNest() {
  loadNest()
  clearInterval(loadTimer)
  loadTimer = setInterval(loadNest, 60 * 1000)
}
