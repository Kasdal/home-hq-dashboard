<script>
  import { onMount } from 'svelte'
  import { clock } from '../clock.svelte.js'
  import {
    ymd,
    parseYmd,
    formatLongDate,
    formatShortDate,
    WEEKDAYS,
  } from '../time.js'
  import { go } from '../route.svelte.js'
  import {
    plan,
    setMeal,
    clearMeal,
    surpriseMe,
    addMealIngredients,
    climateInfo,
  } from '../plan.svelte.js'
  import { planDates } from '../mealPlan.js'
  import { cooking, startCooking, stopCooking } from '../cooking.svelte.js'

  let selected = $state(ymd(clock.now))
  let query = $state('')
  let toast = $state('')
  let toastTimer = null

  const today = $derived(ymd(clock.now))
  const days = $derived(planDates(parseYmd(today), 7))
  const selectedEntry = $derived(plan.days[selected] || null)
  const selectedRecipe = $derived(
    selectedEntry
      ? cooking.recipes.find((recipe) => recipe.id === selectedEntry.recipeId) || null
      : null
  )
  const plannedCount = $derived(days.filter((day) => plan.days[day.key]).length)
  const climate = $derived(climateInfo())
  const filtered = $derived.by(() => {
    const text = query.trim().toLowerCase()
    if (!text) return cooking.recipes
    return cooking.recipes.filter((recipe) => recipe.search.includes(text))
  })

  onMount(() => {
    startCooking()
    return () => {
      stopCooking()
      clearTimeout(toastTimer)
    }
  })

  function showToast(message) {
    toast = message
    clearTimeout(toastTimer)
    toastTimer = setTimeout(() => (toast = ''), 5000)
  }

  function dayLabel(day) {
    if (day.offset === 0) return 'Today'
    if (day.offset === 1) return 'Tomorrow'
    return WEEKDAYS[day.date.getDay()].slice(0, 3)
  }

  function typeLetter(recipe) {
    if (recipe.type === 'manual') return 'MANUAL'
    if (recipe.type === 'pdf') return 'PDF'
    if (recipe.type === 'text') return 'TXT'
    return 'IMG'
  }

  function isPlanned(recipe) {
    return Boolean(selectedEntry && selectedEntry.recipeId === recipe.id)
  }

  function previousRecipeId(key) {
    const date = parseYmd(key)
    date.setDate(date.getDate() - 1)
    const entry = plan.days[ymd(date)]
    return entry ? entry.recipeId : ''
  }

  function choose(recipe) {
    setMeal(selected, recipe)
    showToast(`${recipe.title} planned for ${formatLongDate(selected)}.`)
  }

  function surprise(key = selected) {
    if (!cooking.loaded) {
      showToast('Loading recipes.')
      return
    }
    if (cooking.recipes.length === 0) {
      showToast('Add a recipe on the Cooking page first.')
      return
    }
    const result = surpriseMe(key, { avoidIds: [previousRecipeId(key)] })
    if (!result.ok) {
      showToast(result.error || 'Could not pick a recipe.')
      return
    }
    selected = key
    showToast(`${result.label}: ${result.recipe.title} for ${formatLongDate(key)}.`)
  }

  function clear(key) {
    clearMeal(key)
    showToast('Meal cleared.')
  }

  function add(key = selected) {
    const result = addMealIngredients(key)
    if (result.error) {
      showToast(result.error === 'No ingredients' ? 'This recipe has no ingredients.' : result.error)
      return
    }
    if (result.added === 0 && result.skipped === 0) {
      showToast('Nothing to add.')
      return
    }
    if (result.added === 0) {
      showToast(`${result.skipped} ingredients are already on the shopping list.`)
      return
    }
    showToast(
      result.skipped
        ? `${result.added} ingredients added · ${result.skipped} already listed.`
        : `${result.added} ingredients added to the shopping list.`
    )
  }
</script>

<div class="page plan-page">
  <header class="plan-head">
    <div>
      <div class="eyebrow">Kitchen</div>
      <div class="plan-title">
        <h1>Meal plan</h1>
        <span class="plan-count"><b>{plannedCount}</b> of 7 planned</span>
        {#if plan.error === 'offline'}<span class="plan-offline">Offline</span>{/if}
      </div>
    </div>
    <div class="plan-head-actions">
      <button class="cook-paste" type="button" onclick={() => go('cooking')}>Recipes</button>
      <button
        class="cook-add"
        type="button"
        onclick={() => surprise(selected)}
        disabled={!cooking.loaded || cooking.recipes.length === 0}
      >Surprise me</button>
    </div>
  </header>

  <div class="plan-body">
    <section class="plan-day-list" aria-label="Next seven days">
      {#each days as day (day.key)}
        {@const entry = plan.days[day.key]}
        {@const recipe = entry
          ? cooking.recipes.find((item) => item.id === entry.recipeId) || null
          : null}
        {@const title = recipe ? recipe.title : entry ? entry.title : ''}
        {@const thumb = recipe
          ? recipe.thumbUrl || (recipe.type === 'image' ? recipe.fileUrl : '')
          : ''}
        <div
          class="plan-day"
          class:active={selected === day.key}
          class:today={day.key === today}
        >
          <button class="plan-day-pick" type="button" onclick={() => (selected = day.key)}>
            <span class="plan-day-date">
              <b>{dayLabel(day)}</b>
              <span>{formatShortDate(day.key)}</span>
            </span>
            <span class="plan-day-thumb">
              {#if thumb}
                <img src={thumb} alt="" draggable="false" />
              {:else}
                <span class="plan-day-letter">
                  {recipe ? typeLetter(recipe) : entry ? (cooking.loaded ? '?' : '…') : '—'}
                </span>
              {/if}
            </span>
            <span class="plan-day-info">
              <span class="plan-day-title">{title || 'No meal'}</span>
              <span class="plan-day-meta">
                {recipe
                  ? `${recipe.ingredients.length} ingredients`
                  : entry
                    ? cooking.loaded
                      ? 'Recipe removed'
                      : 'Loading recipe'
                    : 'Tap to choose'}
              </span>
            </span>
          </button>

          <div class="plan-day-actions">
            <button
              class="plan-day-btn"
              type="button"
              aria-label="Surprise me for {dayLabel(day)}"
              onclick={() => surprise(day.key)}
              disabled={!cooking.loaded || cooking.recipes.length === 0}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <rect x="4" y="4" width="16" height="16" rx="3" />
                <circle cx="9" cy="9" r="1" />
                <circle cx="15" cy="9" r="1" />
                <circle cx="9" cy="15" r="1" />
                <circle cx="15" cy="15" r="1" />
                <circle cx="12" cy="12" r="1" />
              </svg>
            </button>
            {#if entry}
              <button
                class="plan-day-btn"
                type="button"
                aria-label="Clear {dayLabel(day)}"
                onclick={() => clear(day.key)}
              >×</button>
            {/if}
          </div>
        </div>
      {/each}
    </section>

    <section class="plan-picker">
      <header class="plan-picker-head">
        <div>
          <div class="eyebrow">Choose a recipe</div>
          <h2>{formatLongDate(selected)}</h2>
          <div class="plan-climate">{climate.label} · {climate.hint}</div>
        </div>
        <div class="plan-picker-actions">
          {#if selectedRecipe}
            <button class="cook-secondary" type="button" onclick={() => add(selected)}>
              Add ingredients
            </button>
          {/if}
          <button
            class="cook-paste"
            type="button"
            onclick={() => surprise(selected)}
            disabled={!cooking.loaded || cooking.recipes.length === 0}
          >Surprise me</button>
        </div>
      </header>

      <div class="cook-search plan-search">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="10.5" cy="10.5" r="6.5" />
          <path d="M15.4 15.4 21 21" />
        </svg>
        <input
          bind:value={query}
          placeholder="Search recipes"
          aria-label="Search recipes"
          autocomplete="off"
          spellcheck="false"
        />
        {#if query}
          <button class="cook-clear" type="button" aria-label="Clear search" onclick={() => (query = '')}>×</button>
        {/if}
      </div>

      <div class="plan-recipes">
        {#if !cooking.loaded}
          <div class="empty small"><span class="empty-title">Loading recipes</span></div>
        {:else if filtered.length === 0}
          <div class="empty small">
            <span class="empty-title">
              {cooking.recipes.length > 0 ? 'No recipes match' : 'No recipes yet'}
            </span>
            <span class="empty-hint">
              {cooking.recipes.length > 0
                ? 'Try another search.'
                : 'Add recipes on the Cooking page.'}
            </span>
          </div>
        {:else}
          {#each filtered as recipe (recipe.id)}
            <button
              class="plan-recipe"
              class:active={isPlanned(recipe)}
              type="button"
              onclick={() => choose(recipe)}
            >
              <span class="plan-recipe-thumb">
                {#if recipe.thumbUrl}
                  <img src={recipe.thumbUrl} alt="" loading="lazy" draggable="false" />
                {:else if recipe.type === 'image' && recipe.fileUrl}
                  <img src={recipe.fileUrl} alt="" loading="lazy" draggable="false" />
                {:else}
                  <span class="plan-recipe-letter">{typeLetter(recipe)}</span>
                {/if}
              </span>
              <span class="plan-recipe-body">
                <span class="plan-recipe-title">{recipe.title}</span>
                <span class="plan-recipe-meta">
                  {recipe.tags.length > 0
                    ? recipe.tags.join(' · ')
                    : `${recipe.ingredients.length} ingredients`}
                </span>
              </span>
              <span class="plan-recipe-use">{isPlanned(recipe) ? 'Planned' : 'Use'}</span>
            </button>
          {/each}
        {/if}
      </div>
    </section>
  </div>

  {#if toast}
    <div class="toast"><span>{toast}</span></div>
  {/if}
</div>
