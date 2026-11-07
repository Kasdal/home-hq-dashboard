<script>
  import Clock from './lib/components/Clock.svelte'
  import Weather from './lib/components/Weather.svelte'
  import BinCalendar from './lib/components/BinCalendar.svelte'
  import CatFeed from './lib/components/CatFeed.svelte'
  import CalendarWidget from './lib/components/CalendarWidget.svelte'
  import TasksWidget from './lib/components/TasksWidget.svelte'
  import PhotosWidget from './lib/components/PhotosWidget.svelte'
  import HomeControls from './lib/components/HomeControls.svelte'
  import { build } from './lib/version.svelte.js'
</script>

<div class="shell">
  <header class="topbar">
    <Clock />
    <Weather />
    {#if build.version}
      <span class="build-tag" title="Deployed build">{build.version}</span>
    {/if}
  </header>

  <main class="grid">
    <div class="area area-garbage"><BinCalendar /></div>
    <div class="area area-cat"><CatFeed /></div>
    <div class="area area-calendar"><CalendarWidget /></div>
    <div class="area area-tasks"><TasksWidget /></div>
    <div class="area area-photos"><PhotosWidget /></div>
    <div class="area area-controls"><HomeControls /></div>
  </main>
</div>
