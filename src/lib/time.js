const DAY_MS = 86400000

export const WEEKDAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
]

export const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

const pad = (n) => String(n).padStart(2, '0')

export function ymd(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function parseYmd(value) {
  const [y, m, d] = value.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function utc(value) {
  const [y, m, d] = value.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

export function startOfDay(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export function daysBetween(fromYmd, toYmd) {
  return Math.round((utc(toYmd) - utc(fromYmd)) / DAY_MS)
}

export function formatLongDate(value) {
  const d = typeof value === 'string' ? parseYmd(value) : value
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`
}

export function formatShortDate(value) {
  const d = typeof value === 'string' ? parseYmd(value) : value
  return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`
}

export function formatTime(value) {
  const d = value instanceof Date ? value : new Date(value)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function clockParts(value = new Date()) {
  const hours = value.getHours()
  return {
    time: `${pad(hours)}:${pad(value.getMinutes())}`,
    weekday: WEEKDAYS[value.getDay()],
    month: MONTHS[value.getMonth()],
    day: value.getDate(),
  }
}

export function relativeDay(value, now = new Date()) {
  const days = daysBetween(ymd(startOfDay(now)), value)
  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  if (days === -1) return 'Yesterday'
  return `In ${days} days`
}
