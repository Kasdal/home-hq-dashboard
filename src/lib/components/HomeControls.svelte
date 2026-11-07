<script>
  import { controlsState, runControl } from '../controls.svelte.js'

  let { full = false } = $props()
</script>

<section class="panel controls-panel" class:controls-full={full}>
  <header class="panel-head">
    <h2>Controls</h2>
    <span class="panel-sub">Tap to run</span>
  </header>

  {#if controlsState.items.length > 0}
    <div class="controls-row">
      {#each controlsState.items as control (control.id)}
        <button
          class="control"
          class:control-ok={controlsState.status[control.id] === 'ok'}
          class:control-fail={controlsState.status[control.id] === 'fail'}
          class:control-busy={controlsState.status[control.id] === 'busy'}
          type="button"
          onclick={() => runControl(control)}
        >
          {#if control.icon}
            <span class="control-icon">{control.icon}</span>
          {/if}
          <span class="control-label">{control.label}</span>
          {#if controlsState.status[control.id] === 'ok'}
            <span class="control-state">Done</span>
          {:else if controlsState.status[control.id] === 'fail'}
            <span class="control-state">Failed</span>
          {:else if controlsState.status[control.id] === 'busy'}
            <span class="control-state">Sending</span>
          {/if}
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
</section>
