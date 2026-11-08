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

// Parsing helpers for ingredient lines. Amounts may sit at the start
// ("400 g flour") or at the end ("Dijon mustard, 1 tsp"). A comma may also
// carry a preparation note ("parsley, 2 tbsp, chopped").
const FRACTION = String.raw`(?:(?:\d+\s+)?\d+\s*\/\s*\d+|\d+(?:[.,]\d+)?|[½¼¾⅓⅔⅛])`
const AMOUNT_WORD = String.raw`(?:pola|pol|jedan|jedna|jedno|dva|dvije|tri|četiri|cetiri|pet|šest|sest|sedam|osam|devet|deset|malo|prstohvat|nekoliko|par|few|half|one|two|three|four|five|six|seven|eight|nine|ten|pinch|handful|dash)`
const AMOUNT = String.raw`(?:${FRACTION}(?:\s*(?:-|–|to)\s*${FRACTION})?|${AMOUNT_WORD})`
const UNIT = String.raw`(?:kg|g|mg|ml|l|cl|dl|dcl|tsp|tbsp|tbs|spoons?|teaspoons?|tablespoons?|cups?|packs?|packets?|cans?|tins?|jars?|bottles?|slices?|pieces?|pcs|cloves?|bunch(?:es)?|pinch(?:es)?|sprigs?|heads?|sticks?|handfuls?|rashers?|fillets?|sheets?|scoops?|drops?|dash(?:es)?|oz|lb|pounds?|žlica|žlice|žličica|žličice|zlica|zlicica|zlicice|zlice|mjerica|mjerice|šalica|šalice|salica|salice|kom|komad|komada|paket|paketa|konzerva|konzerve|limenka|vrećica|vrećice|prstohvat|prstohvata|češanj|češnja|cesanj|cesnja|grančica|grančice|list|lista|kriška|kriške|kriska|kriske)`
const DESCRIPTOR = String.raw`(?:to taste|po\s*želji|po\s*zelji|as needed|as desired|optional|for serving|za posluživanje|za posluzivanje|plus more(?: for [a-z ]+)?|for frying|za prženje|za przenje|divided|chopped|diced|grated|sliced|minced|crushed|melted|softened|beaten|cooked|boiled|peeled|trimmed|washed|freshly ground|shredded|cubed|halved|quartered|julienned|juiced|sifted|nasjeckano|narezano|ribani|rendana|sitno|krupno|po potrebi|approx\.?)`
const LEADING_UNIT_RE = new RegExp(`^(${AMOUNT}\\s*${UNIT})(?=\\s|$)\\s*(.+)$`, 'i')
const LEADING_RE = new RegExp(`^(${AMOUNT}\\s*${UNIT}?)(?=\\s|$)\\s*(.+)$`, 'i')
const TRAILING_RE = new RegExp(`^(.+?)\\s+(${AMOUNT}\\s*${UNIT})(?:\\s+(.+))?$`, 'i')
const TRAILING_DESCRIPTOR_RE = new RegExp(`^(.+?)\\s+(${DESCRIPTOR})$`, 'i')
const AMOUNT_WORD_RE = new RegExp(`(?:^|\\s)${AMOUNT_WORD}(?=\\s|$)`, 'i')
const UNIT_WORD_RE = new RegExp(`(?:^|\\s)${UNIT}(?=\\s|$)`, 'i')
const DESCRIPTOR_RE = new RegExp(`(?:^|\\s|,\\s*)${DESCRIPTOR}(?=$|\\s|,)`, 'i')

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

function formatAmount(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/(\d)\s*(?=(?:kg|g|mg|ml|l|cl|dl)\b)/gi, '$1 ')
    .trim()
}

function parseLeading(text, requireUnit = false) {
  const match = text.match(requireUnit ? LEADING_UNIT_RE : LEADING_RE)
  if (!match) return null
  const amount = formatAmount(match[1])
  const name = match[2]
    .replace(/^(a|an|the|of)\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (name.length < 2) return null
  return { name, amount }
}

function hasQuantity(text) {
  return /[\d½¼¾⅓⅔⅛]/.test(text) || AMOUNT_WORD_RE.test(text) || UNIT_WORD_RE.test(text)
}

function isDescriptor(text) {
  return DESCRIPTOR_RE.test(text)
}

function finish(name, note, extras, fallback) {
  let cleanName = String(name || '')
    .replace(/\s+/g, ' ')
    .replace(/^[,\-–:;]+/, '')
    .replace(/[,\-–:;]+$/, '')
    .trim()
    .replace(/^(a|an|the|of)\s+/i, '')
    .trim()

  if (cleanName.length < 2) cleanName = String(fallback || '').trim()

  const parts = [formatAmount(note), ...extras.map((item) => String(item).trim())].filter(Boolean)
  const cleanNote = parts.join(', ').replace(/\s+/g, ' ').trim()

  return {
    name: cleanName.slice(0, 80),
    note: cleanNote.slice(0, 120),
  }
}

// Turn one free-text ingredient line into a shopping item. The amount and
// preparation notes go into the note, so "Dijon mustard, 1 tsp" becomes
// "Dijon mustard" and "1 tsp". Parenthetical text also goes into the note.
export function ingredientToShopping(line) {
  let text = String(line == null ? '' : line)
    .replace(/\uFFFD/g, '')
    .replace(/^[\s\-*•·]+/, '')
    .replace(/[.;,]+$/, '')
    .replace(/\s+/g, ' ')
    .trim()

  if (!text) return null

  text = text.replace(/^(a|an|the|some)\s+/i, '').trim()
  if (!text) return null

  const extras = []
  text = text
    .replace(/\(([^)]*)\)/g, (_, inner) => {
      const clean = String(inner).replace(/\uFFFD/g, '').replace(/\s+/g, ' ').trim()
      if (clean) extras.push(clean)
      return ' '
    })
    .replace(/\s+/g, ' ')
    .trim()

  if (!text) return null

  const segments = text.split(',').map((part) => part.trim()).filter(Boolean)
  if (segments.length > 1) {
    const head = segments[0]
    const tail = segments.slice(1).join(', ')
    if (hasQuantity(tail) || isDescriptor(tail)) {
      const leading = parseLeading(head)
      return finish(
        leading ? leading.name : head,
        [leading ? leading.amount : '', tail].filter(Boolean).join(', '),
        extras,
        text
      )
    }
  }

  const leadingUnit = parseLeading(text, true)
  if (leadingUnit) {
    return finish(leadingUnit.name, leadingUnit.amount, extras, text)
  }

  const trailing = text.match(TRAILING_RE)
  if (trailing) {
    return finish(
      trailing[1],
      [trailing[2], trailing[3]].filter(Boolean).join(', '),
      extras,
      text
    )
  }

  const descriptor = text.match(TRAILING_DESCRIPTOR_RE)
  if (descriptor) {
    const leading = parseLeading(descriptor[1])
    return finish(
      leading ? leading.name : descriptor[1],
      [leading ? leading.amount : '', descriptor[2]].filter(Boolean).join(', '),
      extras,
      text
    )
  }

  const leading = parseLeading(text)
  if (leading) {
    return finish(leading.name, leading.amount, extras, text)
  }

  return finish(text, '', extras, text)
}
