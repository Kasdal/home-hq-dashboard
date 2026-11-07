export const PAGES = ['today', 'shopping', 'photos', 'controls', 'settings']

export const route = $state({ page: 'today' })

function readHash() {
  const hash = location.hash.replace(/^#/, '')
  return PAGES.includes(hash) ? hash : 'today'
}

export function initRoute() {
  route.page = readHash()
  window.addEventListener('hashchange', () => {
    route.page = readHash()
    window.scrollTo(0, 0)
  })
}

export function go(page) {
  if (!PAGES.includes(page)) return
  if (location.hash === `#${page}`) {
    route.page = page
    return
  }
  location.hash = `#${page}`
}
