<script>
  import { theme, setThemeMode } from '../theme.svelte.js'
  import { build } from '../version.svelte.js'
  import { weather } from '../weather.svelte.js'

  const options = [
    { id: 'light', label: 'Light' },
    { id: 'auto', label: 'Auto' },
    { id: 'dark', label: 'Dark' },
  ]
</script>

<div class="page settings-page">
  <header class="page-head">
    <div>
      <div class="eyebrow">Display</div>
      <h1 class="page-title">Settings</h1>
    </div>
  </header>

  <section class="settings-card">
    <h2>Theme</h2>
    <div class="seg" role="group" aria-label="Theme">
      {#each options as option (option.id)}
        <button
          type="button"
          class:active={theme.mode === option.id}
          onclick={() => setThemeMode(option.id)}
        >{option.label}</button>
      {/each}
    </div>
    <p class="settings-note">
      Auto follows the device setting and turns dark after sunset.
    </p>
  </section>

  <section class="settings-card">
    <h2>About</h2>
    <dl class="meta">
      <dt>Place</dt>
      <dd>{weather.place || 'Not set'}</dd>
      <dt>Build</dt>
      <dd>{build.version || 'Local development'}</dd>
      <dt>Deployed</dt>
      <dd>{build.built || 'Not available'}</dd>
      <dt>Theme</dt>
      <dd>{theme.resolved}</dd>
    </dl>
  </section>
</div>
