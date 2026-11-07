<script>
  import { clock } from '../clock.svelte.js'
  import { WEEKDAYS, MONTHS } from '../time.js'

  const pad = (n) => String(n).padStart(2, '0')

  const hours = $derived(pad(clock.now.getHours()))
  const minutes = $derived(pad(clock.now.getMinutes()))
  const seconds = $derived(pad(clock.now.getSeconds()))
  const dateLine = $derived(
    `${WEEKDAYS[clock.now.getDay()]}, ${clock.now.getDate()} ${MONTHS[clock.now.getMonth()]}`
  )
</script>

<div class="clock">
  <div class="clock-time">
    {hours}:{minutes}<span class="clock-seconds">:{seconds}</span>
  </div>
  <div class="clock-date">{dateLine}</div>
</div>
