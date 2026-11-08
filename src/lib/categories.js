export const CATEGORIES = [
  'Produce',
  'Bakery',
  'Dairy & Eggs',
  'Meat & Fish',
  'Pantry',
  'Frozen',
  'Drinks',
  'Household',
  'Other',
]

const RULES = [
  ['Dairy & Eggs', /milk|butter|cheese|yog|egg|cream|kerrygold|cheddar|fromage/],
  ['Bakery', /bread|bagel|bun\b|buns|wrap|pitta|croissant|roll|brennans|sourdough|baguette/],
  ['Produce', /banana|apple|spud|potato|onion|carrot|tomato|lettuce|salad|orange|berr|avocado|pepper|cucumber|broccoli|mushroom|lemon|garlic|grape|spinach|fruit|veg\b|cabbage|leek|celery|courgette|zucchini|pumpkin|beet|radish|parsley|basil|thyme|rosemary|herb/],
  ['Meat & Fish', /chicken|beef|pork|rasher|bacon|sausage|mince|salmon|fish|prawn|turkey|steak|ham\b|lamb/],
  ['Frozen', /frozen|ice cream|peas|chips|pizza/],
  ['Drinks', /juice|water|coke|cola|beer|wine|lemonade|soda|sparkling|kombucha/],
  ['Household', /washing|soap|shampoo|toilet|tissue|bin bag|bleach|sponge|detergent|dishwasher|foil|paper towel|cleaning/],
  ['Pantry', /tea|coffee|pasta|rice|sauce|bean|tinned|can\b|cereal|flour|sugar|oil|salt|soup|barry|spaghetti|couscous|stock|mayonnaise|ketchup|jam|peanut|biscuit|crisp|chocolate|honey|oats/],
]

export function guessCategory(name) {
  const text = String(name || '').toLowerCase()
  for (const [category, rule] of RULES) {
    if (rule.test(text)) return category
  }
  return 'Other'
}

export function categoryOrder(category) {
  const index = CATEGORIES.indexOf(category)
  return index === -1 ? CATEGORIES.length : index
}
