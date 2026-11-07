import { clock } from './clock.svelte.js'

const STORAGE_KEY = 'hq:theme'

export const theme = $state({
  mode: 'auto',
  resolved: 'light',
  lightStart: '06:00',
  darkStart: '18:00',
})

function parseMinutes(value, fallback) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(value || ''))
  if (!match) return fallback
  return Number(match[1]) * 60 + Number(match[2])
}

function isDarkAt(date) {
  const light = parseMinutes(theme.lightStart, 6 * 60)
  const dark = parseMinutes(theme.darkStart, 18 * 60)
  const now = date.getHours() * 60 + date.getMinutes()

  if (light === dark) return false
  if (light < dark) return now < light || now >= dark
  // A window that crosses midnight: light is the night block.
  return now >= dark && now < light
}

export function applyTheme() {
  let dark

  if (theme.mode === 'dark') {
    dark = true
  } else if (theme.mode === 'light') {
    dark = false
  } else {
    dark = isDarkAt(clock.now)
  }

  theme.resolved = dark ? 'dark' : 'light'

  const root = document.documentElement
  if (root.getAttribute('data-theme') !== theme.resolved) {
    root.classList.add('theme-fade')
    root.setAttribute('data-theme', theme.resolved)
    setTimeout(() => root.classList.remove('theme-fade'), 700)
  }

  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', dark ? '#0d1218' : '#f2eee6')
}

export function setThemeSchedule(config) {
  if (!config) return
  if (config.lightStart) theme.lightStart = String(config.lightStart)
  if (config.darkStart) theme.darkStart = String(config.darkStart)
  applyTheme()
}

export function setThemeMode(mode) {
  if (mode !== 'light' && mode !== 'dark' && mode !== 'auto') return
  theme.mode = mode
  try {
    localStorage.setItem(STORAGE_KEY, mode)
  } catch {
    // Ignore storage errors.
  }
  applyTheme()
}

export function initTheme() {
  let saved = null
  try {
    saved = localStorage.getItem(STORAGE_KEY)
  } catch {
    saved = null
  }
  if (saved === 'light' || saved === 'dark' || saved === 'auto') theme.mode = saved
  else theme.mode = 'auto'

  applyTheme()

  // The clock ticks every second. This check switches the theme within 15 s.
  setInterval(applyTheme, 15 * 1000)
  document.addEventListener('visibilitychange', applyTheme)
}
