<script>
  let { code = 0, size = 44 } = $props()

  const group = $derived(
    code === 0 || code === 1
      ? 'sun'
      : code === 2
        ? 'partly'
        : code === 45 || code === 48
          ? 'fog'
          : code >= 51 && code <= 67
            ? 'rain'
            : code >= 71 && code <= 77
              ? 'snow'
              : code >= 80 && code <= 82
                ? 'rain'
                : code >= 85 && code <= 86
                  ? 'snow'
                  : code >= 95
                    ? 'storm'
                    : 'cloud'
  )
</script>

<svg
  class="wx-icon wx-{group}"
  width={size}
  height={size}
  viewBox="0 0 64 64"
  aria-hidden="true"
  focusable="false"
>
  {#if group === 'sun'}
    <circle cx="32" cy="32" r="11" fill="#f5c451" />
    {#each [0, 45, 90, 135, 180, 225, 270, 315] as angle}
      <line
        x1="32"
        y1="12"
        x2="32"
        y2="17"
        stroke="#f5c451"
        stroke-width="3.5"
        stroke-linecap="round"
        transform="rotate({angle} 32 32)"
      />
    {/each}
  {:else}
    {#if group === 'partly'}
      <circle cx="24" cy="24" r="9" fill="#f5c451" />
      <line x1="24" y1="9" x2="24" y2="13" stroke="#f5c451" stroke-width="3" stroke-linecap="round" />
      <line x1="9" y1="24" x2="13" y2="24" stroke="#f5c451" stroke-width="3" stroke-linecap="round" />
      <line x1="13" y1="13" x2="16" y2="16" stroke="#f5c451" stroke-width="3" stroke-linecap="round" />
    {/if}
    <path
      d="M20 44h24a10 10 0 0 0 1-20 14 14 0 0 0-26 4 8 8 0 0 0 1 16z"
      fill="#c8d4de"
    />
    {#if group === 'rain'}
      <line x1="24" y1="48" x2="21" y2="56" stroke="#6fb3e0" stroke-width="3.5" stroke-linecap="round" />
      <line x1="33" y1="48" x2="30" y2="56" stroke="#6fb3e0" stroke-width="3.5" stroke-linecap="round" />
      <line x1="42" y1="48" x2="39" y2="56" stroke="#6fb3e0" stroke-width="3.5" stroke-linecap="round" />
    {:else if group === 'snow'}
      <circle cx="24" cy="53" r="2.6" fill="#e6f1f8" />
      <circle cx="33" cy="55" r="2.6" fill="#e6f1f8" />
      <circle cx="42" cy="53" r="2.6" fill="#e6f1f8" />
    {:else if group === 'storm'}
      <path d="M33 46l-7 10h6l-3 8 10-12h-6l4-6z" fill="#f5c451" />
    {:else if group === 'fog'}
      <line x1="16" y1="48" x2="48" y2="48" stroke="#c8d4de" stroke-width="3.5" stroke-linecap="round" />
      <line x1="20" y1="55" x2="44" y2="55" stroke="#c8d4de" stroke-width="3.5" stroke-linecap="round" />
    {/if}
  {/if}
</svg>
