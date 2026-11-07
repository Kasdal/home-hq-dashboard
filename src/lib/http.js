const CACHE_PREFIX = 'hq:cache:'

// JSON fetch with a timeout and a localStorage fallback for offline boots.
export async function fetchJson(url, { timeout = 8000, cache = true } = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)

  try {
    const res = await fetch(url, { cache: 'no-store', signal: controller.signal })
    if (!res.ok) throw new Error(`${url} returned ${res.status}`)
    const data = await res.json()
    if (cache) {
      try {
        localStorage.setItem(CACHE_PREFIX + url, JSON.stringify({ at: Date.now(), data }))
      } catch {
        // Storage can be full or disabled. The page still works.
      }
    }
    return data
  } catch (err) {
    if (cache) {
      try {
        const raw = localStorage.getItem(CACHE_PREFIX + url)
        if (raw) return JSON.parse(raw).data
      } catch {
        // Ignore a bad cache entry.
      }
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}

export async function postAction(url, timeout = 8000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  try {
    const res = await fetch(url, { method: 'POST', signal: controller.signal })
    return res.ok
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}
