// Meal plan checks. Run with: npm run check
import assert from 'node:assert/strict'
import {
  HOT_THRESHOLD,
  climateFor,
  climateScore,
  pickSurpriseRecipe,
  planDates,
  ingredientToShopping,
} from '../src/lib/mealPlan.js'

const soup = {
  id: 'soup',
  title: 'Winter vegetable soup',
  tags: ['winter'],
  ingredients: ['1 onion', '500 g carrots'],
  steps: ['Cook slowly in a pot.'],
  notes: '',
}

const salad = {
  id: 'salad',
  title: 'Fresh tomato salad',
  tags: ['summer'],
  ingredients: ['2 tomatoes', '1 cucumber'],
  steps: ['Chill before serving.'],
  notes: '',
}

const stew = {
  id: 'stew',
  title: 'Beef stew',
  tags: [],
  ingredients: ['500 g beef'],
  steps: ['Cook in the oven for 2 hours.'],
  notes: '',
}

// The owner set the warm-day threshold at 18 C. Exactly 18 is still cool.
assert.equal(HOT_THRESHOLD, 18)
assert.equal(climateFor(17.9), 'cold')
assert.equal(climateFor(18), 'cold')
assert.equal(climateFor(18.1), 'hot')
assert.equal(climateFor(null), 'any')

// Climate scoring ranks warm and light dishes in the right direction.
assert.ok(climateScore(soup, 'cold') > climateScore(soup, 'hot'))
assert.ok(climateScore(salad, 'hot') > climateScore(salad, 'cold'))

// The home recipe titles are Croatian. The climate words cover both.
const sarma = { id: 'sarma', title: 'Sarma', tags: ['zima'], ingredients: [], steps: [] }
const salata = { id: 'salata', title: 'Salata', tags: ['ljeto'], ingredients: [], steps: [] }
assert.ok(climateScore(sarma, 'cold') > 0)
assert.ok(climateScore(salata, 'hot') > 0)

// A cool day picks warm food.
const coldPick = pickSurpriseRecipe([soup, salad], { temp: 8, random: () => 0 })
assert.equal(coldPick.recipe.id, 'soup')
assert.equal(coldPick.mode, 'cold')
assert.equal(coldPick.matched, true)

// A warm day picks light food.
const hotPick = pickSurpriseRecipe([soup, salad], { temp: 24, random: () => 0 })
assert.equal(hotPick.recipe.id, 'salad')
assert.equal(hotPick.mode, 'hot')
assert.equal(hotPick.matched, true)

// The current meal is avoided when another matching recipe exists.
const avoidPick = pickSurpriseRecipe([soup, stew], {
  temp: 8,
  currentId: 'soup',
  random: () => 0,
})
assert.equal(avoidPick.recipe.id, 'stew')

// A day with no matching recipe still returns a recipe.
const noMatch = pickSurpriseRecipe([soup, stew], { temp: 24, random: () => 0 })
assert.equal(noMatch.matched, false)
assert.ok(noMatch.recipe.id)

// The next seven days start at the given day.
const days = planDates(new Date(2026, 10, 8, 12, 0), 7)
assert.equal(days.length, 7)
assert.equal(days[0].key, '2026-11-08')
assert.equal(days[6].key, '2026-11-14')

// Ingredient lines become a name and a note.
const cases = [
  ['500 g minced meat', 'minced meat', '500 g'],
  ['1 sour cabbage', 'sour cabbage', '1'],
  ['2 tbsp olive oil', 'olive oil', '2 tbsp'],
  ['1-2 cloves garlic', 'garlic', '1-2 cloves'],
  ['½ cup milk', 'milk', '½ cup'],
  ['1 1/2 cups flour', 'flour', '1 1/2 cups'],
  ['- 3 eggs', 'eggs', '3'],
  ['400 g tin chopped tomatoes', 'tin chopped tomatoes', '400 g'],
  ['Salt to taste', 'Salt to taste', ''],
  ['Juice of 1 lemon', 'Juice of 1 lemon', ''],
]

for (const [line, name, note] of cases) {
  const item = ingredientToShopping(line)
  assert.equal(item.name, name, line)
  assert.equal(item.note, note, line)
}

assert.equal(ingredientToShopping('   '), null)
assert.deepEqual(ingredientToShopping('• Basil'), { name: 'Basil', note: '' })

console.log('meal plan checks passed')
