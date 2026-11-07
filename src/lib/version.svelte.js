const KEY = 'hq:version'
const CHECK_MS = 60 * 1000

export const build = $state({ version: '', built: '', stale: false })

let reloading = false

async function readVersion() {
  const res = await fetch('/version.json', { cache: 'no-store' })
  if (!res.ok) throw new Error(`version.json returned ${res.status}`)
  return res.json()
}

async function check(firstRun) {
  if (reloading) return

  let data
  try {
    data = await readVersion()
  } catch {
    build.stale = true
    return
  }

  build.stale = false

  if (!data || !data.version) return

  build.version = data.version
  build.built = data.built || ''

  let seen = null
  try {
    seen = localStorage.getItem(KEY)
  } catch {
    seen = null
  }

  if (seen !== data.version) {
    try {
      localStorage.setItem(KEY, data.version)
    } catch {
      // Ignore storage errors.
    }
    if (!firstRun) {
      // A new build is live and the old page does not match it. Reload once.
      reloading = true
      location.reload()
    }
  }
}

export function startVersionWatch() {
  check(true)
  setInterval(() => check(false), CHECK_MS)
}
