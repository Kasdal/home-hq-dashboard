<script>
  import { clock } from '../clock.svelte.js'
  import { weather, currentCondition } from '../weather.svelte.js'
  import { clockParts } from '../time.js'
  import WeatherGlyph from './WeatherGlyph.svelte'

  const parts = $derived(clockParts(clock.now))
  const cond = $derived(currentCondition())
  const code = $derived(weather.current ? weather.current.weather_code : 0)
  const temp = $derived(weather.current ? Math.round(weather.current.temperature_2m) : null)
  const high = $derived(weather.daily ? Math.round(weather.daily.temperature_2m_max[0]) : null)
  const low = $derived(weather.daily ? Math.round(weather.daily.temperature_2m_min[0]) : null)
  const night = $derived(weather.current ? weather.current.is_day === 0 : false)

  const summary = $derived.by(() => {
    const text = weather.summary || ''
    const cut = text.indexOf('. ')
    if (cut < 0) return { lead: text, rest: '' }
    return { lead: text.slice(0, cut + 1), rest: text.slice(cut + 2) }
  })
</script>

<header class="masthead">
  <div class="mast-col mast-clock">
    <div class="mast-time">
      <span class="mast-digits">{parts.time}</span><span class="mast-suffix">{parts.suffix}</span>
    </div>
    <div class="mast-daterow">
      <span class="mast-weekday">{parts.weekday}</span>
      <span class="mast-date">{parts.month} {parts.day}</span>
    </div>
  </div>

  <div class="mast-col mast-weather">
    {#if weather.place}
      <div class="mast-place">{weather.place}</div>
    {/if}

    {#if weather.status === 'ok' && weather.current}
      <div class="mast-wx">
        <span class="mast-icon"><WeatherGlyph code={code} night={night} size={96} /></span>
        <span class="mast-temp">{temp}<span class="mast-deg">°</span></span>
        <div class="mast-wxtext">
          <div class="mast-cond">{cond.label}</div>
          <div class="mast-range">H {high}°&nbsp;&nbsp;L {low}°</div>
        </div>
      </div>

      <div class="mast-summary"><em>{summary.lead}</em> {summary.rest}</div>

      {#if weather.hourly.length > 0}
        <div class="hourly">
          {#each weather.hourly as hour (hour.time)}
            <div class="hour" class:now={hour.now}>
              <span class="hour-label">{hour.label}</span>
              <WeatherGlyph code={hour.code} night={hour.night} size={24} />
              <span class="hour-temp">{hour.temp}°</span>
            </div>
          {/each}
        </div>
      {/if}
    {:else if weather.status === 'nolocation'}
      <div class="mast-cond">Weather not set</div>
      <div class="mast-summary">Add /data/config.json on the NAS.</div>
    {:else if weather.status === 'offline'}
      <div class="mast-cond">Weather offline</div>
      <div class="mast-summary">The last forecast is not available.</div>
    {:else}
      <div class="mast-cond">Weather</div>
      <div class="mast-summary">Loading the forecast.</div>
    {/if}
  </div>
</header>
