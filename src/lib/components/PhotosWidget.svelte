<script>
  import { onMount, untrack } from 'svelte'
  import { fetchJson } from '../http.js'

  let { full = false } = $props()

  let photos = $state([])
  let index = $state(0)
  let state = $state('loading')
  let broken = $state({})

  const ROTATE_MS = 20000

  function normalize(raw) {
    const list = Array.isArray(raw) ? raw : raw && Array.isArray(raw.photos) ? raw.photos : []
    return list
      .map((photo) => {
        if (typeof photo === 'string') return { src: photo, caption: '' }
        return { src: String(photo.src || ''), caption: photo.caption ? String(photo.caption) : '' }
      })
      .filter((photo) => photo.src)
  }

  const usable = $derived(photos.filter((photo) => !broken[photo.src]))
  const current = $derived(usable.length > 0 ? usable[index % usable.length] : null)

  function next() {
    if (usable.length < 2) return
    index = (index + 1) % usable.length
  }

  function onError() {
    if (!current) return
    broken = { ...broken, [current.src]: true }
    next()
  }

  $effect(() => {
    const count = usable.length
    if (count < 2) return
    let cursor = untrack(() => index)
    const timer = setInterval(() => {
      cursor = (cursor + 1) % count
      index = cursor
    }, ROTATE_MS)
    return () => clearInterval(timer)
  })

  async function refresh() {
    try {
      photos = normalize(await fetchJson('/data/photos.json', { timeout: 8000 }))
      state = 'ok'
    } catch {
      state = state === 'ok' ? 'ok' : 'empty'
    }
  }

  onMount(() => {
    refresh()
    const timer = setInterval(refresh, 10 * 60 * 1000)
    return () => clearInterval(timer)
  })
</script>

<section class="panel" class:photo-panel-full={full}>
  <header class="panel-head">
    <h2>Photos</h2>
    {#if usable.length > 1}
      <span class="panel-sub">{index % usable.length + 1} / {usable.length}</span>
    {/if}
  </header>

  {#if current}
    <div class="photo-wrap">
      {#key current.src}
        <img class="photo" src={current.src} alt={current.caption} onerror={onError} />
      {/key}
      {#if current.caption}
        <div class="photo-caption">{current.caption}</div>
      {/if}
    </div>
  {:else if state === 'loading'}
    <div class="empty"><span class="empty-title">Loading photos</span></div>
  {:else}
    <div class="empty">
      <span class="empty-title">No photos</span>
      <span class="empty-hint">Add images to <code>~/homehq/data/photos</code>.</span>
    </div>
  {/if}
</section>
