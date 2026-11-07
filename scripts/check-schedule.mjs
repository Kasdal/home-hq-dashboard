// Schedule checks. Run with: npm run check
import assert from 'node:assert/strict'
import { binFor, upcomingPickups, ymd } from '../src/lib/time.js'
import { catCycle, nextCatChange } from '../src/lib/cat.js'

// Bin parity. The pickup on 2026-11-12 is black, then it alternates each week.
assert.equal(binFor('2026-11-12'), 'black')
assert.equal(binFor('2026-11-19'), 'green')
assert.equal(binFor('2026-11-26'), 'black')
assert.equal(binFor('2026-12-03'), 'green')
assert.equal(binFor('2026-11-05'), 'green', 'one week earlier is the other bin')

// Upcoming pickups from a Saturday.
const fromSaturday = upcomingPickups(4, new Date(2026, 10, 7, 12, 0))
assert.deepEqual(
  fromSaturday.map((item) => item.date),
  ['2026-11-12', '2026-11-19', '2026-11-26', '2026-12-03']
)
assert.deepEqual(
  fromSaturday.map((item) => item.bin),
  ['black', 'green', 'black', 'green']
)

// On a pickup day the first row is today.
const fromThursday = upcomingPickups(1, new Date(2026, 10, 12, 8, 0))
assert.equal(fromThursday[0].date, '2026-11-12')

// Cat cycles. Two rounds per day with boundaries at 05:00 and 17:00.
const cycleAt = (h, m = 0, day = 7) => catCycle(new Date(2026, 10, day, h, m))

assert.equal(cycleAt(4, 59).key, '2026-11-06:evening', 'before 05:00 belongs to last evening')
assert.equal(cycleAt(5, 0).key, '2026-11-07:morning')
assert.equal(cycleAt(16, 59).key, '2026-11-07:morning')
assert.equal(cycleAt(17, 0).key, '2026-11-07:evening')
assert.equal(cycleAt(23, 59).key, '2026-11-07:evening')

const nextAt = (h, m = 0, day = 7) => ymd(nextCatChange(new Date(2026, 10, day, h, m))) + ' ' + nextCatChange(new Date(2026, 10, day, h, m)).getHours()
assert.equal(nextAt(4, 0), '2026-11-07 5')
assert.equal(nextAt(6, 0), '2026-11-07 17')
assert.equal(nextAt(18, 0), '2026-11-08 5')

console.log('schedule checks passed')
