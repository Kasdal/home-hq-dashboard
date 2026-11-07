import { parseYmd, ymd, startOfDay } from './time.js'

export const BIN_DEFAULTS = {
  weekday: 4, // Thursday
  alertStart: '00:00',
  alertDayOffset: 0,
  referenceDate: '2026-11-12',
  referenceBin: 'black',
  endDate: null,
  exceptions: [],
}

const DAY_MS = 86400000
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function utc(value) {
  const [year, month, day] = value.split('-').map(Number)
  return Date.UTC(year, month - 1, day)
}

function otherBin(bin) {
  return bin === 'black' ? 'green' : 'black'
}

function addDays(date, days) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function parseClock(value) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(value || ''))
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) return null
  return { hours, minutes }
}

export function normalizeSchedule(raw) {
  const data = raw && typeof raw === 'object' ? raw : {}
  const exceptions = Array.isArray(data.exceptions)
    ? data.exceptions
        .filter((item) => item && DATE_RE.test(String(item.date || '')))
        .map((item) => ({
          date: String(item.date),
          bin: item.bin === 'black' || item.bin === 'green' ? item.bin : null,
          skip: Boolean(item.skip),
          replaces: DATE_RE.test(String(item.replaces || '')) ? String(item.replaces) : null,
          note: item.note ? String(item.note) : '',
        }))
    : []

  return {
    weekday:
      Number.isInteger(data.weekday) && data.weekday >= 0 && data.weekday <= 6
        ? data.weekday
        : BIN_DEFAULTS.weekday,
    alertStart: parseClock(data.alertStart) ? String(data.alertStart) : BIN_DEFAULTS.alertStart,
    alertDayOffset: Number.isInteger(data.alertDayOffset) ? data.alertDayOffset : 0,
    referenceDate: DATE_RE.test(String(data.referenceDate || ''))
      ? String(data.referenceDate)
      : BIN_DEFAULTS.referenceDate,
    referenceBin: data.referenceBin === 'green' ? 'green' : 'black',
    endDate: DATE_RE.test(String(data.endDate || '')) ? String(data.endDate) : null,
    exceptions,
  }
}

export function baseBin(schedule, dateStr) {
  const weeks = Math.round((utc(dateStr) - utc(schedule.referenceDate)) / (7 * DAY_MS))
  return ((weeks % 2) + 2) % 2 === 0 ? schedule.referenceBin : otherBin(schedule.referenceBin)
}

export function binForDate(schedule, dateStr) {
  const exception = schedule.exceptions.find((item) => item.date === dateStr && !item.skip)
  if (exception && exception.bin) return exception.bin
  return baseBin(schedule, dateStr)
}

export function pickupsBetween(schedule, fromYmd, toYmd) {
  const skip = new Set(schedule.exceptions.filter((item) => item.skip).map((item) => item.date))
  const replaced = new Set(
    schedule.exceptions.filter((item) => item.replaces).map((item) => item.replaces)
  )
  const dates = new Set()

  // Start one week before the window, on the collection weekday.
  const start = addDays(parseYmd(fromYmd), -7)
  const offset = (schedule.weekday - start.getDay() + 7) % 7
  start.setDate(start.getDate() + offset)

  for (let date = new Date(start); ymd(date) <= toYmd; date.setDate(date.getDate() + 7)) {
    dates.add(ymd(date))
  }

  // A shifted pickup can fall on any weekday.
  for (const item of schedule.exceptions) {
    if (item.skip) continue
    if (item.date < fromYmd || item.date > toYmd) continue
    dates.add(item.date)
  }

  return [...dates]
    .filter((date) => date >= fromYmd && date <= toYmd)
    .filter((date) => !skip.has(date) && !replaced.has(date))
    .filter((date) => !schedule.endDate || date <= schedule.endDate)
    .sort()
}

export function upcomingPickups(schedule, count, fromDate = new Date()) {
  const from = ymd(startOfDay(fromDate))
  const to = ymd(addDays(startOfDay(fromDate), 400))
  return pickupsBetween(schedule, from, to)
    .slice(0, count)
    .map((date) => ({ date, bin: binForDate(schedule, date) }))
}

export function alertWindow(schedule, now = new Date()) {
  const from = addDays(startOfDay(now), Math.min(0, schedule.alertDayOffset) - 1)
  const pickups = upcomingPickups(schedule, 3, from)
  const clock = parseClock(schedule.alertStart) || { hours: 0, minutes: 0 }

  for (const pickup of pickups) {
    const startDay = addDays(parseYmd(pickup.date), schedule.alertDayOffset)
    startDay.setHours(clock.hours, clock.minutes, 0, 0)

    const end = parseYmd(pickup.date)
    end.setHours(23, 59, 59, 999)

    if (now >= startDay && now <= end) {
      return { pickup, start: startDay, end }
    }
  }

  return null
}

export function weekdayName(index) {
  return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][index] || ''
}
