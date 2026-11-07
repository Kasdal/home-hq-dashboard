<script>
  import { onMount } from 'svelte'
  import CatFace from './CatFace.svelte'
  import { clock } from '../clock.svelte.js'
  import { catCycle, loadFed, saveFed } from '../cat.js'
  import { formatTime } from '../time.js'
  import { loadConfig, DEFAULTS } from '../config.js'

  let fedMap = $state({})
  let catName = $state(DEFAULTS.catName)
  let catMedia = $state(DEFAULTS.cat)
  let failed = $state({})

  onMount(() => {
    fedMap = loadFed()
    loadConfig().then((cfg) => {
      catName = cfg.catName || DEFAULTS.catName
      catMedia = cfg.cat || DEFAULTS.cat
    })
  })

  const cycle = $derived(catCycle(clock.now))
  const fedAt = $derived(fedMap[cycle.key] || 0)
  const fed = $derived(fedAt > 0)
  const fedTime = $derived(fedAt ? formatTime(new Date(fedAt)) : '')
  const mediaSrc = $derived(fed ? catMedia.fed : catMedia.hungry)
  const showMedia = $derived(Boolean(mediaSrc) && !failed[mediaSrc])

  function feed() {
    fedMap = saveFed({ ...fedMap, [cycle.key]: Date.now() })
  }
</script>

<section class="panel">
  <header class="panel-head">
    <h2>{catName}</h2>
    <span class="panel-sub">{fed ? 'Fed' : 'Not fed'}</span>
  </header>

  <div class="cat-body">
    <div class="cat-top">
      <div class="cat-title">{fed ? 'Fatso' : 'Starving'}</div>
      <div class="cat-sub">{fed ? `Fed at ${fedTime}` : 'Tap when fed.'}</div>
    </div>

    <div class="cat-stage">
      <button
        class="cat-tap"
        class:cat-fed={fed}
        type="button"
        onclick={feed}
        disabled={fed}
        aria-label={fed ? `${catName} is fed` : `Feed ${catName}`}
      >
        {#if showMedia}
          <img
            class="cat-media"
            src={mediaSrc}
            alt=""
            onerror={() => { failed = { ...failed, [mediaSrc]: true } }}
          />
        {:else}
          <CatFace happy={fed} size={112} />
        {/if}
      </button>
    </div>
  </div>
</section>
