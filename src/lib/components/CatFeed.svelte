<script>
  import { onMount } from 'svelte'
  import CatFace from './CatFace.svelte'
  import { clock } from '../clock.svelte.js'
  import { catCycle, nextCatChange, loadFed, saveFed } from '../cat.js'
  import { formatTime } from '../time.js'
  import { loadConfig, DEFAULTS } from '../config.js'

  let fedMap = $state({})
  let catName = $state(DEFAULTS.catName)

  onMount(() => {
    fedMap = loadFed()
    loadConfig().then((cfg) => {
      catName = cfg.catName || DEFAULTS.catName
    })
  })

  const cycle = $derived(catCycle(clock.now))
  const fedAt = $derived(fedMap[cycle.key] || 0)
  const fed = $derived(fedAt > 0)
  const nextChange = $derived(formatTime(nextCatChange(clock.now)))
  const fedTime = $derived(fedAt ? formatTime(new Date(fedAt)) : '')

  function feed() {
    fedMap = saveFed({ ...fedMap, [cycle.key]: Date.now() })
  }
</script>

<section class="panel">
  <header class="panel-head">
    <h2>{catName}</h2>
    <span class="panel-sub">{fed ? 'Fed' : 'Not fed yet'}</span>
  </header>

  <div class="cat-body">
    <CatFace happy={fed} size={118} />

    <div class="cat-side">
      {#if fed}
        <div class="cat-title">{catName} jeo</div>
        <div class="cat-sub">Fed at {fedTime}. Happy until {nextChange}.</div>
        <div class="fed-badge">
          <span class="fed-check">✓</span> Done for this round
        </div>
      {:else}
        <div class="cat-title">{catName} jeo?</div>
        <div class="cat-sub">Tap when he has eaten. The next round starts at {nextChange}.</div>
        <button class="feed-btn" type="button" onclick={feed}>
          <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path
              d="M7 10v10H4a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1h3zm2 0l3.4-6.2A1.6 1.6 0 0 1 15.6 5l-.9 4h5.1a1.9 1.9 0 0 1 1.9 2.2l-1 7A1.9 1.9 0 0 1 18.8 20H9V10z"
              fill="currentColor"
            />
          </svg>
          Jeo, potvrdi
        </button>
      {/if}
    </div>
  </div>
</section>
