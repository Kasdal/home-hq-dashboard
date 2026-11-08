import { fetchJson } from './http.js'
import { guessCategory, CATEGORIES } from './categories.js'
import { ingredientToShopping } from './mealPlan.js'

const API = '/api/shopping'
const FILE = '/data/shopping.json'
const BACKUP = 'hq:shopping'

export const shopping = $state({
  loaded: false,
  error: '',
  saving: false,
  rev: 0,
  stores: [
    { id: 'tesco', name: 'Tesco' },
    { id: 'lidl', name: 'Lidl' },
  ],
  items: [],
  usuals: [],
})

const DEFAULT_STORES = [
  { id: 'tesco', name: 'Tesco' },
  { id: 'lidl', name: 'Lidl' },
]

let lastEdit = 0
let saveTimer = null
let pollTimer = null

function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

function cleanItem(item) {
  if (!item || typeof item !== 'object') return null
  const name = String(item.name || '').trim()
  if (!name) return null
  const category = CATEGORIES.includes(item.category) ? item.category : guessCategory(name)
  const qty = Number(item.qty)
  return {
    id: String(item.id || newId()),
    name: name.slice(0, 80),
    note: item.note ? String(item.note).slice(0, 120) : '',
    qty: Number.isFinite(qty) && qty > 0 ? Math.min(99, Math.round(qty)) : 1,
    category,
    store: ['any', 'tesco', 'lidl'].includes(item.store) ? item.store : 'any',
    done: Boolean(item.done),
  }
}

function cleanUsual(item) {
  if (!item || typeof item !== 'object') return null
  const name = String(item.name || '').trim()
  if (!name) return null
  return {
    name: name.slice(0, 60),
    category: CATEGORIES.includes(item.category) ? item.category : guessCategory(name),
  }
}

export function normalize(raw) {
  const data = raw && typeof raw === 'object' ? raw : {}
  const items = Array.isArray(data.items) ? data.items.map(cleanItem).filter(Boolean) : []
  const usuals = Array.isArray(data.usuals) ? data.usuals.map(cleanUsual).filter(Boolean) : []
  const stores =
    Array.isArray(data.stores) && data.stores.length > 0
      ? data.stores
          .filter((store) => store && store.id)
          .map((store) => ({ id: String(store.id), name: String(store.name || store.id) }))
      : DEFAULT_STORES

  return {
    rev: Number(data.rev) || 0,
    stores,
    items: items.slice(0, 500),
    usuals: usuals.slice(0, 60),
  }
}

function applyDoc(doc) {
  shopping.rev = doc.rev
  shopping.stores = doc.stores
  shopping.items = doc.items
  shopping.usuals = doc.usuals
  shopping.loaded = true
}

export function snapshot() {
  return {
    rev: shopping.rev,
    stores: shopping.stores.map((store) => ({ id: store.id, name: store.name })),
    items: shopping.items.map((item) => ({ ...item })),
    usuals: shopping.usuals.map((item) => ({ ...item })),
  }
}

export async function loadShopping(force = false) {
  if (!force) {
    if (Date.now() - lastEdit < 5000) return
    const active = document.activeElement
    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) return
  }

  try {
    const doc = normalize(await fetchJson(API, { cache: false, timeout: 6000 }))
    applyDoc(doc)
    shopping.error = ''
    try {
      localStorage.setItem(BACKUP, JSON.stringify(snapshot()))
    } catch {
      // Ignore storage errors.
    }
    return
  } catch {
    // Fall back to the static file, then a local backup.
  }

  try {
    applyDoc(normalize(await fetchJson(FILE, { cache: true, timeout: 6000 })))
    shopping.error = ''
    return
  } catch {
    // Fall back to the backup.
  }

  try {
    const raw = localStorage.getItem(BACKUP)
    if (raw) {
      applyDoc(normalize(JSON.parse(raw)))
      shopping.error = 'offline'
      return
    }
  } catch {
    // Ignore a bad backup.
  }

  shopping.loaded = true
  shopping.error = 'empty'
}

async function persist() {
  const doc = snapshot()
  shopping.saving = true
  try {
    const res = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(doc),
    })
    if (!res.ok) throw new Error(`save failed with ${res.status}`)
    const saved = await res.json()
    if (saved && saved.rev != null) shopping.rev = Number(saved.rev)
    shopping.error = ''
    try {
      localStorage.setItem(BACKUP, JSON.stringify(snapshot()))
    } catch {
      // Ignore storage errors.
    }
  } catch {
    shopping.error = 'offline'
    try {
      localStorage.setItem(BACKUP, JSON.stringify(doc))
    } catch {
      // Ignore storage errors.
    }
  } finally {
    shopping.saving = false
  }
}

function touch() {
  lastEdit = Date.now()
  clearTimeout(saveTimer)
  saveTimer = setTimeout(persist, 400)
}

export function startShopping() {
  loadShopping(true)
  clearInterval(pollTimer)
  pollTimer = setInterval(() => loadShopping(false), 30 * 1000)
}

export function addItem(name, options = {}) {
  const text = String(name || '').trim()
  if (!text) return null

  const existing = shopping.items.find(
    (item) => !item.done && item.name.toLowerCase() === text.toLowerCase()
  )
  if (existing) {
    setQty(existing.id, existing.qty + (options.qty || 1))
    return existing.id
  }

  const item = {
    id: newId(),
    name: text.slice(0, 80),
    note: options.note ? String(options.note).slice(0, 120) : '',
    qty: options.qty || 1,
    category: options.category || guessCategory(text),
    store: options.store || 'any',
    done: false,
  }
  shopping.items = [...shopping.items, item]
  touch()
  return item.id
}

// Parse a recipe's ingredient lines into shopping items without writing them.
// Each item carries an `exists` flag when the open list already has that name.
export function previewIngredients(lines) {
  const list = Array.isArray(lines) ? lines : []
  const open = new Set(
    shopping.items.filter((item) => !item.done).map((item) => item.name.toLowerCase())
  )
  const seen = new Set()
  const items = []

  for (const line of list) {
    const parsed = ingredientToShopping(line)
    if (!parsed) continue
    const key = parsed.name.toLowerCase()
    const exists = open.has(key) || seen.has(key)
    seen.add(key)
    items.push({ ...parsed, exists })
  }

  return items
}

// Add previewed items to the shared list. The amount goes into the note, so
// the shopper sees "500 g" under "minced meat". Items already on the open list
// are skipped.
export function addIngredientItems(items, source = '') {
  const list = Array.isArray(items) ? items : []
  if (list.length === 0) return { added: 0, skipped: 0 }

  const open = new Set(
    shopping.items.filter((item) => !item.done).map((item) => item.name.toLowerCase())
  )
  const added = []
  let skipped = 0

  for (const item of list) {
    if (!item || !item.name) continue
    const key = item.name.toLowerCase()
    if (open.has(key)) {
      skipped += 1
      continue
    }
    open.add(key)

    let note = item.note || ''
    if (source) note = note ? `${note} · ${source}` : `For ${source}`

    added.push({
      id: newId(),
      name: item.name,
      note: note.slice(0, 120),
      qty: 1,
      category: guessCategory(item.name),
      store: 'any',
      done: false,
    })
  }

  if (added.length > 0) {
    shopping.items = [...shopping.items, ...added]
    touch()
  }

  return { added: added.length, skipped }
}

export function addIngredients(lines, source = '') {
  return addIngredientItems(previewIngredients(lines), source)
}

export function toggleDone(id) {
  shopping.items = shopping.items.map((item) =>
    item.id === id ? { ...item, done: !item.done } : item
  )
  touch()
}

export function setQty(id, qty) {
  if (qty <= 0) {
    removeItem(id)
    return
  }
  shopping.items = shopping.items.map((item) =>
    item.id === id ? { ...item, qty: Math.min(99, Math.round(qty)) } : item
  )
  touch()
}

export function removeItem(id) {
  const index = shopping.items.findIndex((item) => item.id === id)
  if (index === -1) return null
  const removed = shopping.items[index]
  shopping.items = shopping.items.filter((item) => item.id !== id)
  touch()
  return { item: removed, index }
}

export function restoreItem(removed) {
  if (!removed || !removed.item) return
  if (shopping.items.some((item) => item.id === removed.item.id)) return
  const next = [...shopping.items]
  next.splice(Math.min(removed.index, next.length), 0, { ...removed.item })
  shopping.items = next
  touch()
}

export function setStore(id, store) {
  shopping.items = shopping.items.map((item) => (item.id === id ? { ...item, store } : item))
  touch()
}

export function setNote(id, note) {
  shopping.items = shopping.items.map((item) =>
    item.id === id ? { ...item, note: String(note || '').slice(0, 120) } : item
  )
  touch()
}

export function clearDone() {
  const removed = shopping.items.filter((item) => item.done)
  shopping.items = shopping.items.filter((item) => !item.done)
  touch()
  return removed
}

export function restoreMany(items) {
  if (!Array.isArray(items) || items.length === 0) return
  const existing = new Set(shopping.items.map((item) => item.id))
  shopping.items = [...shopping.items, ...items.filter((item) => !existing.has(item.id)).map((item) => ({ ...item }))]
  touch()
}

export function openItems() {
  return shopping.items.filter((item) => !item.done)
}

export function storeCount(id) {
  return shopping.items.filter(
    (item) => !item.done && (item.store === 'any' || item.store === id)
  ).length
}

export function findUsualItem(name) {
  const key = String(name || '').toLowerCase()
  return shopping.items.find((item) => !item.done && item.name.toLowerCase() === key)
}
