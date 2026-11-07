const params = new URLSearchParams(window.location.search)
const rawNow = params.get('now')

let simulatedStart = null
if (rawNow) {
  const parsed = new Date(rawNow)
  if (!Number.isNaN(parsed.getTime())) simulatedStart = parsed
}

const realStart = Date.now()

export const simulation = {
  active: Boolean(simulatedStart),
  start: simulatedStart,
}

function simulatedNow() {
  if (!simulatedStart) return new Date()
  return new Date(simulatedStart.getTime() + (Date.now() - realStart))
}

// Shared clock. One interval for the whole page keeps the A33 CPU load low.
// With ?now=2026-11-12T08:00 the clock runs from that time instead.
export const clock = $state({ now: simulatedNow() })

setInterval(() => {
  clock.now = simulatedNow()
}, 1000)

document.addEventListener('visibilitychange', () => {
  clock.now = simulatedNow()
})
