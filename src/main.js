import { mount } from 'svelte'
import App from './App.svelte'
import './app.css'
import { clock } from './lib/clock.svelte.js'
import { theme, initTheme, setThemeSchedule } from './lib/theme.svelte.js'
import { initRoute } from './lib/route.svelte.js'
import { startWeather } from './lib/weather.svelte.js'
import { startShopping } from './lib/shopping.svelte.js'
import { startControls } from './lib/controls.svelte.js'
import { startBins, bins } from './lib/bins.svelte.js'
import { startPhotos } from './lib/photos.svelte.js'
import { loadConfig } from './lib/config.js'
import { startVersionWatch } from './lib/version.svelte.js'

initTheme()
initRoute()
startWeather()
startShopping()
startControls()
startBins()
startPhotos()
startVersionWatch()

loadConfig().then((config) => setThemeSchedule(config.theme))

const app = mount(App, { target: document.getElementById('app') })

// Expose state for the debug query checks.
if (typeof window !== 'undefined') {
  window.__hqClock = clock
  window.__hqTheme = theme
  window.__hqBins = bins
  window.__hqDebug = () => ({
    weekday: bins.schedule.weekday,
    alertStart: bins.schedule.alertStart,
    alertDayOffset: bins.schedule.alertDayOffset,
    endDate: bins.schedule.endDate,
    exceptions: bins.schedule.exceptions.length,
    themeMode: theme.mode,
    themeResolved: theme.resolved,
    lightStart: theme.lightStart,
    darkStart: theme.darkStart,
  })
}

export default app
