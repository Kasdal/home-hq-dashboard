<script>
  import { cooking, recipeById, saveRecipe, deleteRecipe } from '../cooking.svelte.js'
  import { go } from '../route.svelte.js'

  let { id } = $props()

  const recipe = $derived(recipeById(id))
  const isWebView = /; wv\)/i.test(navigator.userAgent)

  let editing = $state(false)
  let draftTitle = $state('')
  let draftTags = $state('')
  let draftNotes = $state('')
  let saving = $state(false)
  let missing = $state(false)

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

  $effect(() => {
    const current = recipe
    if (!current || !current.fileUrl || current.type === 'text') {
      missing = false
      return
    }

    let active = true
    fetch(current.fileUrl, { method: 'HEAD' })
      .then((response) => {
        if (active) missing = !response.ok
      })
      .catch(() => {
        if (active) missing = true
      })

    return () => {
      active = false
    }
  })

  function back() {
    go('cooking')
  }

  function startEdit() {
    if (!recipe) return
    draftTitle = recipe.title
    draftTags = recipe.tags.join(', ')
    draftNotes = recipe.notes
    editing = true
  }

  function cancelEdit() {
    editing = false
  }

  async function save() {
    if (!recipe) return
    saving = true
    const ok = await saveRecipe(recipe.id, {
      title: draftTitle.trim() || recipe.title,
      tags: draftTags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
      notes: draftNotes,
    })
    saving = false
    if (ok) editing = false
  }

  async function remove() {
    if (!recipe) return
    const ok = confirm('Remove "' + recipe.title + '"? This deletes the recipe and its file.')
    if (!ok) return
    const removed = await deleteRecipe(recipe.id)
    if (removed) go('cooking')
  }

  function shortDate(value) {
    if (!value) return 'unknown'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value.slice(0, 10)
    return date.getDate() + ' ' + months[date.getMonth()] + ' ' + date.getFullYear()
  }

  function formatSize(bytes) {
    const size = Number(bytes) || 0
    if (size < 1024) return size + ' B'
    if (size < 1024 * 1024) return Math.round(size / 1024) + ' KB'
    return (size / (1024 * 1024)).toFixed(1) + ' MB'
  }

  function typeLabel(current) {
    if (current.type === 'pdf') return 'PDF'
    if (current.type === 'text') return 'Text'
    return 'Image'
  }

  function textLabel(current) {
    if (current.textStatus === 'pending') return 'Reading text...'
    if (current.textStatus === 'failed') return 'Text unavailable'
    if (!current.text) return 'No text found'
    if (current.textSource === 'ocr') return 'OCR text'
    if (current.textSource === 'pdf') return 'PDF text'
    return 'Text file'
  }
</script>

{#if !recipe && !cooking.loaded}
  <div class="cook-view">
    <header class="cook-view-head">
      <button class="cook-back" type="button" onclick={back}>← Back</button>
      <span class="cook-view-eyebrow">Recipe</span>
    </header>
    <div class="empty cook-empty">
      <span class="empty-title">Loading recipe</span>
    </div>
  </div>
{:else if !recipe}
  <div class="cook-view">
    <header class="cook-view-head">
      <button class="cook-back" type="button" onclick={back}>← Back</button>
      <span class="cook-view-eyebrow">Recipe</span>
    </header>
    <div class="empty cook-empty">
      <span class="empty-title">Recipe not found</span>
      <span class="empty-hint">It may have been removed.</span>
    </div>
  </div>
{:else}
  <div class="cook-view">
    <header class="cook-view-head">
      <button class="cook-back" type="button" onclick={back}>← Back</button>
      <span class="cook-view-eyebrow">Recipe</span>
      <div class="cook-view-actions">
        {#if !editing}
          <button class="cook-secondary" type="button" onclick={startEdit}>Edit</button>
        {/if}
        <button class="cook-danger" type="button" onclick={remove}>Delete</button>
      </div>
    </header>

    <div class="cook-view-body">
      <section class="cook-preview">
        {#if recipe.type === 'image'}
          <img
            class="cook-image"
            src={recipe.fileUrl}
            alt={recipe.title}
            onerror={() => (missing = true)}
          />
        {:else if recipe.type === 'pdf'}
          {#if isWebView}
            <div class="cook-pdf-fallback">
              <span class="cook-type">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M7 3h7l4 4v14H7z" />
                  <path d="M14 3v4h4" />
                </svg>
                <b>PDF</b>
              </span>
              <strong>PDF preview is not available on this screen.</strong>
              {#if recipe.text}
                <span>Read the extracted text below.</span>
              {/if}
            </div>
          {:else}
            <object
              class="cook-pdf"
              data={recipe.fileUrl}
              type="application/pdf"
              aria-label={recipe.title}
            >
              <div class="cook-pdf-fallback">
                <strong>PDF preview is not available.</strong>
                <a href={recipe.fileUrl} target="_blank" rel="noopener">Open PDF</a>
              </div>
            </object>
          {/if}
        {:else}
          <pre class="cook-text-main">{recipe.text || 'This file is empty.'}</pre>
        {/if}

        {#if recipe.type !== 'text'}
          <details class="cook-extract" open={recipe.type === 'pdf'}>
            <summary>{textLabel(recipe)}</summary>
            {#if recipe.textStatus === 'pending'}
              <p class="cook-extract-note">
                The text is still being read. Search updates when it is ready.
              </p>
            {:else if recipe.textStatus === 'failed'}
              <p class="cook-extract-note">
                Text extraction failed. The recipe file is still available.
              </p>
            {:else if recipe.text}
              <pre class="cook-extract-text">{recipe.text}</pre>
            {:else}
              <p class="cook-extract-note">No text was found in this file.</p>
            {/if}
          </details>
        {/if}
      </section>

      <section class="cook-side">
        {#if editing}
          <div class="cook-edit">
            <label class="cook-field">
              <span>Title</span>
              <input bind:value={draftTitle} maxlength="120" />
            </label>
            <label class="cook-field">
              <span>Tags</span>
              <input bind:value={draftTags} placeholder="soup, winter" />
            </label>
            <label class="cook-field">
              <span>Notes</span>
              <textarea bind:value={draftNotes} rows="5"></textarea>
            </label>
            <div class="cook-actions">
              <button
                class="cook-primary"
                type="button"
                onclick={save}
                disabled={saving || cooking.saving}
              >Save</button>
              <button
                class="cook-secondary"
                type="button"
                onclick={cancelEdit}
                disabled={saving || cooking.saving}
              >Cancel</button>
            </div>
          </div>
        {:else}
          <h1 class="cook-view-title">{recipe.title}</h1>
          <div class="cook-meta-row">
            <span>{typeLabel(recipe)}</span>
            {#if recipe.size}
              <span>{formatSize(recipe.size)}</span>
            {/if}
            <span>Added {shortDate(recipe.addedAt)}</span>
            {#if missing}
              <span class="cook-warn">File missing</span>
            {/if}
          </div>
          {#if recipe.tags.length > 0}
            <div class="cook-tags">
              {#each recipe.tags as tag (tag)}
                <span class="cook-tag">{tag}</span>
              {/each}
            </div>
          {/if}
          {#if recipe.notes}
            <p class="cook-notes">{recipe.notes}</p>
          {/if}
        {/if}
      </section>
    </div>
  </div>
{/if}
