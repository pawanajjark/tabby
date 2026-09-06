import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const mainSource = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
const packageSource = readFileSync(new URL('../package.json', import.meta.url), 'utf8');

test('restored shopping and recipe cards retain the payload needed by their actions', () => {
  assert.match(mainSource, /data-shop-items="\$\{encodeActionPayload\(shoppingItems\)\}"/);
  assert.match(mainSource, /data-recipe-payload="\$\{encodeActionPayload\(recipe\)\}"/);
  assert.match(mainSource, /decodeActionPayload<RecipeIngredient\[\]>\(button\.dataset\.shopItems\)/);
  assert.match(mainSource, /decodeActionPayload<Recipe>\(host\?\.dataset\.recipePayload\)/);
});

test('the recipe action reveals missing items and prepares a detailed checkout review', () => {
  assert.match(mainSource, /data-cook-recipe=/);
  assert.match(mainSource, /Order these items from Instamart:/);
  assert.match(mainSource, /data-cook-checkout>Checkout groceries/);
  assert.match(mainSource, /AgentInstamart\.prepareRecipeCart\(ingredients,/);
  assert.match(mainSource, /renderInstamartReview\(prepared\)/);
  assert.match(mainSource, /Confirm and place order/);
  assert.match(mainSource, /AgentInstamart\.checkout\(sessionId, priorState\)/);
  assert.match(mainSource, /purchasedPantryItems\(prepared\.matches\)/);
  assert.match(mainSource, /confirmShoppingOrderToPantry/);
  assert.match(mainSource, /Discount \(\$\{pricing\.coupon\}\)/);
  assert.match(mainSource, /pricing\.discount > 0/);
  assert.match(mainSource, /Total to pay/);
});

test('every shopping entry point requires a synchronized selected home', () => {
  assert.match(mainSource, /document\.querySelectorAll<HTMLButtonElement>\('\[data-shop-list\]'\)[\s\S]*?button\.disabled = !shared\.available/);
  assert.match(mainSource, /document\.querySelectorAll<HTMLButtonElement>\('\[data-cook-recipe\]'\)[\s\S]*?button\.disabled = !shared\.available/);
});

test('the parent development command owns the Instamart service lifecycle', () => {
  const packageJson = JSON.parse(packageSource) as { scripts: Record<string, string> };
  assert.equal(packageJson.scripts.dev, 'node scripts/dev.mjs');
  assert.equal(packageJson.scripts['dev:instamart'], 'npm --prefix instamart-mcp run dev');
});

test('order status requests use the latest synchronized shopping state and persist tracking results', () => {
  assert.match(mainSource, /latestOrderedShoppingState\(`conversation:\$\{activeConversationId\}`\)/);
  assert.match(mainSource, /AgentInstamart\.trackLatestOrder\(state\)/);
  assert.match(mainSource, /await persistShoppingState\(tracking\.state\)/);
  assert.match(mainSource, /Latest ETA:/);
});
