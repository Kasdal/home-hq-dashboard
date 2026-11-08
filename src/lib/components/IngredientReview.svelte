<script>
  import { untrack } from 'svelte'

  let { title = '', items = [], onclose, onconfirm } = $props()

  let checked = $state(untrack(() => items.map((item) => !item.exists)))

  const selectableCount = $derived(items.filter((item) => !item.exists).length)
  const selectedCount = $derived(
    items.reduce(
      (count, item, index) => count + (!item.exists && checked[index] ? 1 : 0),
      0
    )
  )
  const allOn = $derived(
    selectableCount > 0 && items.every((item, index) => item.exists || checked[index])
  )

  function toggle(index) {
    if (items[index].exists) return
    checked = checked.map((value, i) => (i === index ? !value : value))
  }

  function setAll(value) {
    checked = items.map((item) => (item.exists ? false : value))
  }

  function confirm() {
    const selected = items.filter((item, index) => !item.exists && checked[index])
    onconfirm(selected)
  }
</script>

<svelte:window
  onkeydown={(event) => {
    if (event.key === 'Escape') onclose()
  }}
/>

<div
  class="review-overlay"
  role="presentation"
  onclick={(event) => {
    if (event.target === event.currentTarget) onclose()
  }}
>
  <div class="review-card" role="dialog" aria-modal="true" aria-labelledby="review-title">
    <header class="review-head">
      <div>
        <div class="eyebrow">Shopping list</div>
        <h2 id="review-title">Add ingredients</h2>
        <p class="review-sub">
          {title ? `${title}. ` : ''}Uncheck anything you do not need.
        </p>
      </div>
      <button class="review-close" type="button" aria-label="Close" onclick={onclose}>×</button>
    </header>

    <div class="review-list">
      {#each items as item, index (item.name + index)}
        <button
          class="review-row"
          class:on={checked[index]}
          class:exists={item.exists}
          type="button"
          disabled={item.exists}
          aria-pressed={Boolean(checked[index] && !item.exists)}
          onclick={() => toggle(index)}
        >
          <span class="review-check">{checked[index] && !item.exists ? '✓' : ''}</span>
          <span class="review-body">
            <span class="review-name">{item.name}</span>
            {#if item.note}
              <span class="review-note">{item.note}</span>
            {/if}
          </span>
          {#if item.exists}
            <span class="review-flag">Already on list</span>
          {/if}
        </button>
      {/each}
    </div>

    <footer class="review-foot">
      <div class="review-count">
        {selectedCount} of {selectableCount} selected
      </div>
      <div class="review-actions">
        {#if selectableCount > 0}
          <button class="review-select" type="button" onclick={() => setAll(!allOn)}>
            {allOn ? 'Select none' : 'Select all'}
          </button>
        {/if}
        <button class="cook-secondary" type="button" onclick={onclose}>Cancel</button>
        <button
          class="cook-primary"
          type="button"
          onclick={confirm}
          disabled={selectedCount === 0}
        >
          Add {selectedCount} {selectedCount === 1 ? 'item' : 'items'}
        </button>
      </div>
    </footer>
  </div>
</div>
