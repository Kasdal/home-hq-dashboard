<script>
  import { onDestroy } from 'svelte'
  import {
    parseManualText,
    uploadRecipeFile,
    createManualRecipe,
  } from '../cooking.svelte.js'

  let { onclose } = $props()

  let text = $state('')
  let title = $state('')
  let ingredients = $state('')
  let steps = $state('')
  let notes = $state('')
  let tags = $state('')
  let photoFile = $state(null)
  let photoPreview = $state('')
  let uploadedPhoto = $state(null)
  let photoProgress = $state(0)
  let parsing = $state(false)
  let saving = $state(false)
  let parsed = $state(false)
  let parsedText = $state('')
  let error = $state('')
  let photoInput = $state(null)

  const MAX_TEXT = 4000
  const MAX_PHOTO = 20 * 1024 * 1024

  onDestroy(() => {
    if (photoPreview) URL.revokeObjectURL(photoPreview)
  })

  function pickPhoto() {
    if (photoInput) photoInput.click()
  }

  function clearPhoto() {
    if (photoPreview) URL.revokeObjectURL(photoPreview)
    photoPreview = ''
    photoFile = null
    uploadedPhoto = null
    photoProgress = 0
  }

  function onPhoto(event) {
    const file = event.currentTarget.files ? event.currentTarget.files[0] : null
    event.currentTarget.value = ''
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      error = 'The photo must be JPEG, PNG or WebP.'
      return
    }
    if (file.size > MAX_PHOTO) {
      error = 'The photo is larger than 20 MB.'
      return
    }
    clearPhoto()
    photoFile = file
    photoPreview = URL.createObjectURL(file)
    error = ''
  }

  async function runAi() {
    if (parsing || saving) return
    const value = text.trim()
    if (!value) {
      error = 'Paste the recipe text first.'
      return
    }
    if (value.length > MAX_TEXT) {
      error = 'The text is longer than 4000 characters.'
      return
    }

    parsing = true
    error = ''
    const result = await parseManualText(value)
    parsing = false

    if (!result.ok) {
      parsed = false
      error = result.error === 'AI parsing is off'
        ? 'AI parsing is off in /data/config.json.'
        : 'The AI could not parse this text. Try again.'
      return
    }

    title = result.data.title || ''
    ingredients = (result.data.ingredients || []).join('\n')
    steps = (result.data.steps || []).join('\n')
    notes = result.data.notes || ''
    parsed = true
    parsedText = value
    error = ''
  }

  function splitLines(value) {
    return String(value || '')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
  }

  function splitTags(value) {
    return String(value || '')
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean)
  }

  async function save() {
    if (saving || parsing) return
    if (!parsed) {
      error = 'Press the AI button first.'
      return
    }
    if (!title.trim()) {
      error = 'Add a title.'
      return
    }

    saving = true
    error = ''

    if (photoFile && !uploadedPhoto) {
      photoProgress = 1
      const uploaded = await uploadRecipeFile(photoFile, (percent) => {
        photoProgress = percent
      })
      if (!uploaded.ok) {
        saving = false
        error = uploaded.error || 'Photo upload failed.'
        return
      }
      uploadedPhoto = uploaded.photo
    }

    const result = await createManualRecipe({
      title: title.trim(),
      tags: splitTags(tags),
      ingredients: splitLines(ingredients),
      steps: splitLines(steps),
      notes: notes.trim(),
      photo: uploadedPhoto,
    })

    saving = false
    if (!result.ok) {
      error = result.error || 'Could not save the recipe.'
      return
    }

    onclose()
  }

  function back() {
    if (saving) return
    onclose()
  }
</script>

<div class="cook-manual">
  <header class="cook-view-head">
    <button class="cook-back" type="button" onclick={back} disabled={saving}>← Back</button>
    <span class="cook-view-eyebrow">Manual recipe</span>
    <span class="cook-manual-note">AI parsing on the NAS</span>
  </header>

  <div class="cook-manual-grid">
    <section class="cook-manual-source">
      <label class="cook-field">
        <span>Recipe text</span>
        <textarea
          bind:value={text}
          maxlength={MAX_TEXT}
          rows="14"
          placeholder="Paste the recipe here. Any format works."
          disabled={parsing || saving}
        ></textarea>
      </label>
      <div class="cook-manual-count">{text.length} / {MAX_TEXT}</div>

      <div class="cook-manual-extra">
        <label class="cook-field">
          <span>Tags</span>
          <input bind:value={tags} placeholder="soup, winter" disabled={parsing || saving} />
        </label>

        <div class="cook-photo">
          <span class="cook-photo-label">Photo</span>
          {#if photoPreview}
            <div class="cook-photo-preview">
              <img src={photoPreview} alt="" />
              <button type="button" onclick={clearPhoto} disabled={saving} aria-label="Remove photo">×</button>
            </div>
          {:else}
            <button class="cook-secondary" type="button" onclick={pickPhoto} disabled={parsing || saving}>
              Add photo
            </button>
          {/if}
          <input
            bind:this={photoInput}
            class="cook-file"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onchange={onPhoto}
          />
        </div>
      </div>

      <button
        class="cook-ai"
        type="button"
        onclick={runAi}
        disabled={parsing || saving || !text.trim()}
      >
        {#if parsing}
          Reading the recipe...
        {:else}
          Dodaj uz pomoc AI modela
        {/if}
      </button>

      {#if parsing}
        <p class="cook-manual-hint">This takes about 20 seconds on the NAS. Keep this page open.</p>
      {/if}
      {#if saving && photoProgress > 0 && photoProgress < 100}
        <p class="cook-manual-hint">Uploading the photo... {photoProgress}%</p>
      {/if}
      {#if error}
        <p class="cook-manual-error">{error}</p>
      {/if}
      {#if parsed && text.trim() !== parsedText}
        <p class="cook-manual-hint">The text changed. Press the AI button again to refresh the preview.</p>
      {/if}
    </section>

    <section class="cook-manual-preview">
      {#if parsed}
        <label class="cook-field">
          <span>Title</span>
          <input bind:value={title} maxlength="120" disabled={saving} />
        </label>

        <label class="cook-field">
          <span>Ingredients · one per line</span>
          <textarea bind:value={ingredients} rows="7" disabled={saving}></textarea>
        </label>

        <label class="cook-field">
          <span>Preparation · one step per line</span>
          <textarea bind:value={steps} rows="7" disabled={saving}></textarea>
        </label>

        <label class="cook-field">
          <span>Notes</span>
          <textarea bind:value={notes} rows="3" disabled={saving}></textarea>
        </label>

        <div class="cook-actions">
          <button class="cook-primary" type="button" onclick={save} disabled={saving}>
            {saving ? 'Saving...' : 'Save recipe'}
          </button>
          <button class="cook-secondary" type="button" onclick={back} disabled={saving}>
            Cancel
          </button>
        </div>
      {:else}
        <div class="cook-manual-placeholder">
          <strong>Paste the recipe on the left.</strong>
          <span>The AI model reads the title, ingredients and steps. You can edit the result before you save.</span>
        </div>
      {/if}
    </section>
  </div>
</div>
