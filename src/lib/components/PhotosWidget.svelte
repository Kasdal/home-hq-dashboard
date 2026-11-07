<script>
  import { untrack } from 'svelte'
  import { photosState, advancePhoto } from '../photos.svelte.js'
  import { go } from '../route.svelte.js'

  let { full = false } = $props()

  let active = $state(0)
  let layers = $state(['', ''])
  let failed = $state(0)

  const count = $derived(photosState.photos.length)
  const current = $derived(photosState.photos[photosState.index] || null)
  const number = $derived(count > 0 ? (photosState.index % count) + 1 : 0)

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

  function tap() {
    if (full) {
      advancePhoto()
    } else {
      go('photos')
    }
  }

  const emptyMessage = $derived(
    photosState.hasAlbum
      ? 'Album not readable. Check the link in /data/photos.json.'
      : 'Add an album link in /data/photos.json'
  )
</script>

<section class="panel" class:photo-panel-full={full}>
  <header class="panel-head">
    <h2>Photos</h2>
    {#if photosState.error && photosState.source === 'album'}
      <span class="panel-sub">Cached</span>
    {:else if count > 1}
      <span class="panel-sub">{number} / {count}{full ? ' · tap to advance' : ''}</span>
    {/if}
  </header>

  {#if current}
    <button class="photo-wrap photo-hit" type="button" onclick={tap} aria-label={full ? 'Next photo' : 'Open photos'}>
      <img
        class="photo-layer"
        class:active={active === 0}
        src={layers[0] || undefined}
        alt={current.caption}
        draggable="false"
        onload={() => loaded(0)}
        onerror={() => failedToLoad(0)}
      />
      <img
        class="photo-layer"
        class:active={active === 1}
        src={layers[1] || undefined}
        alt=""
        draggable="false"
        onload={() => loaded(1)}
        onerror={() => failedToLoad(1)}
      />
      {#if current.caption}
        <span class="photo-caption">{current.caption}</span>
      {/if}
    </button>
  {:else if !photosState.loaded}
    <div class="empty"><span class="empty-title">Loading photos</span></div>
  {:else}
    <div class="empty">
      <span class="empty-title">No photos</span>
      <span class="empty-hint">{emptyMessage}</span>
    </div>
  {/if}
</section>
