<script>
  import { controlsState, runControl } from '../controls.svelte.js'
</script>

<div class="page controls-page">
  <header class="page-head">
    <div>
      <div class="eyebrow">Home</div>
      <h1 class="page-title">Controls</h1>
    </div>
    <span class="page-note">Tap a tile to run it</span>
  </header>

  {#if controlsState.items.length > 0}
    <div class="controls-grid">
      {#each controlsState.items as control (control.id)}
        <button
          class="control-tile"
          class:control-ok={controlsState.status[control.id] === 'ok'}
          class:control-fail={controlsState.status[control.id] === 'fail'}
          type="button"
          onclick={() => runControl(control)}
        >
          <span class="control-tile-icon">{control.icon || '·'}</span>
          <span class="control-tile-label">{control.label}</span>
          <span class="control-tile-state">
            {#if controlsState.status[control.id] === 'ok'}Done
            {:else if controlsState.status[control.id] === 'fail'}Failed
            {:else if controlsState.status[control.id] === 'busy'}Sending
            {:else}Ready{/if}
          </span>
        </button>
      {/each}
    </div>
  {:else if !controlsState.loaded}
    <div class="empty"><span class="empty-title">Loading controls</span></div>
  {:else}
    <div class="empty">
      <span class="empty-title">No controls</span>
      <span class="empty-hint">Add <code>/data/controls.json</code> on the NAS.</span>
    </div>
  {/if}
</div>
