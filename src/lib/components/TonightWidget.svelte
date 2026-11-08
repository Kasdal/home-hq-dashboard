<script>
  import { onMount } from 'svelte'
  import { go, openRecipe } from '../route.svelte.js'
  import { cooking, loadRecipes } from '../cooking.svelte.js'
  import {
    plan,
    todayKey,
    dayKey,
    surpriseMe,
    previewMealIngredients,
    clearMeal,
    climateInfo,
  } from '../plan.svelte.js'
  import { addIngredientItems } from '../shopping.svelte.js'
  import IngredientReview from './IngredientReview.svelte'

  let message = $state('')
  let messageTimer = null
  let review = $state(null)

  const today = $derived(todayKey())
  const entry = $derived(plan.days[today] || null)
  const recipe = $derived(
    entry ? cooking.recipes.find((item) => item.id === entry.recipeId) || null : null
  )
  const title = $derived(recipe ? recipe.title : entry ? entry.title : '')
  const climate = $derived(climateInfo())
  const thumbUrl = $derived(
    recipe ? recipe.thumbUrl || (recipe.type === 'image' ? recipe.fileUrl : '') : ''
  )
  const noRecipes = $derived(cooking.loaded && cooking.recipes.length === 0)
  const canSurprise = $derived(cooking.loaded && cooking.recipes.length > 0)
  const unavailable = $derived(Boolean(entry && cooking.loaded && !recipe))

  function typeLetter(item) {
    if (item.type === 'manual') return 'MANUAL'
    if (item.type === 'pdf') return 'PDF'
    if (item.type === 'text') return 'TXT'
    return 'IMG'
  }

  function showMessage(text) {
    message = text
    clearTimeout(messageTimer)
    messageTimer = setTimeout(() => (message = ''), 5000)
  }

  function add() {
    const result = previewMealIngredients(today)
    if (result.error) {
      showMessage(result.error === 'No ingredients' ? 'This recipe has no ingredients.' : result.error)
      return
    }
    if (result.items.length === 0) {
      showMessage('Nothing to add.')
      return
    }
    if (!result.items.some((item) => !item.exists)) {
      showMessage('All ingredients are already on the list.')
      return
    }
    review = { title: result.recipe.title, items: result.items }
  }

  function confirm(items) {
    const source = review ? review.title : ''
    const result = addIngredientItems(items, source)
    review = null
    if (result.added === 0 && result.skipped === 0) {
      showMessage('Nothing to add.')
      return
    }
    if (result.added === 0) {
      showMessage(`${result.skipped} already on the list.`)
      return
    }
    showMessage(
      result.skipped
        ? `${result.added} added · ${result.skipped} already listed.`
        : `${result.added} ingredients added to shopping.`
    )
  }

  function surprise() {
    if (!cooking.loaded) {
      showMessage('Loading recipes.')
      return
    }
    if (cooking.recipes.length === 0) {
      showMessage('Add a recipe first.')
      return
    }
    const result = surpriseMe(today, {
      avoidIds: [plan.days[dayKey(-1)] ? plan.days[dayKey(-1)].recipeId : ''],
    })
    if (!result.ok) {
      showMessage(result.error || 'Could not pick a recipe.')
      return
    }
    showMessage(`${result.label}: ${result.recipe.title}`)
  }

  function clear() {
    clearMeal(today)
    showMessage('Tonight is clear.')
  }

  onMount(() => {
    loadRecipes()
    const timer = setInterval(loadRecipes, 5 * 60 * 1000)
    return () => {
      clearInterval(timer)
      clearTimeout(messageTimer)
    }
  })
</script>

<div class="tonight">
  {#if entry}
    <div class="tonight-top">
      {#if recipe}
        <button
          class="tonight-thumb"
          type="button"
          aria-label="Open {title}"
          onclick={() => openRecipe(recipe.id)}
        >
          {#if thumbUrl}
            <img src={thumbUrl} alt="" draggable="false" />
          {:else}
            <span class="tonight-letter">{typeLetter(recipe)}</span>
          {/if}
        </button>
      {:else}
        <div class="tonight-thumb">
          <span class="tonight-letter">{unavailable ? '?' : '…'}</span>
        </div>
      {/if}

      <div class="tonight-info">
        <div class="tonight-eyebrow">{climate.label} · Tonight</div>
        {#if recipe}
          <button class="tonight-title" type="button" onclick={() => openRecipe(recipe.id)}>
            {title}
          </button>
          <div class="tonight-meta">
            {recipe.tags.length > 0
              ? recipe.tags.join(' · ')
              : `${recipe.ingredients.length} ingredients`}
          </div>
        {:else}
          <div class="tonight-title">{title || (unavailable ? 'Recipe removed' : 'Loading')}</div>
          <div class="tonight-meta">
            {unavailable ? 'Recipe removed from the library' : 'Loading the recipe'}
          </div>
        {/if}
        <div class="tonight-hint">
          {message ||
            (unavailable
              ? 'This recipe is no longer in the library.'
              : noRecipes
                ? 'Add a recipe on the Cooking page.'
                : climate.hint)}
        </div>
      </div>
    </div>

    <div class="tonight-actions">
      {#if recipe}
        <button class="tonight-btn primary" type="button" onclick={add}>Add ingredients</button>
      {/if}
      <button class="tonight-btn" type="button" onclick={surprise} disabled={!canSurprise}>
        Surprise me
      </button>
      {#if unavailable}
        <button class="tonight-btn" type="button" onclick={() => go('plan')}>Plan week</button>
        <button class="tonight-btn" type="button" onclick={clear}>Clear</button>
      {/if}
    </div>
  {:else}
    <div class="tonight-empty">
      <div>
        <div class="tonight-eyebrow">{climate.label} · Tonight</div>
        <div class="tonight-empty-title">No meal planned</div>
        <div class="tonight-hint">
          {message || (noRecipes ? 'Add a recipe on the Cooking page.' : climate.hint)}
        </div>
      </div>
      <div class="tonight-actions">
        <button class="tonight-btn primary" type="button" onclick={surprise} disabled={!canSurprise}>
          Surprise me
        </button>
        <button class="tonight-btn" type="button" onclick={() => go('plan')}>Plan week</button>
      </div>
    </div>
  {/if}
</div>

{#if review}
  <IngredientReview
    title={review.title}
    items={review.items}
    onclose={() => (review = null)}
    onconfirm={confirm}
  />
{/if}
