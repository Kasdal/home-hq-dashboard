<script>
  import NavRail from './lib/components/NavRail.svelte'
  import TodayPage from './lib/components/TodayPage.svelte'
  import ShoppingPage from './lib/components/ShoppingPage.svelte'
  import CookingPage from './lib/components/CookingPage.svelte'
  import PlanPage from './lib/components/PlanPage.svelte'
  import PhotosPage from './lib/components/PhotosPage.svelte'
  import ControlsPage from './lib/components/ControlsPage.svelte'
  import SettingsPage from './lib/components/SettingsPage.svelte'
  import { route } from './lib/route.svelte.js'
  import { idle } from './lib/idle.svelte.js'
  import SleepScreen from './lib/components/SleepScreen.svelte'
</script>

<div class="app">
  <NavRail />
  <div class="stage">
    {#if route.page === 'shopping'}
      <ShoppingPage />
    {:else if route.page === 'cooking'}
      <CookingPage />
    {:else if route.page === 'plan'}
      <PlanPage />
    {:else if route.page === 'photos'}
      <PhotosPage />
    {:else if route.page === 'controls'}
      <ControlsPage />
    {:else if route.page === 'settings'}
      <SettingsPage />
    {:else}
      <TodayPage />
    {/if}
  </div>

  {#if idle.active}
    <SleepScreen />
  {/if}
</div>
