import { ymd } from './time.js'

// The plan uses one meal per day. A day over this temperature is warm.
export const HOT_THRESHOLD = 18

const COLD_WORDS = [
  'soup',
  'stew',
  'casserole',
  'roast',
  'baked',
  'bake',
  'pie',
  'curry',
  'chili',
  'chilli',
  'chowder',
  'broth',
  'hotpot',
  'slow cooker',
  'oven',
  'winter',
  'comfort',
  'warm',
  'porridge',
  'crumble',
  'dumpling',
  'juha',
  'varivo',
  'gulaš',
  'pečenje',
  'pečeno',
  'pećnica',
  'zima',
  'zimi',
  'toplo',
  'kuhano',
  'sarma',
]

const HOT_WORDS = [
  'salad',
  'cold',
  'chilled',
  'fresh',
  'light',
  'summer',
  'grill',
  'barbecue',
  'bbq',
  'sandwich',
  'wrap',
  'smoothie',
  'ice cream',
  'iced',
  'no-cook',
  'no cook',
  'tomato',
  'cucumber',
  'gazpacho',
  'picnic',
  'fruit',
  'salata',
  'hladno',
  'hladna',
  'svježe',
  'ljeto',
  'ljeti',
  'roštilj',
  'sendvič',
  'voće',
  'sladoled',
]

// Amount first, then the rest. A unit is optional, so "1 onion" and
// "500 g minced meat" both split. Fractions and ranges are supported.
const AMOUNT_RE =
  /^((?:(?:\d+\s+)?\d+\s*\/\s*\d+|\d+(?:[.,]\d+)?|[½¼¾⅓⅔⅛])(?:\s*(?:-|–|to)\s*(?:\d+\s*\/\s*\d+|\d+(?:[.,]\d+)?|[½¼¾⅓⅔⅛]))?\s*(?:kg|g|mg|ml|l|cl|dl|tsp|tbsp|tablespoons?|teaspoons?|cups?|packs?|packets?|cans?|tins?|jars?|bottles?|slices?|pieces?|pcs|cloves?|bunch(?:es)?|pinch(?:es)?|sprigs?|heads?|sticks?|handfuls?)?)(?=\s|$)\s*(.+)$/i

export function climateFor(temp) {
  if (typeof temp !== 'number' || !Number.isFinite(temp)) return 'any'
  return temp > HOT_THRESHOLD ? 'hot' : 'cold'
}

export function climateLabel(mode, matched = true) {
  if (!matched) return 'Surprise pick'
  if (mode === 'hot') return 'Warm day'
  if (mode === 'cold') return 'Cold day'
  return 'Surprise pick'
}

function recipeText(recipe) {
  if (!recipe) return ''
  return [
    recipe.title,
    (recipe.tags || []).join(' '),
    (recipe.ingredients || []).join(' '),
    (recipe.steps || []).join(' '),
    recipe.notes,
  ]
    .join(' ')
    .toLowerCase()
}

export function climateScore(recipe, mode) {
  const text = recipeText(recipe)
  if (!text) return 0
  const words = mode === 'hot' ? HOT_WORDS : mode === 'cold' ? COLD_WORDS : []
  let score = 0
  for (const word of words) {
    if (text.includes(word)) score += 1
  }
  return score
}

// Pick a recipe for the current climate. Warm days prefer light dishes and
// cool days prefer warm dishes. If no recipe matches, the pick is random.
export function pickSurpriseRecipe(recipes, options = {}) {
  const list = Array.isArray(recipes) ? recipes.filter((recipe) => recipe && recipe.id) : []
  if (list.length === 0) return null

  const mode = climateFor(options.temp)
  const random = typeof options.random === 'function' ? options.random : Math.random
  let pool = list
  let matched = false

  if (mode !== 'any') {
    const scored = list.map((recipe) => ({ recipe, score: climateScore(recipe, mode) }))
    const best = Math.max(...scored.map((item) => item.score))
    if (best > 0) {
      pool = scored.filter((item) => item.score === best).map((item) => item.recipe)
      matched = true
    }
  }

  const currentId = options.currentId || ''
  const avoid = new Set([currentId, ...(options.avoidIds || [])].filter(Boolean))
  let candidates = pool.filter((recipe) => !avoid.has(recipe.id))
  if (candidates.length === 0) candidates = pool.filter((recipe) => recipe.id !== currentId)
  if (candidates.length === 0) candidates = pool

  const index = Math.min(candidates.length - 1, Math.floor(random() * candidates.length))
  return { recipe: candidates[index], mode, matched }
}

export function planDates(now, count = 7) {
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const out = []
  for (let i = 0; i < count; i += 1) {
    const date = new Date(base)
    date.setDate(base.getDate() + i)
    out.push({ key: ymd(date), date, offset: i })
  }
  return out
}

// Turn one free-text ingredient line into a shopping item. The amount goes
// into the note, so "500 g minced meat" becomes "minced meat" and "500 g".
export function ingredientToShopping(line) {
  let text = String(line == null ? '' : line)
    .replace(/^[\s\-*•·]+/, '')
    .replace(/[.;,]+$/, '')
    .replace(/\s+/g, ' ')
    .trim()

  if (!text) return null

  const match = text.match(AMOUNT_RE)
  let name = text
  let note = ''
  if (match && match[2]) {
    name = match[2].trim()
    note = match[1].trim()
  }
  if (name.length < 2) {
    name = text
    note = ''
  }

  return {
    name: name.slice(0, 80),
    note: note.slice(0, 120),
  }
}
