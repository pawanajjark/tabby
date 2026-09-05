import assert from 'node:assert/strict';
import test from 'node:test';
import { createSubscriptionGroups } from '../src/services/subscriptionPlan.ts';

test('loads people independently before the rest of the household', () => {
  const member = Symbol('member');
  const residence = Symbol('residence');
  const pantry = Symbol('pantry');

  assert.deepEqual(createSubscriptionGroups(member, [residence, pantry]), [
    { scope: 'people', tables: [member] },
    { scope: 'household', tables: [residence, pantry] },
  ]);
});
