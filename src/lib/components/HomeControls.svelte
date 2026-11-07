<script>
  import { onMount } from 'svelte'
  import { fetchJson, postAction } from '../http.js'

  let controls = $state([])
  let status = $state({})
  let state = $state('loading')

  const timers = new Map()

  function normalize(raw) {
    const list = Array.isArray(raw) ? raw : raw && Array.isArray(raw.controls) ? raw.controls : []
    return list
      .map((control, i) => ({
        id: String(control.id || `${control.label || 'control'}-${i}`),
        label: String(control.label || 'Control'),
        url: String(control.url || ''),
        icon: control.icon ? String(control.icon) : '',
      }))
      .filter((control) => control.url)
  }

  async function run(control) {
    status = { ...status, [control.id]: 'busy' }
    const ok = await postAction(control.url)
    status = { ...status, [control.id]: ok ? 'ok' : 'fail' }

    const old = timers.get(control.id)
    if (old) clearTimeout(old)
    timers.set(
      control.id,
      setTimeout(() => {
        const next = { ...status }
        delete next[control.id]
        status = next
      }, 3000)
    )
  }

  async function refresh() {
    try {
      controls = normalize(await fetchJson('/data/controls.json', { timeout: 8000 }))
      state = 'ok'
    } catch {
      state = state === 'ok' ? 'ok' : 'empty'
    }
  }

  onMount(() => {
    refresh()
    const timer = setInterval(refresh, 10 * 60 * 1000)
    return () => {
      clearInterval(timer)
      for (const timerId of timers.values()) clearTimeout(timerId)
    }
  })
</script>

<section class="panel controls-panel">
  <header class="panel-head">
    <h2>Controls</h2>
    <span class="panel-sub">Tap to run</span>
  </header>

  {#if controls.length > 0}
    <div class="controls-row">
      {#each controls as control (control.id)}
        <button
          class="control"
          class:control-ok={status[control.id] === 'ok'}
          class:control-fail={status[control.id] === 'fail'}
          class:control-busy={status[control.id] === 'busy'}
          type="button"
          onclick={() => run(control)}
        >
          {#if control.icon}
            <span class="control-icon">{control.icon}</span>
          {/if}
          <span class="control-label">{control.label}</span>
          {#if status[control.id] === 'ok'}
            <span class="control-state">Done</span>
          {:else if status[control.id] === 'fail'}
            <span class="control-state">Failed</span>
          {:else if status[control.id] === 'busy'}
            <span class="control-state">Sending</span>
          {/if}
        </button>
      {/each}
    </div>
  {:else if state === 'loading'}
    <div class="empty"><span class="empty-title">Loading controls</span></div>
  {:else}
    <div class="empty">
      <span class="empty-title">No controls</span>
      <span class="empty-hint">Add <code>/data/controls.json</code> on the NAS.</span>
    </div>
  {/if}
</section>
