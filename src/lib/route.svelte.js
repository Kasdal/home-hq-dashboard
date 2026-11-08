export const PAGES = ['today', 'shopping', 'cooking', 'photos', 'controls', 'settings']

export const route = $state({ page: 'today', recipeId: null })

function parseHash() {
  const raw = location.hash.replace(/^#/, '')
  const [page, ...rest] = raw.split('/')
  const recipeId =
    page === 'cooking' && rest.length > 0 && rest[0] ? decodeURIComponent(rest.join('/')) : null
  return { page: PAGES.includes(page) ? page : 'today', recipeId }
}

function apply(next) {
  route.page = next.page
  route.recipeId = next.recipeId
}

export function initRoute() {
  apply(parseHash())
  window.addEventListener('hashchange', () => {
    apply(parseHash())
    window.scrollTo(0, 0)
  })
}

export function go(page) {
  if (!PAGES.includes(page)) return
  if (location.hash === `#${page}`) {
    route.page = page
    route.recipeId = null
    return
  }
  location.hash = `#${page}`
}

export function openRecipe(id) {
  const next = `#cooking/${encodeURIComponent(id)}`
  if (location.hash === next) {
    route.page = 'cooking'
    route.recipeId = id
    return
  }
  location.hash = next
}

export function closeRecipe() {
  go('cooking')
}
