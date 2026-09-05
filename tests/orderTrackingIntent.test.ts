import assert from 'node:assert/strict';
import test from 'node:test';
import { TabbyBrain } from '../src/services/tabbyBrain.ts';

test('order status and ETA questions route to the grocery agent', () => {
  for (const message of [
    'Where is my order?',
    'Track my latest order',
    'What is the status of my order?',
    'What is the delivery ETA?',
  ]) {
    assert.ok(TabbyBrain.detectIntents(message).includes('grocery'), message);
  }
});
