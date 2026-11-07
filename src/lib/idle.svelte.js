import { photosState } from './photos.svelte.js'

// After a period without input, the screen turns into a full-screen photo
// slideshow. A tap returns to the dashboard.
export const idle = $state({ active: false })

const ACTIVITY = ['pointerdown', 'mousedown', 'touchstart', 'touchmove', 'wheel']

let timer = null
let timeoutMs = 0

function arm() {
  clearTimeout(timer)
  if (!(timeoutMs > 0)) return
  timer = setTimeout(() => {
    if (photosState.photos.length === 0) {
      arm()
      return
    }
    idle.active = true
  }, timeoutMs)
}

function noteActivity() {
  if (idle.active) return
  arm()
}

export function wake() {
  idle.active = false
  arm()
}

export function startIdleWatch(minutes) {
  const override = Number(new URLSearchParams(window.location.search).get('sleep'))
  timeoutMs = override > 0 ? override * 1000 : Number(minutes) * 60000
  if (!(timeoutMs > 0)) return

  const options = { passive: true, capture: true }
  for (const name of ACTIVITY) window.addEventListener(name, noteActivity, options)
  window.addEventListener('keydown', noteActivity, options)
  document.addEventListener('visibilitychange', noteActivity)

  arm()
}

export function idleDebug() {
  return { active: idle.active, timeoutMs, armed: Boolean(timer) }
}
