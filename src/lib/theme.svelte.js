const STORAGE_KEY = 'hq:theme'

export const theme = $state({ mode: 'auto', resolved: 'light' })

let daylight = { sunrise: null, sunset: null }

function prefersDark() {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  } catch {
    return false
  }
}

export function setDaylight(sunrise, sunset) {
  daylight = { sunrise, sunset }
  applyTheme()
}

export function applyTheme() {
  let dark

  if (theme.mode === 'dark') {
    dark = true
  } else if (theme.mode === 'light') {
    dark = false
  } else {
    dark = prefersDark()
    if (daylight.sunrise && daylight.sunset) {
      const now = new Date()
      dark = now < daylight.sunrise || now >= daylight.sunset
    }
  }

  theme.resolved = dark ? 'dark' : 'light'
  document.documentElement.setAttribute('data-theme', theme.resolved)

  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', dark ? '#0d1218' : '#f2eee6')
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
  // Light is the design default. Auto stays available in Settings.
  else theme.mode = 'light'
  applyTheme()

  try {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme)
  } catch {
    // Older WebView: polling below covers the change.
  }

  setInterval(applyTheme, 60 * 1000)
}
