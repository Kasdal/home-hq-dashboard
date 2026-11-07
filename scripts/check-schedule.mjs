// Schedule checks. Run with: npm run check
import assert from 'node:assert/strict'
import { ymd } from '../src/lib/time.js'
import { catCycle, nextCatChange } from '../src/lib/cat.js'
import {
  normalizeSchedule,
  binForDate,
  upcomingPickups,
  alertWindow,
} from '../src/lib/binSchedule.js'

const schedule = normalizeSchedule(null)

// Bin parity. The pickup on 2026-11-12 is black, then it alternates each week.
assert.equal(binForDate(schedule, '2026-11-12'), 'black')
assert.equal(binForDate(schedule, '2026-11-19'), 'green')
assert.equal(binForDate(schedule, '2026-11-26'), 'black')
assert.equal(binForDate(schedule, '2026-12-03'), 'green')

// Upcoming pickups from a Saturday.
const fromSaturday = upcomingPickups(schedule, 4, new Date(2026, 10, 7, 12, 0))
assert.deepEqual(
  fromSaturday.map((item) => item.date),
  ['2026-11-12', '2026-11-19', '2026-11-26', '2026-12-03']
)
assert.deepEqual(
  fromSaturday.map((item) => item.bin),
  ['black', 'green', 'black', 'green']
)

// On a pickup day the first row is today.
assert.equal(upcomingPickups(schedule, 1, new Date(2026, 10, 12, 8, 0))[0].date, '2026-11-12')

// Alert window: Thursday 00:00 by default.
const thursday = alertWindow(schedule, new Date(2026, 10, 12, 8, 0))
assert.equal(thursday && thursday.pickup.date, '2026-11-12')
assert.equal(thursday && thursday.pickup.bin, 'black')
assert.equal(alertWindow(schedule, new Date(2026, 10, 11, 20, 0)), null)
assert.equal(alertWindow(schedule, new Date(2026, 10, 13, 8, 0)), null)

// Evening-before reminder: Wednesday 18:00.
const evening = normalizeSchedule({ alertStart: '18:00', alertDayOffset: -1 })
assert.equal(alertWindow(evening, new Date(2026, 10, 11, 17, 59)), null)
const early = alertWindow(evening, new Date(2026, 10, 11, 18, 1))
assert.equal(early && early.pickup.date, '2026-11-12')
assert.equal(alertWindow(evening, new Date(2026, 10, 12, 9, 0)).pickup.date, '2026-11-12')

// A bank-holiday shift: Wednesday 18 Nov replaces Thursday 19 Nov.
const shifted = normalizeSchedule({
  exceptions: [{ date: '2026-11-18', bin: 'black', replaces: '2026-11-19' }],
})
const fromFriday = upcomingPickups(shifted, 2, new Date(2026, 10, 13, 9, 0))
assert.deepEqual(
  fromFriday.map((item) => item.date),
  ['2026-11-18', '2026-11-26']
)
assert.equal(fromFriday[0].bin, 'black')

// A skipped pickup is removed.
const skipped = normalizeSchedule({ exceptions: [{ date: '2026-11-19', skip: true }] })
const afterSkip = upcomingPickups(skipped, 2, new Date(2026, 10, 13, 9, 0))
assert.deepEqual(
  afterSkip.map((item) => item.date),
  ['2026-11-26', '2026-12-03']
)

// End of the schedule.
const ended = normalizeSchedule({ endDate: '2026-11-17' })
assert.deepEqual(upcomingPickups(ended, 2, new Date(2026, 10, 13, 9, 0)), [])
assert.equal(alertWindow(ended, new Date(2026, 10, 12, 8, 0)).pickup.date, '2026-11-12')
assert.equal(alertWindow(ended, new Date(2026, 10, 18, 8, 0)), null)

// Cat cycles. Two rounds per day with boundaries at 05:00 and 17:00.
const cycleAt = (h, m = 0, day = 7) => catCycle(new Date(2026, 10, day, h, m))

assert.equal(cycleAt(4, 59).key, '2026-11-06:evening', 'before 05:00 belongs to last evening')
assert.equal(cycleAt(5, 0).key, '2026-11-07:morning')
assert.equal(cycleAt(16, 59).key, '2026-11-07:morning')
assert.equal(cycleAt(17, 0).key, '2026-11-07:evening')
assert.equal(cycleAt(23, 59).key, '2026-11-07:evening')

const nextAt = (h, m = 0, day = 7) => {
  const next = nextCatChange(new Date(2026, 10, day, h, m))
  return `${ymd(next)} ${next.getHours()}`
}
assert.equal(nextAt(4, 0), '2026-11-07 5')
assert.equal(nextAt(6, 0), '2026-11-07 17')
assert.equal(nextAt(18, 0), '2026-11-08 5')

console.log('schedule checks passed')
