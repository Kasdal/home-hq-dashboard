// Rain in the next few hours, from the Open-Meteo response.
//
// The 15-minute series gives an amount in mm. A slot counts as wet when it has
// a measurable amount or a high chance of rain. When the 15-minute series is
// absent, the hourly chance of rain is the fallback.

const WINDOW_MINUTES = 360
const WET_MM = 0.1
const WET_POP_MINUTELY = 65
const WET_POP_HOURLY = 50

function parseLocal(value) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function pad(value) {
  return String(value).padStart(2, '0')
}

function clock(date) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function isWet(precip, pop, popLimit) {
  const amount = Number(precip) || 0
  const chance = Number(pop) || 0
  return amount >= WET_MM || chance >= popLimit
}

function labelNow(value, source) {
  return { status: 'ok', state: 'now', label: 'Rain now', at: value || '', source, inMinutes: 0 }
}

function labelLater(date, value, source, minutes) {
  return {
    status: 'ok',
    state: 'later',
    label: `Rain at ${clock(date)}`,
    at: value,
    source,
    inMinutes: minutes,
  }
}

function labelDry(source) {
  return {
    status: 'ok',
    state: 'dry',
    label: `Dry for ${WINDOW_MINUTES / 60} hours`,
    at: '',
    source,
    inMinutes: null,
  }
}

function none() {
  return { status: 'none', state: '', label: '', at: '', source: '', inMinutes: null }
}

// The last slot at or before the start time.
function currentIndex(times, start) {
  let index = -1
  for (let i = 0; i < times.length; i += 1) {
    const date = parseLocal(times[i])
    if (!date) continue
    if (date.getTime() <= start) index = i
    else break
  }
  return index
}

function scan(series, start, source, popLimit) {
  const times = series.time
  const precip = series.precipitation || []
  const pop = series.precipitation_probability || []
  const end = start + WINDOW_MINUTES * 60000
  const index = currentIndex(times, start)

  if (index >= 0 && isWet(precip[index], pop[index], popLimit)) {
    return labelNow(times[index], source)
  }

  for (let i = index + 1; i < times.length; i += 1) {
    const date = parseLocal(times[i])
    if (!date) continue
    if (date.getTime() > end) break
    if (isWet(precip[i], pop[i], popLimit)) {
      return labelLater(
        date,
        times[i],
        source,
        Math.round((date.getTime() - start) / 60000)
      )
    }
  }

  return labelDry(source)
}

export function buildRainNowcast(data, nowValue) {
  if (!data || typeof data !== 'object') return none()

  const time = nowValue || (data.current && data.current.time)
  const now = parseLocal(time)
  if (!now) return none()

  const start = now.getTime()
  const minute = data.minutely_15
  if (minute && Array.isArray(minute.time) && minute.time.length > 0) {
    return scan(minute, start, 'minutely', WET_POP_MINUTELY)
  }

  const hourly = data.hourly
  if (hourly && Array.isArray(hourly.time) && hourly.time.length > 0) {
    return scan(hourly, start, 'hourly', WET_POP_HOURLY)
  }

  return none()
}
