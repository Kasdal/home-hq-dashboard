<script>
  import { untrack } from 'svelte'
  import { photosState, advancePhoto } from '../photos.svelte.js'
  import { wake } from '../idle.svelte.js'
  import { clock } from '../clock.svelte.js'
  import { clockParts } from '../time.js'
  import { weather } from '../weather.svelte.js'

  let active = $state(0)
  let layers = $state(['', ''])
  let failed = $state(0)

  const current = $derived(photosState.photos[photosState.index] || null)
  const parts = $derived(clockParts(clock.now))
  const temp = $derived(weather.current ? Math.round(weather.current.temperature_2m) : null)

  $effect(() => {
    const photo = current
    if (!photo) return

    const shownLayer = untrack(() => active)
    const shown = untrack(() => layers)
    if (photo.src === shown[shownLayer]) return

    const back = shownLayer === 0 ? 1 : 0
    layers = back === 0 ? [photo.src, shown[1]] : [shown[0], photo.src]
  })

  function loaded(layer) {
    const photo = current
    if (!photo) return
    if (layer === active) return
    if (layers[layer] !== photo.src) return
    active = layer
  }

  function failedToLoad(layer) {
    if (layers[layer] !== (current && current.src)) return
    failed += 1
    if (failed < photosState.photos.length) {
      setTimeout(advancePhoto, 1200)
    }
  }
</script>

<svelte:window onkeydown={wake} />

<button
  class="sleep-screen"
  type="button"
  aria-label="Show the dashboard"
  onclick={wake}
>
  {#if current}
    <img
      class="sleep-layer"
      class:active={active === 0}
      src={layers[0] || undefined}
      alt=""
      draggable="false"
      onload={() => loaded(0)}
      onerror={() => failedToLoad(0)}
    />
    <img
      class="sleep-layer"
      class:active={active === 1}
      src={layers[1] || undefined}
      alt=""
      draggable="false"
      onload={() => loaded(1)}
      onerror={() => failedToLoad(1)}
    />
  {/if}

  <div class="sleep-info" aria-hidden="true">
    <div class="sleep-time">{parts.time}<span class="sleep-suffix">{parts.suffix}</span></div>
    {#if temp !== null}
      <div class="sleep-temp">{temp}<span class="sleep-deg">°</span></div>
    {/if}
  </div>
</button>
