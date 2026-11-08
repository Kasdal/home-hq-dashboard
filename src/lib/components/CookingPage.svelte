<script>
  import { onMount } from 'svelte'
  import { route, openRecipe } from '../route.svelte.js'
  import {
    cooking,
    startCooking,
    stopCooking,
    filteredRecipes,
    setQuery,
    addUpload,
    removeUpload,
    uploadRecipe,
  } from '../cooking.svelte.js'
  import RecipeView from './RecipeView.svelte'

  let searchText = $state(cooking.query)
  let searchTimer = null
  let queueTimer = null
  let fileInput = null
  let dragDepth = 0
  let dragging = $state(false)

  const filtered = $derived(filteredRecipes())
  const countLabel = $derived(cooking.recipes.length === 1 ? 'recipe' : 'recipes')
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

  onMount(() => {
    startCooking()
    searchText = cooking.query
    return () => {
      stopCooking()
      clearTimeout(searchTimer)
      clearTimeout(queueTimer)
    }
  })

  function queueSearch() {
    clearTimeout(searchTimer)
    searchTimer = setTimeout(() => setQuery(searchText), 150)
  }

  function clearSearch() {
    searchText = ''
    setQuery('')
  }

  function pickFiles() {
    if (fileInput) fileInput.click()
  }

  function onFileInput(event) {
    const files = Array.from(event.currentTarget.files || [])
    event.currentTarget.value = ''
    handleFiles(files)
  }

  function onDragEnter(event) {
    event.preventDefault()
    const types = event.dataTransfer ? Array.from(event.dataTransfer.types || []) : []
    if (!types.includes('Files')) return
    dragDepth += 1
    dragging = true
  }

  function onDragOver(event) {
    event.preventDefault()
  }

  function onDragLeave(event) {
    event.preventDefault()
    dragDepth -= 1
    if (dragDepth <= 0) {
      dragDepth = 0
      dragging = false
    }
  }

  function onDrop(event) {
    event.preventDefault()
    dragDepth = 0
    dragging = false
    const files = event.dataTransfer ? Array.from(event.dataTransfer.files || []) : []
    handleFiles(files)
  }

  async function handleFiles(files) {
    if (!files.length) return
    clearSearch()

    const batch = files.map((file) => ({ file, row: addUpload(file) }))
    for (const item of batch) {
      item.row.status = 'uploading'
      const result = await uploadRecipe(item.file, (percent) => {
        item.row.progress = percent
      })
      if (result.ok) {
        item.row.status = 'done'
        item.row.progress = 100
        item.row.recipeId = result.recipe.id
      } else {
        item.row.status = 'failed'
        item.row.error = result.error || 'Upload failed'
      }
    }

    clearTimeout(queueTimer)
    queueTimer = setTimeout(() => {
      for (const row of [...cooking.uploads]) {
        if (row.status === 'done') removeUpload(row.id)
      }
    }, 4000)
  }

  function shortDate(value) {
    if (!value) return 'unknown'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value.slice(0, 10)
    return date.getDate() + ' ' + months[date.getMonth()] + ' ' + date.getFullYear()
  }

  function meta(recipe) {
    const kind = recipe.type === 'pdf' ? 'PDF' : recipe.type === 'text' ? 'Text' : 'Image'
    return kind + ' · Added ' + shortDate(recipe.addedAt)
  }
</script>

<svelte:window ondragover={(event) => event.preventDefault()} ondrop={(event) => event.preventDefault()} />

<div
  class="page cook-page"
  role="region"
  aria-label="Cooking"
  ondragenter={onDragEnter}
  ondragover={onDragOver}
  ondragleave={onDragLeave}
  ondrop={onDrop}
>
  <header class="cook-head">
    <div>
      <div class="eyebrow">Recipes</div>
      <div class="cook-title">
        <h1>Cooking</h1>
        <span class="cook-count"><b>{cooking.recipes.length}</b> {countLabel}</span>
      </div>
    </div>
    <button class="cook-add" type="button" onclick={pickFiles}>+ Add recipe</button>
  </header>

  <div class="cook-search">
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M15.4 15.4 21 21" />
    </svg>
    <input
      bind:value={searchText}
      oninput={queueSearch}
      placeholder="Search recipes"
      aria-label="Search recipes"
      autocomplete="off"
      spellcheck="false"
    />
    {#if searchText}
      <button class="cook-clear" type="button" aria-label="Clear search" onclick={clearSearch}>×</button>
    {/if}
  </div>

  <input
    bind:this={fileInput}
    class="cook-file"
    type="file"
    accept="image/jpeg,image/png,image/webp,application/pdf,.pdf,.txt,.md,.markdown,text/plain,text/markdown"
    multiple
    onchange={onFileInput}
  />

  <div class="cook-scroll">
    {#if filtered.length > 0}
      <div class="cook-grid">
        {#each filtered as recipe (recipe.id)}
          <button class="cook-card" type="button" onclick={() => openRecipe(recipe.id)}>
            <span class="cook-thumb">
              {#if recipe.thumbUrl}
                <img src={recipe.thumbUrl} alt="" loading="lazy" draggable="false" />
              {:else if recipe.type === 'image' && recipe.fileUrl}
                <img src={recipe.fileUrl} alt="" loading="lazy" draggable="false" />
              {:else}
                <span class="cook-type">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M7 3h7l4 4v14H7z" />
                    <path d="M14 3v4h4" />
                  </svg>
                  <b>{recipe.type === 'pdf' ? 'PDF' : 'TXT'}</b>
                </span>
              {/if}
            </span>
            <span class="cook-card-body">
              <span class="cook-card-title">{recipe.title}</span>
              <span class="cook-card-meta">{meta(recipe)}</span>
            </span>
          </button>
        {/each}
      </div>
    {:else if !cooking.loaded}
      <div class="empty cook-empty">
        <span class="empty-title">Loading recipes</span>
      </div>
    {:else if cooking.query}
      <div class="empty cook-empty">
        <span class="empty-title">No recipes match</span>
      </div>
    {:else}
      <div class="cook-empty">
        <span class="cook-empty-title">Drop a recipe here to get started</span>
        <span class="cook-empty-hint">Images, PDFs, text or Markdown. Or use + Add recipe.</span>
        {#if cooking.error}
          <span class="cook-empty-hint">Could not reach the recipe store. Check the NAS.</span>
        {/if}
      </div>
    {/if}
  </div>

  {#if cooking.uploads.length > 0}
    <div class="cook-queue">
      <div class="cook-queue-head">
        <span>Adding recipes</span>
        <button
          type="button"
          aria-label="Clear finished uploads"
          onclick={() => {
            for (const row of [...cooking.uploads]) {
              if (row.status === 'done' || row.status === 'failed') removeUpload(row.id)
            }
          }}
        >×</button>
      </div>
      {#each cooking.uploads as row (row.id)}
        <div class="cook-queue-row">
          <div class="cook-queue-name">{row.name}</div>
          <div
            class="cook-queue-state"
            class:done={row.status === 'done'}
            class:fail={row.status === 'failed'}
          >
            {#if row.status === 'failed'}
              {row.error}
            {:else if row.status === 'done'}
              Added
            {:else if row.status === 'uploading'}
              {row.progress}%
            {:else}
              Waiting
            {/if}
          </div>
          <div class="cook-bar"><span style={`width:${row.progress}%`}></span></div>
        </div>
      {/each}
    </div>
  {/if}

  {#if cooking.toast}
    <div class="toast"><span>{cooking.toast}</span></div>
  {/if}

  {#if dragging}
    <div class="cook-drop"><span>Drop to add a recipe</span></div>
  {/if}

  {#if route.recipeId}
    {#key route.recipeId}
      <RecipeView id={route.recipeId} />
    {/key}
  {/if}
</div>
