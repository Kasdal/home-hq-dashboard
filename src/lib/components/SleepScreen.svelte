<script>
  import { untrack } from 'svelte'
  import { photosState, advancePhoto } from '../photos.svelte.js'
  import { wake } from '../idle.svelte.js'

  let active = $state(0)
  let layers = $state(['', ''])
  let failed = $state(0)

  const current = $derived(photosState.photos[photosState.index] || null)

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
</button>
