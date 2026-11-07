<script>
  let { code = 0, size = 64 } = $props()

  const group = $derived(
    code === 0 || code === 1
      ? 'sun'
      : code === 2
        ? 'partly'
        : code === 45 || code === 48
          ? 'fog'
          : (code >= 51 && code <= 67) || (code >= 80 && code <= 82)
            ? 'rain'
            : (code >= 71 && code <= 77) || (code >= 85 && code <= 86)
              ? 'snow'
              : code >= 95
                ? 'storm'
                : 'cloud'
  )
</script>

<svg
  class="glyph"
  width={size}
  height={size}
  viewBox="0 0 64 64"
  fill="none"
  stroke-width="2.6"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
  focusable="false"
>
  {#if group === 'sun'}
    <circle class="sun" cx="32" cy="32" r="10.5" />
    {#each [0, 45, 90, 135, 180, 225, 270, 315] as angle}
      <line
        class="sun"
        x1="32"
        y1="12.5"
        x2="32"
        y2="17.5"
        transform="rotate({angle} 32 32)"
      />
    {/each}
  {:else}
    {#if group === 'partly'}
      <circle class="sun" cx="23" cy="23" r="7.5" />
      <line class="sun" x1="23" y1="8" x2="23" y2="12" />
      <line class="sun" x1="8" y1="23" x2="12" y2="23" />
      <line class="sun" x1="12.4" y1="12.4" x2="15.2" y2="15.2" />
    {/if}
    <path class="cloud" d="M20 43h24a9.5 9.5 0 0 0 1-19 13.5 13.5 0 0 0-25.5 2.5A8.5 8.5 0 0 0 20 43z" />
    {#if group === 'rain'}
      <line class="rain" x1="24" y1="49" x2="21" y2="56" />
      <line class="rain" x1="33" y1="49" x2="30" y2="56" />
      <line class="rain" x1="42" y1="49" x2="39" y2="56" />
    {:else if group === 'snow'}
      <circle class="snow" cx="24" cy="53" r="2.2" />
      <circle class="snow" cx="33" cy="55" r="2.2" />
      <circle class="snow" cx="42" cy="53" r="2.2" />
    {:else if group === 'storm'}
      <path class="bolt" d="M33 47l-7 9h6l-3 7 10-11h-6l4-5z" />
    {:else if group === 'fog'}
      <line class="cloud" x1="17" y1="49" x2="47" y2="49" />
      <line class="cloud" x1="22" y1="56" x2="42" y2="56" />
    {/if}
  {/if}
</svg>
