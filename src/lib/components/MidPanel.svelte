<script>
  import { go } from '../route.svelte.js'
  import TasksWidget from './TasksWidget.svelte'
  import TonightWidget from './TonightWidget.svelte'

  let tab = $state('tonight')
</script>

<section class="panel mid-panel">
  <header class="panel-head mid-head">
    <div class="mid-tabs" role="group" aria-label="Today panel">
      <button
        type="button"
        class:active={tab === 'tonight'}
        aria-pressed={tab === 'tonight'}
        onclick={() => (tab = 'tonight')}
      >Tonight</button>
      <button
        type="button"
        class:active={tab === 'tasks'}
        aria-pressed={tab === 'tasks'}
        onclick={() => (tab = 'tasks')}
      >Tasks</button>
    </div>
    {#if tab === 'tonight'}
      <button class="mid-link" type="button" onclick={() => go('plan')}>Meal plan</button>
    {:else}
      <span class="panel-sub">From tasks.json</span>
    {/if}
  </header>

  <div class="mid-body">
    {#if tab === 'tonight'}
      <TonightWidget />
    {:else}
      <TasksWidget />
    {/if}
  </div>
</section>
