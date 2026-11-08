<script>
  import { onDestroy } from 'svelte'
  import {
    cooking,
    recipeById,
    saveRecipe,
    deleteRecipe,
    uploadRecipeFile,
    retryStructure,
  } from '../cooking.svelte.js'
  import { go } from '../route.svelte.js'

  let { id } = $props()

  const recipe = $derived(recipeById(id))
  const isWebView = /; wv\)/i.test(navigator.userAgent)

  let editing = $state(false)
  let draftTitle = $state('')
  let draftTags = $state('')
  let draftNotes = $state('')
  let draftIngredients = $state('')
  let draftSteps = $state('')
  let saving = $state(false)
  let retrying = $state(false)
  let missing = $state(false)
  let editError = $state('')
  let photoFile = $state(null)
  let photoPreview = $state('')
  let photoProgress = $state(0)
  let photoInput = $state(null)

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

  onDestroy(() => {
    if (photoPreview) URL.revokeObjectURL(photoPreview)
  })

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
    draftIngredients = recipe.ingredients.join('\n')
    draftSteps = recipe.steps.join('\n')
    editError = ''
    if (photoPreview) URL.revokeObjectURL(photoPreview)
    photoPreview = ''
    photoFile = null
    photoProgress = 0
    editing = true
  }

  function cancelEdit() {
    editing = false
    editError = ''
    if (photoPreview) URL.revokeObjectURL(photoPreview)
    photoPreview = ''
    photoFile = null
    photoProgress = 0
  }

  function pickPhoto() {
    if (photoInput) photoInput.click()
  }

  function onPhoto(event) {
    const file = event.currentTarget.files ? event.currentTarget.files[0] : null
    event.currentTarget.value = ''
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      editError = 'The photo must be JPEG, PNG or WebP.'
      return
    }
    if (file.size > 20 * 1024 * 1024) {
      editError = 'The photo is larger than 20 MB.'
      return
    }
    if (photoPreview) URL.revokeObjectURL(photoPreview)
    photoFile = file
    photoPreview = URL.createObjectURL(file)
    photoProgress = 0
    editError = ''
  }

  async function save() {
    if (!recipe) return
    saving = true
    editError = ''

    const patch = {
      title: draftTitle.trim() || recipe.title,
      tags: draftTags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
      notes: draftNotes,
      ingredients: draftIngredients
        .split('\n')
        .map((item) => item.trim())
        .filter(Boolean),
      steps: draftSteps
        .split('\n')
        .map((item) => item.trim())
        .filter(Boolean),
    }

    if (recipe.type === 'manual' && photoFile) {
      photoProgress = 1
      const uploaded = await uploadRecipeFile(photoFile, (percent) => {
        photoProgress = percent
      })
      if (!uploaded.ok) {
        saving = false
        editError = uploaded.error || 'Photo upload failed.'
        return
      }
      patch.photo = uploaded.photo
    }

    const ok = await saveRecipe(recipe.id, patch)
    saving = false
    if (ok) {
      editing = false
      if (photoPreview) URL.revokeObjectURL(photoPreview)
      photoPreview = ''
      photoFile = null
      photoProgress = 0
    } else {
      editError = 'Could not save the recipe.'
    }
  }

  async function retry() {
    if (!recipe || retrying) return
    retrying = true
    const ok = await retryStructure(recipe.id)
    retrying = false
    if (!ok) editError = 'Could not start the structure step.'
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
    if (current.type === 'manual') return 'Manual'
    if (current.type === 'pdf') return 'PDF'
    if (current.type === 'text') return 'Text'
    return 'Image'
  }

  function structureNote(current) {
    if (current.type === 'manual') return ''
    if (current.textStatus === 'pending') return 'Reading the text...'
    if (current.textStatus === 'failed') return 'Text extraction failed.'
    if (current.structureStatus === 'pending') return 'Structuring the recipe...'
    if (current.structureStatus === 'failed') return 'The AI could not structure this recipe.'
    if (current.structureStatus === 'none') return 'Automatic structure is off for this recipe.'
    return ''
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
      <span class="cook-view-eyebrow">
        {recipe.type === 'manual' ? 'Manual recipe' : 'Recipe'}
      </span>
      <div class="cook-view-actions">
        {#if !editing}
          <button class="cook-secondary" type="button" onclick={startEdit}>Edit</button>
        {/if}
        <button class="cook-danger" type="button" onclick={remove}>Delete</button>
      </div>
    </header>

    {#if editing}
      <div class="cook-doc cook-doc-edit">
        <label class="cook-field">
          <span>Title</span>
          <input bind:value={draftTitle} maxlength="120" disabled={saving} />
        </label>

        <label class="cook-field">
          <span>Tags</span>
          <input bind:value={draftTags} placeholder="soup, winter" disabled={saving} />
        </label>

        <label class="cook-field">
          <span>Ingredients · one per line</span>
          <textarea bind:value={draftIngredients} rows="8" disabled={saving}></textarea>
        </label>

        <label class="cook-field">
          <span>Preparation · one step per line</span>
          <textarea bind:value={draftSteps} rows="8" disabled={saving}></textarea>
        </label>

        <label class="cook-field">
          <span>Notes</span>
          <textarea bind:value={draftNotes} rows="4" disabled={saving}></textarea>
        </label>

        {#if recipe.type === 'manual'}
          <div class="cook-photo-edit">
            {#if photoPreview}
              <img src={photoPreview} alt="" />
            {:else if recipe.fileUrl}
              <img src={recipe.fileUrl} alt="" />
            {/if}
            <button class="cook-secondary" type="button" onclick={pickPhoto} disabled={saving}>
              {recipe.fileUrl || photoPreview ? 'Replace photo' : 'Add photo'}
            </button>
            <input
              bind:this={photoInput}
              class="cook-file"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onchange={onPhoto}
            />
          </div>
        {/if}

        {#if photoProgress > 0 && photoProgress < 100}
          <p class="cook-manual-hint">Uploading the photo... {photoProgress}%</p>
        {/if}
        {#if editError}
          <p class="cook-manual-error">{editError}</p>
        {/if}

        <div class="cook-actions">
          <button class="cook-primary" type="button" onclick={save} disabled={saving || cooking.saving}>
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button class="cook-secondary" type="button" onclick={cancelEdit} disabled={saving || cooking.saving}>
            Cancel
          </button>
        </div>
      </div>
    {:else}
      <article class="cook-doc">
        {#if (recipe.type === 'image' || recipe.type === 'manual') && recipe.fileUrl}
          <img
            class="cook-manual-photo"
            src={recipe.fileUrl}
            alt={recipe.title}
            onerror={() => (missing = true)}
          />
        {:else if recipe.type === 'pdf' && recipe.thumbUrl}
          <img
            class="cook-manual-photo cook-pdf-thumb"
            src={recipe.thumbUrl}
            alt={recipe.title}
            onerror={() => (missing = true)}
          />
        {/if}

        <h1 class="cook-doc-title">{recipe.title}</h1>
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

        {#if structureNote(recipe)}
          <div class="cook-structure-row">
            <span class="cook-structure-note">{structureNote(recipe)}</span>
            {#if recipe.type !== 'manual' && (recipe.structureStatus === 'failed' || recipe.structureStatus === 'none') && recipe.textStatus === 'ready'}
              <button class="cook-secondary" type="button" onclick={retry} disabled={retrying}>
                {retrying
                  ? 'Retrying...'
                  : recipe.structureStatus === 'failed'
                    ? 'Retry structure'
                    : 'Structure with AI'}
              </button>
            {/if}
          </div>
        {/if}

        {#if recipe.ingredients.length > 0}
          <section class="cook-doc-section">
            <h2>Ingredients</h2>
            <ul class="cook-doc-list">
              {#each recipe.ingredients as ingredient, index (index)}
                <li>{ingredient}</li>
              {/each}
            </ul>
          </section>
        {/if}

        {#if recipe.steps.length > 0}
          <section class="cook-doc-section">
            <h2>Preparation</h2>
            <ol class="cook-doc-steps">
              {#each recipe.steps as step, index (index)}
                <li>{step}</li>
              {/each}
            </ol>
          </section>
        {/if}

        {#if recipe.notes}
          <section class="cook-doc-section">
            <h2>Notes</h2>
            <p class="cook-notes">{recipe.notes}</p>
          </section>
        {/if}

        {#if recipe.type !== 'manual'}
          {#if recipe.type === 'pdf'}
            <details class="cook-extract cook-original">
              <summary>Original PDF</summary>
              {#if isWebView}
                <p class="cook-extract-note">
                  The PDF preview is not available on this screen. The extracted text is below.
                </p>
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
            </details>
          {/if}

          <details class="cook-extract">
            <summary>{textLabel(recipe)}</summary>
            {#if recipe.textStatus === 'pending'}
              <p class="cook-extract-note">
                The text is still being read. The structure follows after it.
              </p>
            {:else if recipe.textStatus === 'failed'}
              <p class="cook-extract-note">
                Text extraction failed. The recipe file is still available. You can edit the
                fields above.
              </p>
            {:else if recipe.text}
              <pre class="cook-extract-text">{recipe.text}</pre>
            {:else}
              <p class="cook-extract-note">No text was found in this file.</p>
            {/if}
          </details>
        {/if}
      </article>
    {/if}
  </div>
{/if}
