<script>
  import { clock } from '../clock.svelte.js'
  import { route, go } from '../route.svelte.js'
  import { formatTime } from '../time.js'

  const items = [
    { id: 'today', label: 'Today' },
    { id: 'shopping', label: 'Shopping' },
    { id: 'cooking', label: 'Cooking' },
    { id: 'photos', label: 'Photos' },
    { id: 'controls', label: 'Controls' },
    { id: 'settings', label: 'Settings' },
  ]
</script>

<aside class="rail">
  <div class="rail-mark">HQ</div>

  <nav class="rail-nav">
    {#each items as item (item.id)}
      <button
        class="rail-item"
        class:active={route.page === item.id}
        type="button"
        aria-current={route.page === item.id ? 'page' : undefined}
        onclick={() => go(item.id)}
      >
        <span class="rail-icon">
          {#if item.id === 'today'}
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 11l8-6.5 8 6.5" />
              <path d="M6.5 10v9h11v-9" />
            </svg>
          {:else if item.id === 'shopping'}
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M5 8h14l-1.2 12H6.2L5 8z" />
              <path d="M9 8V6a3 3 0 0 1 6 0v2" />
            </svg>
          {:else if item.id === 'cooking'}
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M7.2 10.2a3.1 3.1 0 0 1-1.1-6 4 4 0 0 1 7.6-1.1 3.6 3.6 0 0 1 4.2 5.2 3.1 3.1 0 0 1-1.1 5.9" />
              <path d="M7.2 10.2V19h9.6v-8.8" />
              <path d="M7.2 15h9.6" />
            </svg>
          {:else if item.id === 'photos'}
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <rect x="3.5" y="5" width="17" height="14" rx="2" />
              <circle cx="9" cy="10" r="1.8" />
              <path d="M4.5 16.5l4.5-4 3.5 3 2.8-2.5 4.2 4" />
            </svg>
          {:else if item.id === 'controls'}
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 7h7M15 7h5M4 17h3M11 17h9" />
              <circle cx="13" cy="7" r="2" />
              <circle cx="9" cy="17" r="2" />
            </svg>
          {:else}
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="3.2" />
              <path d="M12 3.6v2.2M12 18.2v2.2M3.6 12h2.2M18.2 12h2.2M6.1 6.1l1.6 1.6M16.3 16.3l1.6 1.6M17.9 6.1l-1.6 1.6M7.7 16.3l-1.6 1.6" />
            </svg>
          {/if}
        </span>
        <span class="rail-label">{item.label}</span>
      </button>
    {/each}
  </nav>

  <div class="rail-clock">
    <span>{formatTime(clock.now)}</span>
  </div>
</aside>
