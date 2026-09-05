import assert from 'node:assert/strict';
import test from 'node:test';
import { peopleListPresentation } from '../src/services/roommateList.ts';

test('does not present an empty household before the subscription is applied', () => {
  assert.deepEqual(peopleListPresentation(false, 0), {
    countLabel: '—',
    emptyMessage: 'Loading people…',
    showRows: false,
  });
});

test('presents a synchronized empty household accurately', () => {
  assert.deepEqual(peopleListPresentation(true, 0), {
    countLabel: '0',
    emptyMessage: 'People appear after they choose Join Flat.',
    showRows: false,
  });
});
