import { fetchJson } from './http.js'

const API = '/api/recipes'
const FILE = '/data/recipes.json'
const MAX_TEXT = 20000

export const cooking = $state({
  loaded: false,
  error: '',
  saving: false,
  recipes: [],
  query: '',
  toast: '',
  uploads: [],
})

let pollTimer = null
let toastTimer = null
let uploadSeq = 0

function asText(value, max) {
  return String(value == null ? '' : value).slice(0, max)
}

function buildSearch(recipe) {
  return [recipe.title, (recipe.tags || []).join(' '), recipe.notes, recipe.text]
    .join(' ')
    .toLowerCase()
}

export function normalizeRecipe(raw) {
  if (!raw || typeof raw !== 'object') return null
  const id = String(raw.id || '')
  if (!id) return null

  const tags = Array.isArray(raw.tags)
    ? raw.tags.map((tag) => asText(tag, 30).trim()).filter(Boolean).slice(0, 20)
    : []

  const recipe = {
    id,
    title: asText(raw.title, 120).trim() || 'Untitled recipe',
    tags,
    notes: asText(raw.notes, 2000),
    text: asText(raw.text, MAX_TEXT),
    file: asText(raw.file, 200),
    type: ['image', 'pdf', 'text'].includes(raw.type) ? raw.type : 'text',
    mime: asText(raw.mime, 100),
    size: Number(raw.size) || 0,
    addedAt: asText(raw.addedAt, 30),
    thumb: asText(raw.thumb, 200),
    textSource: asText(raw.textSource, 20),
    textStatus: ['pending', 'ready', 'failed', 'none'].includes(raw.textStatus)
      ? raw.textStatus
      : 'none',
    textAt: asText(raw.textAt, 30),
  }

  recipe.fileUrl = recipe.file
    ? '/data/recipes/files/' + encodeURIComponent(recipe.file)
    : ''
  recipe.thumbUrl = recipe.thumb
    ? '/data/recipes/thumbs/' + encodeURIComponent(recipe.thumb)
    : ''
  recipe.search = buildSearch(recipe)
  return recipe
}

function sortRecipes(list) {
  return list.sort((a, b) => String(b.addedAt).localeCompare(String(a.addedAt)))
}

function applyDoc(doc) {
  const list = Array.isArray(doc && doc.recipes)
    ? doc.recipes.map(normalizeRecipe).filter(Boolean)
    : []
  cooking.recipes = sortRecipes(list)
  cooking.loaded = true
  cooking.error = ''
}

export async function loadRecipes() {
  let doc = null

  try {
    doc = await fetchJson(API, { cache: false, timeout: 8000 })
  } catch {
    try {
      doc = await fetchJson(FILE, { cache: true, timeout: 6000 })
    } catch {
      doc = null
    }
  }

  if (!doc) {
    cooking.loaded = true
    cooking.error = 'missing'
    return
  }

  applyDoc(doc)
}

export function startCooking() {
  loadRecipes()
  clearInterval(pollTimer)
  pollTimer = setInterval(loadRecipes, 30 * 1000)
}

export function stopCooking() {
  clearInterval(pollTimer)
  pollTimer = null
}

export function recipeById(id) {
  return cooking.recipes.find((recipe) => recipe.id === id) || null
}

export function filteredRecipes() {
  const query = cooking.query.trim().toLowerCase()
  if (!query) return cooking.recipes
  return cooking.recipes.filter((recipe) => recipe.search.includes(query))
}

export function setQuery(value) {
  cooking.query = String(value || '')
}

export function showToast(message) {
  cooking.toast = message
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => (cooking.toast = ''), 4000)
}

export async function saveRecipe(id, patch) {
  const current = recipeById(id)
  if (!current) return false

  const before = {
    title: current.title,
    tags: [...current.tags],
    notes: current.notes,
  }

  const updated = { ...current, ...patch }
  updated.search = buildSearch(updated)
  cooking.recipes = cooking.recipes.map((recipe) =>
    recipe.id === id ? updated : recipe
  )
  cooking.saving = true

  try {
    const slim = cooking.recipes.map((recipe) => ({
      id: recipe.id,
      title: recipe.title,
      tags: recipe.tags,
      notes: recipe.notes,
    }))
    const response = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipes: slim }),
    })
    if (!response.ok) throw new Error('save failed')
    applyDoc(await response.json())
    showToast('Recipe saved')
    return true
  } catch {
    cooking.recipes = cooking.recipes.map((recipe) => {
      if (recipe.id !== id) return recipe
      const restored = { ...recipe, ...before }
      restored.search = buildSearch(restored)
      return restored
    })
    showToast('Could not save the recipe')
    return false
  } finally {
    cooking.saving = false
  }
}

export async function deleteRecipe(id) {
  try {
    const response = await fetch(API + '?id=' + encodeURIComponent(id), {
      method: 'DELETE',
    })
    if (!response.ok) throw new Error('delete failed')
    cooking.recipes = cooking.recipes.filter((recipe) => recipe.id !== id)
    cooking.uploads = cooking.uploads.filter((upload) => upload.recipeId !== id)
    showToast('Recipe removed')
    return true
  } catch {
    showToast('Could not remove the recipe')
    return false
  }
}

export function addUpload(file) {
  uploadSeq += 1
  cooking.uploads.push({
    id: 'u' + uploadSeq,
    name: file.name,
    progress: 0,
    status: 'waiting',
    error: '',
    recipeId: '',
  })
  return cooking.uploads[cooking.uploads.length - 1]
}

export function removeUpload(id) {
  cooking.uploads = cooking.uploads.filter((upload) => upload.id !== id)
}

export function uploadRecipe(file, onProgress) {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', '/api/photos?kind=recipe&name=' + encodeURIComponent(file.name))
    xhr.responseType = 'json'

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100))
      }
    }

    xhr.onload = () => {
      const body = xhr.response || {}
      if (xhr.status === 200 && body.recipe) {
        const recipe = normalizeRecipe(body.recipe)
        if (recipe) {
          cooking.recipes = sortRecipes([
            recipe,
            ...cooking.recipes.filter((item) => item.id !== recipe.id),
          ])
          cooking.query = ''
          showToast('Recipe added')
          resolve({ ok: true, recipe })
          return
        }
      }
      resolve({
        ok: false,
        error: body.error || 'Upload failed (' + xhr.status + ')',
      })
    }

    xhr.onerror = () => resolve({ ok: false, error: 'Network error' })
    xhr.send(file)
  })
}
