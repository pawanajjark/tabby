import assert from 'node:assert/strict';
import test from 'node:test';
import { purchasedPantryItems } from '../src/services/instamartPantry.ts';

test('purchased Instamart packs become actual pantry quantities', () => {
  const items = purchasedPantryItems([
    { ingredient: { name: 'tomatoes', quantity: 750, unit: 'g' }, productName: 'Fresh Tomato', pack: '500 g', quantity: 2, spinId: 'tomato', price: 32 },
    { ingredient: { name: 'eggs', quantity: 10, unit: 'items' }, productName: 'Fresh Eggs', pack: '6 pieces', quantity: 2, spinId: 'egg', price: 54 },
    { ingredient: { name: 'oil', quantity: 1, unit: 'l' }, productName: 'Sunflower Oil', pack: '1 L', quantity: 1, spinId: 'oil', price: 139 },
  ]);

  assert.deepEqual(items, [
    { name: 'Fresh Tomato', quantity: 1000, unit: 'g' },
    { name: 'Fresh Eggs', quantity: 12, unit: 'items' },
    { name: 'Sunflower Oil', quantity: 1000, unit: 'ml' },
  ]);
});

test('duplicate purchased products are combined before the pantry reducer call', () => {
  const item = { ingredient: { name: 'rice', quantity: 1, unit: 'kg' }, productName: 'Everyday Rice', pack: '1 kg', quantity: 1, spinId: 'rice', price: 100 };
  assert.deepEqual(purchasedPantryItems([item, item]), [{ name: 'Everyday Rice', quantity: 2000, unit: 'g' }]);
});
