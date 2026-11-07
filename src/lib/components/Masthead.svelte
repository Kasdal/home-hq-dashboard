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
</script>

<header class="masthead">
  <div class="mast-left">
    <div class="mast-time">
      {parts.time}<span class="mast-suffix">{parts.suffix}</span>
    </div>
    <div class="mast-daterow">
      <span class="mast-weekday">{parts.weekday}</span>
      <span class="mast-date">{parts.month} {parts.day}</span>
    </div>
    <div class="mast-rule"></div>
  </div>

  <div class="mast-right">
    {#if weather.status === 'ok' && weather.current}
      <div class="mast-wx">
        <WeatherGlyph {code} size={74} />
        <span class="mast-temp">{temp}°</span>
        <div class="mast-wxtext">
          <div class="mast-cond">{cond.label}</div>
          <div class="mast-range">H {high}°&nbsp;&nbsp;L {low}°</div>
        </div>
      </div>
      <div class="mast-summary">{weather.summary}</div>
      {#if weather.place}
        <div class="mast-place">{weather.place}</div>
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

{#if weather.hourly.length > 0}
  <div class="hourly">
    {#each weather.hourly as hour (hour.time)}
      <div class="hour" class:now={hour.now}>
        <span class="hour-label">{hour.label}</span>
        <WeatherGlyph code={hour.code} size={24} />
        <span class="hour-temp">{hour.temp}°</span>
      </div>
    {/each}
  </div>
{/if}
