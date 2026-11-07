<script>
  import Masthead from './Masthead.svelte'
  import BinCalendar from './BinCalendar.svelte'
  import CatFeed from './CatFeed.svelte'
  import ShoppingWidget from './ShoppingWidget.svelte'
  import TasksWidget from './TasksWidget.svelte'
  import PhotosWidget from './PhotosWidget.svelte'
  import HomeControls from './HomeControls.svelte'
</script>

<div class="page today-page">
  <Masthead />

  <main class="today-grid">
    <div class="area area-garbage"><BinCalendar /></div>
    <div class="area area-cat"><CatFeed /></div>
    <div class="area area-shopping"><ShoppingWidget /></div>
    <div class="area area-tasks"><TasksWidget /></div>
    <div class="area area-photos"><PhotosWidget /></div>
    <div class="area area-controls"><HomeControls /></div>
  </main>
</div>
