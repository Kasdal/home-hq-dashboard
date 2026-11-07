// Shared clock. One interval for the whole page keeps the A33 CPU load low.
export const clock = $state({ now: new Date() })

if (typeof window !== 'undefined') {
  setInterval(() => {
    clock.now = new Date()
  }, 1000)

  document.addEventListener('visibilitychange', () => {
    clock.now = new Date()
  })
}
