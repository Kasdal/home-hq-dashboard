import { fetchJson, postAction } from './http.js'
import { normalizeControls } from './controls.js'

export const controlsState = $state({
  loaded: false,
  items: [],
  status: {},
})

const timers = new Map()

export async function loadControls() {
  try {
    controlsState.items = normalizeControls(await fetchJson('/data/controls.json', { timeout: 8000 }))
    controlsState.loaded = true
  } catch {
    controlsState.loaded = true
  }
}

export function startControls() {
  loadControls()
  setInterval(loadControls, 10 * 60 * 1000)
}

export async function runControl(control) {
  controlsState.status = { ...controlsState.status, [control.id]: 'busy' }
  const ok = await postAction(control.url)
  controlsState.status = { ...controlsState.status, [control.id]: ok ? 'ok' : 'fail' }

  const old = timers.get(control.id)
  if (old) clearTimeout(old)
  timers.set(
    control.id,
    setTimeout(() => {
      const next = { ...controlsState.status }
      delete next[control.id]
      controlsState.status = next
    }, 3000)
  )
}
