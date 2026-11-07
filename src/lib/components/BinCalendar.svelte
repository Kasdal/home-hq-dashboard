<script>
  import { clock } from '../clock.svelte.js'
  import { bins, confirmBin, confirmedAt } from '../bins.svelte.js'
  import { upcomingPickups, alertWindow, weekdayName } from '../binSchedule.js'
  import { formatLongDate, formatShortDate, relativeDay, ymd, startOfDay } from '../time.js'

  const NAMES = { black: 'Black bin', green: 'Green bin' }

  const pickups = $derived(upcomingPickups(bins.schedule, 4, clock.now))
  const next = $derived(pickups[0] || null)
  const alert = $derived(alertWindow(bins.schedule, clock.now))
  const alertDone = $derived(alert ? confirmedAt(alert.pickup.date) : null)
  const isToday = $derived(next ? next.date === ymd(startOfDay(clock.now)) : false)

  const scheduleEnded = $derived(!next && Boolean(bins.schedule.endDate))
  const allDone = $derived(alertDone ? alertDone.slice(11, 16) : '')
</script>

{#if alert && !alertDone}
  <section class="panel bin-alert" class:bin-alert-black={alert.pickup.bin === 'black'}>
    <header class="panel-head">
      <h2>Bin day</h2>
      <span class="panel-sub">{weekdayName(bins.schedule.weekday)}</span>
    </header>

    <div class="bin-alert-body">
      <span class="bin-alert-dot bin-{alert.pickup.bin}"></span>
      <div class="bin-alert-text">
        <div class="bin-alert-name">{NAMES[alert.pickup.bin]}</div>
        <div class="bin-alert-call">Put it outside</div>
      </div>
    </div>

    <button class="bin-confirm" type="button" onclick={() => confirmBin(alert.pickup.date)}>
      Bin is outside ✓
    </button>
  </section>
{:else if alert && alertDone}
  <section class="panel bin-confirmed">
    <header class="panel-head">
      <h2>Bin day</h2>
      <span class="panel-sub">{weekdayName(bins.schedule.weekday)}</span>
    </header>

    <div class="bin-done">
      <span class="bin-done-check">✓</span>
      <div>
        <div class="bin-done-title">Bin is outside</div>
        <div class="bin-done-sub">Done at {allDone}</div>
      </div>
    </div>
    <div class="bin-done-bin">
      <span class="bin-dot bin-{alert.pickup.bin}"></span>
      <span>{NAMES[alert.pickup.bin]}</span>
    </div>
  </section>
{:else}
  <section class="panel">
    <header class="panel-head">
      <h2>Garbage</h2>
      <span class="panel-sub">Pickup on {weekdayName(bins.schedule.weekday)}</span>
    </header>

    {#if next}
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
    {:else}
      <div class="empty">
        <span class="empty-title">{scheduleEnded ? 'Schedule ended' : 'No pickup scheduled'}</span>
        <span class="empty-hint">
          {scheduleEnded ? 'Add a new end date in /data/bins.json.' : 'Check /data/bins.json.'}
        </span>
      </div>
    {/if}
  </section>
{/if}
