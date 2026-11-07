<script>
  import {
    shopping,
    addItem,
    toggleDone,
    setQty,
    removeItem,
    restoreItem,
    restoreMany,
    setStore,
    setNote,
    clearDone,
    storeCount,
    openItems,
  } from '../shopping.svelte.js'
  import { CATEGORIES } from '../categories.js'

  let filter = $state('all')
  let draft = $state('')
  let justAdded = $state(null)
  let toast = $state(null)
  let toastTimer = null

  let pressTimer = null
  let pressX = 0
  let pressY = 0

  const openAll = $derived(openItems())
  const added = $derived(justAdded ? shopping.items.find((item) => item.id === justAdded) : null)

  const groups = $derived.by(() => {
    const list = shopping.items.filter(
      (item) => filter === 'all' || item.store === 'any' || item.store === filter
    )
    return CATEGORIES.map((category) => {
      const items = list
        .filter((item) => item.category === category)
        .sort((a, b) => Number(a.done) - Number(b.done))
      return { category, items, open: items.filter((item) => !item.done).length }
    }).filter((group) => group.items.length > 0)
  })

  const doneCount = $derived(shopping.items.filter((item) => item.done).length)

  function storeName(id) {
    const store = shopping.stores.find((item) => item.id === id)
    return store ? store.name : id
  }

  function showToast(message, undo) {
    toast = { message, undo }
    clearTimeout(toastTimer)
    toastTimer = setTimeout(() => (toast = null), 6000)
  }

  function undoToast() {
    if (toast && toast.undo) toast.undo()
    toast = null
  }

  function removeWithUndo(item) {
    const removed = removeItem(item.id)
    if (removed) showToast(`${item.name} removed`, () => restoreItem(removed))
  }

  function step(item, delta) {
    const next = item.qty + delta
    if (next <= 0) {
      removeWithUndo(item)
    } else {
      setQty(item.id, next)
    }
  }

  function submitAdd(event) {
    event.preventDefault()
    const id = addItem(draft)
    if (!id) return
    draft = ''
    justAdded = id
  }

  function useUsual(usual) {
    const existing = shopping.items.find(
      (item) => !item.done && item.name.toLowerCase() === usual.name.toLowerCase()
    )
    if (existing) {
      setQty(existing.id, existing.qty + 1)
    } else {
      justAdded = addItem(usual.name, { category: usual.category })
    }
  }

  function clearTicked() {
    const removed = clearDone()
    if (removed.length > 0) {
      showToast(`${removed.length} ticked removed`, () => restoreMany(removed))
    }
  }

  function pointerDown(event, item) {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    pressX = event.clientX
    pressY = event.clientY
    clearTimeout(pressTimer)
    pressTimer = setTimeout(() => {
      pressTimer = null
      removeWithUndo(item)
    }, 650)
  }

  function pointerMove(event) {
    if (!pressTimer) return
    if (Math.abs(event.clientX - pressX) > 10 || Math.abs(event.clientY - pressY) > 10) {
      clearTimeout(pressTimer)
      pressTimer = null
    }
  }

  function pointerUp(event, item) {
    clearTimeout(pressTimer)
    pressTimer = null
    if (event.clientX - pressX < -60 && Math.abs(event.clientY - pressY) < 45) {
      removeWithUndo(item)
    }
  }

  function pointerCancel() {
    clearTimeout(pressTimer)
    pressTimer = null
  }
</script>

<div class="page shop-page">
  <header class="shop-head">
    <div>
      <div class="eyebrow">Shared list</div>
      <div class="shop-title">
        <h1>Groceries</h1>
        <span class="shop-count"><b>{openAll.length}</b> to get</span>
      </div>
    </div>

    <div class="filter" role="group" aria-label="Filter by store">
      <button type="button" class:active={filter === 'all'} onclick={() => (filter = 'all')}>
        All <span>{openAll.length}</span>
      </button>
      {#each shopping.stores as store (store.id)}
        <button
          type="button"
          class:active={filter === store.id}
          onclick={() => (filter = store.id)}
        >
          {store.name} <span>{storeCount(store.id)}</span>
        </button>
      {/each}
    </div>
  </header>

  <div class="shop-body">
    <section class="list-card">
      {#if groups.length > 0}
        {#each groups as group (group.category)}
          <section class="cat">
            <header class="cat-head">
              <h2>{group.category}</h2>
              <span>{group.open}</span>
            </header>

            {#each group.items as item (item.id)}
              <div class="shop-row" class:done={item.done}>
                <button
                  class="tick"
                  type="button"
                  aria-label={item.done ? `Untick ${item.name}` : `Tick ${item.name}`}
                  onclick={() => toggleDone(item.id)}
                >
                  {#if item.done}✓{/if}
                </button>

                <div
                  class="row-main"
                  role="group"
                  onpointerdown={(event) => pointerDown(event, item)}
                  onpointermove={pointerMove}
                  onpointerup={(event) => pointerUp(event, item)}
                  onpointercancel={pointerCancel}
                >
                  <div class="row-name">{item.name}</div>
                  {#if item.note}
                    <div class="row-note">{item.note}</div>
                  {/if}
                </div>

                {#if item.store !== 'any' && filter === 'all'}
                  <span class="chip">{storeName(item.store)}</span>
                {/if}

                <div class="qty">
                  <button type="button" aria-label="Less {item.name}" onclick={() => step(item, -1)}>−</button>
                  <span>{item.qty}</span>
                  <button type="button" aria-label="More {item.name}" onclick={() => step(item, 1)}>+</button>
                </div>
              </div>
            {/each}
          </section>
        {/each}

        <div class="list-foot">
          <button class="text-btn" type="button" disabled={doneCount === 0} onclick={clearTicked}>
            Clear ticked{doneCount > 0 ? ` (${doneCount})` : ''}
          </button>
        </div>
      {:else if !shopping.loaded}
        <div class="empty"><span class="empty-title">Loading the list</span></div>
      {:else}
        <div class="empty">
          <span class="empty-title">Nothing on the list</span>
          <span class="empty-hint">Add an item on the right. It appears here at once.</span>
        </div>
      {/if}
    </section>

    <aside class="shop-side">
      <form class="add-card" onsubmit={submitAdd}>
        <input
          class="add-input"
          bind:value={draft}
          placeholder="+ Add an item…"
          aria-label="Add an item"
          autocomplete="off"
        />

        {#if added}
          <div class="add-editor">
            <div class="add-editor-name">{added.name}</div>
            <div class="store-picks">
              <button type="button" class:active={added.store === 'any'} onclick={() => setStore(added.id, 'any')}>Any</button>
              {#each shopping.stores as store (store.id)}
                <button
                  type="button"
                  class:active={added.store === store.id}
                  onclick={() => setStore(added.id, store.id)}
                >{store.name}</button>
              {/each}
            </div>
            <input
              class="note-input"
              value={added.note}
              placeholder="Note (optional)"
              oninput={(event) => setNote(added.id, event.currentTarget.value)}
            />
          </div>
        {/if}
      </form>

      {#if shopping.usuals.length > 0}
        <div class="usuals-head">Usuals · tap to add</div>
        <div class="usuals">
          {#each shopping.usuals as usual (usual.name)}
            {@const onList = shopping.items.find(
              (item) => !item.done && item.name.toLowerCase() === usual.name.toLowerCase()
            )}
            <button
              class="usual"
              class:on={Boolean(onList)}
              type="button"
              onclick={() => useUsual(usual)}
            >
              {#if onList}
                <span class="usual-top">✓</span>
                <span class="usual-name">{usual.name}</span>
                <span class="usual-meta">On list{onList.qty > 1 ? ` ×${onList.qty}` : ''}</span>
              {:else}
                <span class="usual-name">{usual.name}</span>
                <span class="usual-meta">{usual.category}</span>
              {/if}
            </button>
          {/each}
        </div>
      {/if}
    </aside>
  </div>

  {#if toast}
    <div class="toast">
      <span>{toast.message}</span>
      {#if toast.undo}
        <button type="button" onclick={undoToast}>Undo</button>
      {/if}
    </div>
  {/if}
</div>
