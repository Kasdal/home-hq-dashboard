import { fetchJson } from './http.js'
import { loadConfig } from './config.js'
import { describeWeather } from './weather.js'
import { buildRainNowcast } from './rain.js'

const EMPTY_RAIN = {
  status: 'none',
  state: '',
  label: '',
  at: '',
  source: '',
  inMinutes: null,
}

export const weather = $state({
  status: 'loading', // loading | ok | nolocation | offline
  place: '',
  current: null,
  daily: null,
  hourly: [],
  rain: EMPTY_RAIN,
  summary: '',
  updated: 0,
})

let config = null

const RAIN_CODES = new Set([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99])

function parseLocal(value) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function hourLabel(value) {
  const date = parseLocal(value)
  if (!date) return ''
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function shortHourLabel(value) {
  const date = parseLocal(value)
  if (!date) return ''
  return String(date.getHours()).padStart(2, '0')
}

function buildDayWindows(daily) {
  const map = new Map()
  if (!daily || !Array.isArray(daily.sunrise) || !Array.isArray(daily.sunset)) return map
  for (let i = 0; i < daily.sunrise.length; i += 1) {
    const rise = parseLocal(daily.sunrise[i])
    const set = parseLocal(daily.sunset[i])
    if (!rise || !set) continue
    map.set(daily.sunrise[i].slice(0, 10), { rise, set })
  }
  return map
}

function buildSummary(hourly, code) {
  const upcoming = hourly.filter((item) => !item.now).slice(0, 6)
  const wet = upcoming.filter((item) => item.pop >= 45 || RAIN_CODES.has(item.code))

  if (wet.length > 0) {
    const last = wet[wet.length - 1]
    if (wet.length >= 6) return 'Rain for the next few hours. Umbrella weather.'
    if (last) return `Rain until ${last.full}. Umbrella weather.`
    return 'Rain soon. Take the umbrella.'
  }

  if (code === 0 || code === 1) return 'Clear skies. A good day to be out.'
  if (code === 2) return 'A few clouds. Mostly bright.'
  if (code === 3) return 'Grey and still. No umbrella needed.'
  if (code === 45 || code === 48) return 'Fog about. Drive with care.'
  if (code >= 71 && code <= 77) return 'Snow on the way. Wrap up warm.'
  return 'A quiet day overhead.'
}

function buildHourly(data) {
  const list = data.hourly
  if (!list || !Array.isArray(list.time)) return []

  const windows = buildDayWindows(data.daily)
  const current = data.current && data.current.time ? data.current.time : null
  let start = list.time.findIndex((value) => current && value.slice(0, 13) === current.slice(0, 13))
  if (start < 0) {
    const now = new Date()
    start = list.time.findIndex((value) => {
      const date = parseLocal(value)
      return date && date.getHours() === now.getHours() && date.getDate() === now.getDate()
    })
  }
  if (start < 0) start = 0

  const out = []
  for (let i = start; i < Math.min(start + 7, list.time.length); i += 1) {
    const date = parseLocal(list.time[i])
    const window = date ? windows.get(list.time[i].slice(0, 10)) : null
    out.push({
      label: i === start ? 'NOW' : shortHourLabel(list.time[i]),
      full: hourLabel(list.time[i]),
      time: list.time[i],
      temp: Math.round(list.temperature_2m[i]),
      code: list.weather_code[i],
      pop: list.precipitation_probability ? list.precipitation_probability[i] : 0,
      now: i === start,
      night: window ? date < window.rise || date >= window.set : false,
    })
  }
  return out
}

export async function loadWeather() {
  config = config || (await loadConfig())
  weather.place = config.place || ''

  if (config.latitude === null || config.longitude === null) {
    weather.status = 'nolocation'
    return
  }

  const url =
    'https://api.open-meteo.com/v1/forecast' +
    `?latitude=${config.latitude}&longitude=${config.longitude}` +
    '&current=temperature_2m,apparent_temperature,weather_code,is_day' +
    '&minutely_15=precipitation,precipitation_probability' +
    '&hourly=temperature_2m,precipitation,precipitation_probability,weather_code' +
    '&daily=temperature_2m_max,temperature_2m_min,weather_code,sunrise,sunset' +
    `&timezone=${encodeURIComponent(config.timezone || 'auto')}` +
    '&forecast_days=2'

  try {
    const data = await fetchJson(url)
    weather.current = data.current
    weather.daily = data.daily
    weather.hourly = buildHourly(data)
    weather.rain = buildRainNowcast(data, new Date())
    weather.summary = buildSummary(weather.hourly, data.current ? data.current.weather_code : 3)
    weather.updated = Date.now()
    weather.status = 'ok'
  } catch {
    if (!weather.current) weather.status = 'offline'
  }
}

export function startWeather() {
  loadWeather()
  setInterval(loadWeather, 15 * 60 * 1000)
}

export function currentCondition() {
  if (!weather.current) return { label: 'Weather', icon: 'cloud' }
  return describeWeather(weather.current.weather_code)
}
