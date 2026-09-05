import assert from 'node:assert/strict';
import test from 'node:test';
import { selectFlatRoommates } from '../src/services/roommateList.ts';

test('shows only the active flat and keeps a deterministic order', () => {
  const rows = [
    { identityHex: 'b-id', flatId: '1', displayName: 'Sam' },
    { identityHex: 'other-flat', flatId: '2', displayName: 'Alex' },
    { identityHex: 'current-id', flatId: '1', displayName: 'Pawan' },
    { identityHex: 'a-id', flatId: '1', displayName: 'Sam' },
  ];

  assert.deepEqual(
    selectFlatRoommates(rows, '1', 'current-id').map(row => row.identityHex),
    ['current-id', 'a-id'],
  );
});
