<script>
  import { onMount } from 'svelte'
  import { fetchJson } from '../http.js'

  let items = $state([])
  let state = $state('loading')

  const MAX_ITEMS = 6

  function normalize(raw) {
    const list = Array.isArray(raw) ? raw : raw && Array.isArray(raw.items) ? raw.items : []
    return list
      .map((item) => ({
        text: String(item.text || item.title || ''),
        done: Boolean(item.done),
        list: item.list ? String(item.list) : '',
      }))
      .filter((item) => item.text)
  }

  const visible = $derived(items.slice(0, MAX_ITEMS))
  const hidden = $derived(Math.max(0, items.length - MAX_ITEMS))
  const openCount = $derived(items.filter((item) => !item.done).length)

  async function refresh() {
    try {
      items = normalize(await fetchJson('/data/tasks.json', { timeout: 8000 }))
      state = 'ok'
    } catch {
      state = state === 'ok' ? 'ok' : 'empty'
    }
  }

  onMount(() => {
    refresh()
    const timer = setInterval(refresh, 2 * 60 * 1000)
    return () => clearInterval(timer)
  })
</script>

<div class="task-body">
  {#if visible.length > 0}
    <ul class="task-list">
      {#each visible as item, index (item.text + index)}
        <li class="task" class:done={item.done}>
          <span class="task-box">{item.done ? '✓' : ''}</span>
          <span class="task-text">{item.text}</span>
          {#if item.list}
            <span class="task-list-tag">{item.list}</span>
          {/if}
        </li>
      {/each}
    </ul>
    <div class="task-more">
      {openCount} open{hidden > 0 ? ` · +${hidden} more` : ''}
    </div>
  {:else if state === 'loading'}
    <div class="empty small"><span class="empty-title">Loading tasks</span></div>
  {:else}
    <div class="empty small">
      <span class="empty-title">No tasks</span>
      <span class="empty-hint">Add <code>/data/tasks.json</code> on the NAS.</span>
    </div>
  {/if}
</div>
