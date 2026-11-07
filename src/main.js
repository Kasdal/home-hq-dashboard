import './app.css'
import { mount } from 'svelte'
import App from './App.svelte'
import { startVersionWatch } from './lib/version.svelte.js'

startVersionWatch()

const app = mount(App, { target: document.getElementById('app') })

export default app
