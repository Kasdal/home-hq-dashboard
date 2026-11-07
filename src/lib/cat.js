import { ymd } from './time.js'

// Two feed rounds per day: one from 05:00, one from 17:00.
// A fed round stays happy until the next boundary.
export const CAT_STORAGE_KEY = 'hq:cat:fed'
const KEEP_DAYS = 4

export function catCycle(now = new Date()) {
  const hour = now.getHours()
  const day = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  if (hour < 5) {
    day.setDate(day.getDate() - 1)
    return { key: `${ymd(day)}:evening`, slot: 'evening', day }
  }
  if (hour < 17) {
    return { key: `${ymd(day)}:morning`, slot: 'morning', day }
  }
  return { key: `${ymd(day)}:evening`, slot: 'evening', day }
}

export function nextCatChange(now = new Date()) {
  const hour = now.getHours()
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  if (hour < 5) {
    d.setHours(5, 0, 0, 0)
  } else if (hour < 17) {
    d.setHours(17, 0, 0, 0)
  } else {
    d.setDate(d.getDate() + 1)
    d.setHours(5, 0, 0, 0)
  }
  return d
}

export function loadFed() {
  try {
    const raw = localStorage.getItem(CAT_STORAGE_KEY)
    if (!raw) return {}
    const data = JSON.parse(raw)
    return data && typeof data === 'object' ? data : {}
  } catch {
    return {}
  }
}

export function saveFed(map) {
  const cutoff = Date.now() - KEEP_DAYS * 86400000
  const pruned = {}
  for (const [key, at] of Object.entries(map)) {
    if (typeof at === 'number' && at >= cutoff) pruned[key] = at
  }
  try {
    localStorage.setItem(CAT_STORAGE_KEY, JSON.stringify(pruned))
  } catch {
    // Ignore storage errors.
  }
  return pruned
}
