import './app.css'
import { mount } from 'svelte'
import App from './App.svelte'
import { initTheme } from './lib/theme.svelte.js'
import { initRoute } from './lib/route.svelte.js'
import { startWeather } from './lib/weather.svelte.js'
import { startShopping } from './lib/shopping.svelte.js'
import { startControls } from './lib/controls.svelte.js'
import { startVersionWatch } from './lib/version.svelte.js'

initTheme()
initRoute()
startWeather()
startShopping()
startControls()
startVersionWatch()

const app = mount(App, { target: document.getElementById('app') })

export default app
