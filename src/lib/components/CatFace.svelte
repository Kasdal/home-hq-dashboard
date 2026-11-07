<script>
  let { happy = false, size = 118 } = $props()
</script>

<svg
  class="cat-face"
  width={size}
  height={size}
  viewBox="0 0 120 120"
  aria-hidden="true"
  focusable="false"
>
  <!-- ears -->
  <path d="M27 45 L22 12 L50 29 Z" fill="#c8873d" />
  <path d="M93 45 L98 12 L70 29 Z" fill="#c8873d" />
  <path d="M31 42 L28 21 L45 32 Z" fill="#e8a9a0" />
  <path d="M89 42 L92 21 L75 32 Z" fill="#e8a9a0" />

  <!-- head -->
  <ellipse cx="60" cy="66" rx="38" ry="34" fill="#d99a4e" />

  <!-- tabby stripes -->
  <path d="M50 36 q5 7 1 12" stroke="#b8792f" stroke-width="4" fill="none" stroke-linecap="round" />
  <path d="M60 34 q0 8 0 13" stroke="#b8792f" stroke-width="4" fill="none" stroke-linecap="round" />
  <path d="M70 36 q-5 7 -1 12" stroke="#b8792f" stroke-width="4" fill="none" stroke-linecap="round" />
  <path d="M24 66 q6 1 8 5" stroke="#b8792f" stroke-width="3.4" fill="none" stroke-linecap="round" />
  <path d="M96 66 q-6 1 -8 5" stroke="#b8792f" stroke-width="3.4" fill="none" stroke-linecap="round" />

  <!-- muzzle -->
  <ellipse cx="60" cy="81" rx="18" ry="12" fill="#f0c890" />

  {#if happy}
    <!-- happy closed eyes -->
    <path d="M43 64 q7 -9 14 0" stroke="#3b2a1a" stroke-width="4.2" fill="none" stroke-linecap="round" />
    <path d="M63 64 q7 -9 14 0" stroke="#3b2a1a" stroke-width="4.2" fill="none" stroke-linecap="round" />
    <!-- nose -->
    <path d="M56 74 h8 l-4 5 z" fill="#e88f96" />
    <!-- smiling mouth -->
    <path d="M60 79 q-7 8 -13 2" stroke="#3b2a1a" stroke-width="3" fill="none" stroke-linecap="round" />
    <path d="M60 79 q7 8 13 2" stroke="#3b2a1a" stroke-width="3" fill="none" stroke-linecap="round" />
  {:else}
    <!-- waiting eyes -->
    <circle cx="49" cy="63" r="5.4" fill="#3b2a1a" />
    <circle cx="71" cy="63" r="5.4" fill="#3b2a1a" />
    <circle cx="50.6" cy="61.4" r="1.8" fill="#fff8ec" />
    <circle cx="72.6" cy="61.4" r="1.8" fill="#fff8ec" />
    <!-- nose -->
    <path d="M56 74 h8 l-4 5 z" fill="#e88f96" />
    <!-- small mouth -->
    <path d="M60 79 q0 5 -5 5" stroke="#3b2a1a" stroke-width="3" fill="none" stroke-linecap="round" />
    <path d="M60 79 q0 5 5 5" stroke="#3b2a1a" stroke-width="3" fill="none" stroke-linecap="round" />
  {/if}

  <!-- whiskers -->
  <path d="M34 77 l-14 -3 M34 84 l-15 2" stroke="#8a6a44" stroke-width="2" stroke-linecap="round" />
  <path d="M86 77 l14 -3 M86 84 l15 2" stroke="#8a6a44" stroke-width="2" stroke-linecap="round" />
</svg>
