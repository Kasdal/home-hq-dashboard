<script>
  import { onMount } from 'svelte'
  import WeatherIcon from './WeatherIcon.svelte'
  import { describeWeather } from '../weather.js'
  import { loadConfig } from '../config.js'
  import { fetchJson } from '../http.js'

  let data = $state(null)
  let place = $state('')
  let state = $state('loading')

  const current = $derived(data && data.current ? data.current : null)
  const daily = $derived(data && data.daily ? data.daily : null)
  const desc = $derived(current ? describeWeather(current.weather_code) : null)

  const code = $derived(current ? current.weather_code : 0)
  const temp = $derived(current ? Math.round(current.temperature_2m) : null)
  const high = $derived(daily ? Math.round(daily.temperature_2m_max[0]) : null)
  const low = $derived(daily ? Math.round(daily.temperature_2m_min[0]) : null)

  async function refresh() {
    const cfg = await loadConfig()
    place = cfg.place || ''
    if (cfg.latitude === null || cfg.longitude === null) {
      state = 'nolocation'
      return
    }

    const url =
      'https://api.open-meteo.com/v1/forecast' +
      `?latitude=${cfg.latitude}&longitude=${cfg.longitude}` +
      '&current=temperature_2m,apparent_temperature,weather_code' +
      '&daily=temperature_2m_max,temperature_2m_min,weather_code' +
      `&timezone=${encodeURIComponent(cfg.timezone || 'auto')}` +
      '&forecast_days=1'

    try {
      data = await fetchJson(url)
      state = 'ok'
    } catch {
      if (!data) state = 'offline'
    }
  }

  onMount(() => {
    refresh()
    const timer = setInterval(refresh, 15 * 60 * 1000)
    return () => clearInterval(timer)
  })
</script>

{#if state === 'ok' && current}
  <div class="weather">
    <WeatherIcon {code} size={46} />
    <div class="wx-temp">{temp}°</div>
    <div class="wx-text">
      <div class="wx-label">{desc.label}</div>
      <div class="wx-range">H {high}° &nbsp; L {low}°</div>
    </div>
    {#if place}
      <div class="wx-place">{place}</div>
    {/if}
  </div>
{:else if state === 'nolocation'}
  <div class="weather wx-missing">
    <span class="wx-label">Weather not set</span>
    <span class="wx-range">Add <code>/data/config.json</code></span>
  </div>
{:else if state === 'offline'}
  <div class="weather wx-missing">
    <span class="wx-label">Weather offline</span>
    <span class="wx-range">No cached forecast</span>
  </div>
{:else}
  <div class="weather wx-missing">
    <span class="wx-label">Weather</span>
  </div>
{/if}
