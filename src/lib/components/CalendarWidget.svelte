<script>
  import { onMount } from 'svelte'
  import { clock } from '../clock.svelte.js'
  import { fetchJson } from '../http.js'
  import { formatLongDate, formatTime, startOfDay, ymd } from '../time.js'

  let events = $state([])
  let state = $state('loading')

  const MAX_EVENTS = 5

  function toDate(value) {
    if (value instanceof Date) return value
    if (typeof value === 'string') {
      const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
      if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    }
    return new Date(value)
  }

  function normalize(raw) {
    const list = Array.isArray(raw) ? raw : raw && Array.isArray(raw.events) ? raw.events : []
    return list
      .map((event) => {
        const allDay = Boolean(event.allDay || event.all_day)
        return {
          title: String(event.title || event.summary || 'Untitled'),
          start: event.start || event.dtstart,
          end: event.end || event.dtend || event.start || event.dtstart,
          allDay,
          location: event.location || '',
        }
      })
      .filter((event) => event.start)
  }

  const visible = $derived.by(() => {
    const now = clock.now
    const today = startOfDay(now)
    const todayKey = ymd(today)

    const upcoming = events
      .filter((event) => {
        const start = toDate(event.start)
        const end = toDate(event.end)
        if (Number.isNaN(start.getTime())) return false
        if (event.allDay) return ymd(startOfDay(start)) >= todayKey
        return end.getTime() >= now.getTime() - 60 * 60 * 1000
      })
      .sort((a, b) => toDate(a.start).getTime() - toDate(b.start).getTime())
      .slice(0, MAX_EVENTS)

    const groups = []
    for (const event of upcoming) {
      const start = toDate(event.start)
      const dayKey = ymd(startOfDay(start))
      let group = groups.find((item) => item.key === dayKey)
      if (!group) {
        group = { key: dayKey, label: formatLongDate(dayKey), items: [] }
        groups.push(group)
      }
      group.items.push({
        ...event,
        time: event.allDay ? 'All day' : formatTime(start),
      })
    }
    return groups
  })

  async function refresh() {
    try {
      const raw = await fetchJson('/data/calendar.json', { timeout: 8000 })
      events = normalize(raw)
      state = 'ok'
    } catch {
      state = state === 'ok' ? 'ok' : 'empty'
    }
  }

  onMount(() => {
    refresh()
    const timer = setInterval(refresh, 5 * 60 * 1000)
    return () => clearInterval(timer)
  })
</script>

<section class="panel">
  <header class="panel-head">
    <h2>Calendar</h2>
    <span class="panel-sub">Next up</span>
  </header>

  {#if visible.length > 0}
    <div class="agenda">
      {#each visible as group (group.key)}
        <div class="agenda-day">{group.label}</div>
        {#each group.items as item, index (group.key + index)}
          <div class="agenda-item">
            <span class="agenda-time">{item.time}</span>
            <span class="agenda-title">{item.title}</span>
          </div>
        {/each}
      {/each}
    </div>
  {:else if state === 'loading'}
    <div class="empty"><span class="empty-title">Loading calendar</span></div>
  {:else}
    <div class="empty">
      <span class="empty-title">No events</span>
      <span class="empty-hint">Add <code>/data/calendar.json</code> on the NAS.</span>
    </div>
  {/if}
</section>
