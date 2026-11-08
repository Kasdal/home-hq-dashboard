import { fetchJson } from './http.js'
import { clock } from './clock.svelte.js'
import { ymd } from './time.js'
import { cooking } from './cooking.svelte.js'
import { weather } from './weather.svelte.js'
import { addIngredients } from './shopping.svelte.js'
import { pickSurpriseRecipe, climateFor, climateLabel } from './mealPlan.js'

const API = '/api/plan'
const FILE = '/data/plan.json'
const BACKUP = 'hq:plan'

export const plan = $state({
  loaded: false,
  error: '',
  saving: false,
  rev: 0,
  days: {},
})

let lastEdit = 0
let saveTimer = null
let pollTimer = null

function cleanEntry(entry) {
  if (!entry || typeof entry !== 'object') return null
  const recipeId = String(entry.recipeId || '').trim()
  if (!recipeId) return null
  return {
    recipeId: recipeId.slice(0, 80),
    title: String(entry.title || '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 120),
  }
}

export function normalizePlan(raw) {
  const data = raw && typeof raw === 'object' ? raw : {}
  const days = {}
  if (data.days && typeof data.days === 'object' && !Array.isArray(data.days)) {
    for (const key of Object.keys(data.days)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) continue
      const entry = cleanEntry(data.days[key])
      if (entry) days[key] = entry
    }
  }
  return {
    rev: Number(data.rev) || 0,
    days,
  }
}

function applyDoc(doc) {
  plan.rev = doc.rev
  plan.days = doc.days
  plan.loaded = true
}

export function snapshot() {
  const days = {}
  for (const key of Object.keys(plan.days)) {
    const entry = plan.days[key]
    days[key] = { recipeId: entry.recipeId, title: entry.title || '' }
  }
  return { rev: plan.rev, days }
}

function cacheLocal() {
  try {
    localStorage.setItem(BACKUP, JSON.stringify(snapshot()))
  } catch {
    // Ignore storage errors.
  }
}

export function todayKey() {
  return ymd(clock.now)
}

export function dayKey(offset = 0) {
  const date = new Date(clock.now)
  date.setDate(date.getDate() + offset)
  return ymd(date)
}

export function entryFor(key) {
  return plan.days[key] || null
}

export function recipeFor(key) {
  const entry = plan.days[key]
  if (!entry) return null
  return cooking.recipes.find((recipe) => recipe.id === entry.recipeId) || null
}

export function titleFor(key) {
  const recipe = recipeFor(key)
  if (recipe) return recipe.title
  const entry = entryFor(key)
  return entry ? entry.title : ''
}

export function setMeal(key, recipe) {
  if (!recipe || !recipe.id) return false
  plan.days = {
    ...plan.days,
    [key]: { recipeId: recipe.id, title: recipe.title },
  }
  touch()
  return true
}

export function clearMeal(key) {
  if (!plan.days[key]) return
  const days = { ...plan.days }
  delete days[key]
  plan.days = days
  touch()
}

export function addMealIngredients(key) {
  const recipe = recipeFor(key)
  if (!recipe) return { added: 0, skipped: 0, error: 'Recipe not found' }
  if (!recipe.ingredients || recipe.ingredients.length === 0) {
    return { added: 0, skipped: 0, error: 'No ingredients' }
  }
  return addIngredients(recipe.ingredients, recipe.title)
}

export function surpriseMe(key, options = {}) {
  const current = entryFor(key)
  const result = pickSurpriseRecipe(cooking.recipes, {
    temp: weather.current ? weather.current.temperature_2m : null,
    currentId: current ? current.recipeId : '',
    avoidIds: options.avoidIds || [],
    random: options.random,
  })
  if (!result) return { ok: false, error: 'No recipes yet' }
  setMeal(key, result.recipe)
  return {
    ok: true,
    recipe: result.recipe,
    mode: result.mode,
    matched: result.matched,
    label: climateLabel(result.mode, result.matched),
  }
}

export function climateInfo() {
  const temp = weather.current ? weather.current.temperature_2m : null
  const mode = climateFor(temp)
  if (mode === 'hot') {
    return { temp, mode, label: 'Warm day', hint: 'Over 18 °C. Something light.' }
  }
  if (mode === 'cold') {
    return { temp, mode, label: 'Cold day', hint: '18 °C or cooler. Something warm.' }
  }
  return { temp, mode, label: 'Any weather', hint: 'Weather is not ready.' }
}

export async function loadPlan(force = false) {
  if (!force && Date.now() - lastEdit < 5000) return

  try {
    applyDoc(normalizePlan(await fetchJson(API, { cache: false, timeout: 6000 })))
    plan.error = ''
    cacheLocal()
    return
  } catch {
    // Fall back to the static file.
  }

  try {
    applyDoc(normalizePlan(await fetchJson(FILE, { cache: true, timeout: 6000 })))
    plan.error = ''
    return
  } catch {
    // Fall back to the local backup.
  }

  try {
    const raw = localStorage.getItem(BACKUP)
    if (raw) {
      applyDoc(normalizePlan(JSON.parse(raw)))
      plan.error = 'offline'
      return
    }
  } catch {
    // Ignore a bad backup.
  }

  plan.loaded = true
  plan.error = 'empty'
}

async function persist() {
  const doc = snapshot()
  plan.saving = true
  try {
    const response = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(doc),
    })
    if (!response.ok) throw new Error(`save failed with ${response.status}`)
    const saved = await response.json()
    if (saved && saved.rev != null) plan.rev = Number(saved.rev)
    plan.error = ''
    cacheLocal()
  } catch {
    plan.error = 'offline'
    cacheLocal()
  } finally {
    plan.saving = false
  }
}

function touch() {
  lastEdit = Date.now()
  clearTimeout(saveTimer)
  saveTimer = setTimeout(persist, 350)
}

export function startPlan() {
  loadPlan(true)
  clearInterval(pollTimer)
  pollTimer = setInterval(() => loadPlan(false), 60 * 1000)
}

export function stopPlan() {
  clearInterval(pollTimer)
  pollTimer = null
  clearTimeout(saveTimer)
}
