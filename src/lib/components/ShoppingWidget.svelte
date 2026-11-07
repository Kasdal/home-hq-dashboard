<script>
  import { go } from '../route.svelte.js'
  import { shopping, toggleDone, openItems } from '../shopping.svelte.js'

  let filter = $state('all')

  const open = $derived(openItems())
  const filtered = $derived(
    open.filter((item) => filter === 'all' || item.store === 'any' || item.store === filter)
  )
  const visible = $derived(filtered.slice(0, 4))
  const more = $derived(Math.max(0, filtered.length - visible.length))

  function storeName(id) {
    const store = shopping.stores.find((item) => item.id === id)
    return store ? store.name : id
  }
</script>

<section class="panel shop-widget">
  <header class="panel-head">
    <button class="panel-title-btn" type="button" onclick={() => go('shopping')}>
      Shopping
      <span class="panel-count">{open.length} to get</span>
    </button>
  </header>

  <div class="mini-filter">
    <button
      type="button"
      class:active={filter === 'all'}
      onclick={() => (filter = 'all')}
    >All</button>
    {#each shopping.stores as store (store.id)}
      <button
        type="button"
        class:active={filter === store.id}
        onclick={() => (filter = store.id)}
      >{store.name}</button>
    {/each}
  </div>

  {#if visible.length > 0}
    <ul class="mini-list">
      {#each visible as item (item.id)}
        <li>
          <button
            class="mini-check"
            type="button"
            aria-label="Tick {item.name}"
            onclick={() => toggleDone(item.id)}
          ></button>
          <span class="mini-name">{item.name}</span>
          {#if item.store !== 'any'}
            <span class="chip">{storeName(item.store)}</span>
          {/if}
        </li>
      {/each}
    </ul>
    {#if more > 0}
      <button class="more-btn" type="button" onclick={() => go('shopping')}>+{more} more</button>
    {/if}
  {:else if !shopping.loaded}
    <div class="empty small"><span class="empty-title">Loading</span></div>
  {:else}
    <div class="empty small">
      <span class="empty-title">Nothing on the list</span>
      <span class="empty-hint">Tap Shopping to add an item.</span>
    </div>
  {/if}
</section>
