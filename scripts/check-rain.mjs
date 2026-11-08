// Rain nowcast checks. Run with: npm run check
import assert from 'node:assert/strict'
import { buildRainNowcast } from '../src/lib/rain.js'

// 15-minute slots from 19:00 to 23:45 on 2026-11-08.
const SLOT_TIMES = []
for (let hour = 19; hour <= 23; hour += 1) {
  for (let minute = 0; minute < 60; minute += 15) {
    SLOT_TIMES.push(`2026-11-08T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`)
  }
}

function slots({ wet = [], prob = {} } = {}) {
  return {
    current: { time: '2026-11-08T19:30' },
    minutely_15: {
      time: SLOT_TIMES,
      precipitation: SLOT_TIMES.map((value) => (wet.includes(value.slice(11, 16)) ? 0.2 : 0)),
      precipitation_probability: SLOT_TIMES.map((value) => prob[value.slice(11, 16)] || 0),
    },
  }
}

function label(data) {
  return buildRainNowcast(data, '2026-11-08T19:30')
}

// Rain in the current slot.
let now = label(slots({ wet: ['19:30'] }))
assert.equal(now.state, 'now')
assert.equal(now.label, 'Rain now')
assert.equal(now.source, 'minutely')

// Rain in a later slot. The label uses 24-hour time.
let later = label(slots({ wet: ['20:15'] }))
assert.equal(later.state, 'later')
assert.equal(later.label, 'Rain at 20:15')
assert.equal(later.inMinutes, 45)
assert.equal(later.at, '2026-11-08T20:15')

// A high chance counts as wet even when the amount is zero.
let chance = label(slots({ prob: { '21:00': 70 } }))
assert.equal(chance.state, 'later')
assert.equal(chance.label, 'Rain at 21:00')

// A low chance stays dry.
let low = label(slots({ prob: { '21:00': 40 } }))
assert.equal(low.state, 'dry')
assert.equal(low.label, 'Dry for 6 hours')

// Rain beyond the six-hour window does not count.
const farTimes = [...SLOT_TIMES, '2026-11-09T00:00', '2026-11-09T01:45']
let far = label({
  current: { time: '2026-11-08T19:30' },
  minutely_15: {
    time: farTimes,
    precipitation: farTimes.map((value) => (value === '2026-11-09T01:45' ? 0.2 : 0)),
    precipitation_probability: farTimes.map(() => 0),
  },
})
assert.equal(far.state, 'dry')

// The hourly chance is the fallback when the 15-minute series is absent.
const hourly = {
  current: { time: '2026-11-08T19:30' },
  hourly: {
    time: ['2026-11-08T19:00', '2026-11-08T20:00', '2026-11-08T21:00', '2026-11-08T22:00'],
    precipitation: [0, 0, 0, 0],
    precipitation_probability: [10, 20, 55, 0],
  },
}
let fallback = label(hourly)
assert.equal(fallback.source, 'hourly')
assert.equal(fallback.state, 'later')
assert.equal(fallback.label, 'Rain at 21:00')

// The hourly fallback also reports rain now.
let fallbackNow = label({
  current: { time: '2026-11-08T19:30' },
  hourly: {
    time: ['2026-11-08T19:00', '2026-11-08T20:00'],
    precipitation: [0.3, 0],
    precipitation_probability: [40, 0],
  },
})
assert.equal(fallbackNow.state, 'now')
assert.equal(fallbackNow.label, 'Rain now')

// No usable series gives no label.
assert.equal(buildRainNowcast(null, '2026-11-08T19:30').status, 'none')
assert.equal(buildRainNowcast({}, '2026-11-08T19:30').status, 'none')
assert.equal(buildRainNowcast({ current: { time: 'bad' } }, 'bad').status, 'none')

console.log('rain checks passed')
