import { fetchJson } from './http.js'

export const photosState = $state({
  loaded: false,
  photos: [],
  index: 0,
  intervalSeconds: 20,
  source: 'none',
  error: '',
  hasAlbum: false,
  updated: '',
  signature: '',
})

let queue = []
let lastShown = -1
let slideTimer = null
let currentInterval = 0
let loadTimer = null

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function shuffled(count, avoid) {
  const list = Array.from({ length: count }, (_, index) => index)
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    const swap = list[i]
    list[i] = list[j]
    list[j] = swap
  }
  if (list.length > 1 && list[0] === avoid) {
    const swap = list[0]
    list[0] = list[1]
    list[1] = swap
  }
  return list
}

function normalize(raw) {
  const list = Array.isArray(raw) ? raw : raw && Array.isArray(raw.photos) ? raw.photos : []
  return list
    .map((photo) => {
      if (typeof photo === 'string') return { src: photo, caption: '' }
      return { src: String(photo.src || ''), caption: photo.caption ? String(photo.caption) : '' }
    })
    .filter((photo) => photo.src)
    .slice(0, 300)
}

export function advancePhoto() {
  const count = photosState.photos.length
  if (count < 2) return
  if (queue.length === 0) queue = shuffled(count, lastShown)
  const next = queue.shift()
  lastShown = next
  photosState.index = next
}

function ensureTimer() {
  if (photosState.intervalSeconds === currentInterval) return
  currentInterval = photosState.intervalSeconds
  clearInterval(slideTimer)
  slideTimer = setInterval(advancePhoto, currentInterval * 1000)
}

export async function loadPhotos() {
  let doc = null

  try {
    doc = await fetchJson('/data/photos-index.json', { cache: false, timeout: 8000 })
  } catch {
    try {
      const legacy = await fetchJson('/data/photos.json', { cache: false, timeout: 6000 })
      if (legacy && Array.isArray(legacy.photos)) doc = legacy
    } catch {
      doc = null
    }
  }

  if (!doc) {
    photosState.loaded = true
    photosState.error = 'missing'
    return
  }

  const photos = normalize(doc)
  const signature = photos.map((photo) => photo.src).join('|')

  if (signature !== photosState.signature) {
    photosState.photos = photos
    photosState.signature = signature
    queue = shuffled(photos.length, -1)
    lastShown = photos.length > 0 ? queue.shift() : -1
    photosState.index = lastShown >= 0 ? lastShown : 0
  }

  photosState.intervalSeconds = clamp(Number(doc.intervalSeconds) || 20, 5, 600)
  photosState.source = doc.source || (photos.length ? 'folder' : 'none')
  photosState.error = doc.error || ''
  photosState.hasAlbum = Boolean(doc.hasAlbum)
  photosState.updated = doc.updated || ''
  photosState.loaded = true

  ensureTimer()
}

export function startPhotos() {
  loadPhotos()
  clearInterval(loadTimer)
  loadTimer = setInterval(loadPhotos, 5 * 60 * 1000)
}
