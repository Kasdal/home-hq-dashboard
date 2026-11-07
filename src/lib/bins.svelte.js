import { fetchJson } from './http.js'
import { normalizeSchedule } from './binSchedule.js'
import { clock } from './clock.svelte.js'
import { ymd } from './time.js'

const LOCAL_KEY = 'hq:bins-state'

export const bins = $state({
  loaded: false,
  schedule: normalizeSchedule(null),
  error: '',
})

export const binState = $state({
  loaded: false,
  confirmed: {},
  error: '',
})

let stateTimer = null

function readLocal() {
  try {
    const raw = localStorage.getItem(LOCAL_KEY)
    const data = raw ? JSON.parse(raw) : null
    return data && typeof data === 'object' ? data : {}
  } catch {
    return {}
  }
}

function writeLocal(map) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(map))
  } catch {
    // Ignore storage errors.
  }
}

function formatLocal(date) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${ymd(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

async function postState(date, confirmedAt) {
  try {
    const res = await fetch('/api/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bin: { date, confirmedAt } }),
    })
    if (!res.ok) throw new Error(`state save returned ${res.status}`)
    binState.error = ''
    return true
  } catch {
    binState.error = 'offline'
    return false
  }
}

export async function loadBinConfig() {
  try {
    bins.schedule = normalizeSchedule(await fetchJson('/data/bins.json', { cache: false, timeout: 5000 }))
  } catch {
    bins.schedule = normalizeSchedule(null)
  }
  bins.loaded = true
}

export async function loadBinState() {
  const local = readLocal()

  try {
    const doc = await fetchJson('/api/state', { cache: false, timeout: 6000 })
    const server = doc && doc.bins && typeof doc.bins === 'object' ? doc.bins : {}
    // A confirmation is monotonic. Keep the local view if it is ahead.
    const merged = { ...server, ...local }
    binState.confirmed = merged
    binState.loaded = true
    binState.error = ''

    for (const [date, entry] of Object.entries(local)) {
      if (!server[date] && entry && entry.confirmedAt) postState(date, entry.confirmedAt)
    }
  } catch {
    binState.confirmed = local
    binState.loaded = true
    binState.error = 'offline'
  }
}

export async function confirmBin(date, at = clock.now) {
  const confirmedAt = formatLocal(at)
  const next = { ...binState.confirmed, [date]: { confirmedAt } }
  binState.confirmed = next
  writeLocal(next)
  await postState(date, confirmedAt)
}

export function confirmedAt(date) {
  const entry = binState.confirmed[date]
  return entry && entry.confirmedAt ? entry.confirmedAt : null
}

export function startBins() {
  loadBinConfig()
  loadBinState()
  clearInterval(stateTimer)
  stateTimer = setInterval(loadBinState, 5 * 60 * 1000)
}
