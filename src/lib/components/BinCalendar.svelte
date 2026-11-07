<script>
  import { clock } from '../clock.svelte.js'
  import { upcomingPickups, formatLongDate, formatShortDate, relativeDay, ymd, startOfDay } from '../time.js'

  const NAMES = { black: 'Black bin', green: 'Green bin' }

  const pickups = $derived(upcomingPickups(4, clock.now))
  const next = $derived(pickups[0])
  const isToday = $derived(next.date === ymd(startOfDay(clock.now)))
</script>

<section class="panel">
  <header class="panel-head">
    <h2>Garbage</h2>
    <span class="panel-sub">Pickup on Thursday</span>
  </header>

  <div class="bin-next">
    <span class="bin-dot bin-{next.bin}"></span>
    <div>
      <div class="bin-name">{NAMES[next.bin]}</div>
      <div class="bin-when">
        {#if isToday}Today{:else}{relativeDay(next.date, clock.now)}{/if}
      </div>
    </div>
  </div>

  <div class="bin-date">{formatLongDate(next.date)}</div>

  <ul class="bin-future">
    {#each pickups.slice(1) as pickup}
      <li>
        <span class="bin-dot bin-{pickup.bin}"></span>
        <span class="bin-future-date">{formatShortDate(pickup.date)}</span>
        <span class="bin-future-name">{NAMES[pickup.bin]}</span>
      </li>
    {/each}
  </ul>
</section>
