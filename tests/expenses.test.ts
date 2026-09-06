import assert from 'node:assert/strict';
import test from 'node:test';
import { projectExpenseBalances, renderExpenseBalances } from '../src/features/household/expenses.ts';
import { paiseInputValue, renderBillReview, rupeeInputToPaise } from '../src/features/household/billing.ts';

const identity = (value: string) => ({ toHexString: () => value });

test('bill allocation inputs translate between stored paise and displayed rupees', () => {
  assert.equal(paiseInputValue(60_000n), '600');
  assert.equal(paiseInputValue(60_050n), '600.50');
  assert.equal(rupeeInputToPaise('600'), 60_000n);
  assert.equal(rupeeInputToPaise('600.50'), 60_050n);
  assert.throws(() => rupeeInputToPaise('600.999'), /valid rupee amount/);
});

test('an equal split makes each non-payer owe the payer while the payer share is not debt', () => {
  const a = identity('asha');
  const d = identity('dev');
  const m = identity('mira');

  const projection = projectExpenseBalances({
    currentIdentity: d,
    members: [
      { identity: a, displayName: 'Asha' },
      { identity: d, displayName: 'Dev' },
      { identity: m, displayName: 'Mira' },
    ],
    expenses: [{ id: 10n, title: 'Saturday groceries', amountPaise: 84_000n, paidBy: a, category: 'groceries' }],
    metadata: [{ expenseId: 10n, expenseDateMicros: 1_725_552_000_000_000n, recordedAtMicros: 1_725_552_000_000_000n, splitMethod: 'equal' }],
    splits: [
      { id: 1n, expenseId: 10n, memberIdentity: a, amountPaise: 28_000n, settled: true, reason: 'Equal split' },
      { id: 2n, expenseId: 10n, memberIdentity: d, amountPaise: 28_000n, settled: false, reason: 'Equal split' },
      { id: 3n, expenseId: 10n, memberIdentity: m, amountPaise: 28_000n, settled: false, reason: 'Equal split' },
    ],
    settlements: [],
  });

  assert.deepEqual(projection.summary, { youOwePaise: 28_000n, youAreOwedPaise: 0n, netPaise: -28_000n });
  assert.deepEqual(
    projection.balances.map(balance => [balance.debtorName, balance.creditorName, balance.amountPaise]),
    [['Dev', 'Asha', 28_000n], ['Mira', 'Asha', 28_000n]],
  );
  assert.equal(projection.history[0]?.payerName, 'Asha');
  assert.equal(projection.history[0]?.shares.find(share => share.memberName === 'Asha')?.isDebt, false);
});

test('the expenses route renders balances, history, and settle actions from synchronized data', () => {
  const a = identity('asha');
  const d = identity('dev');
  const projection = projectExpenseBalances({
    currentIdentity: d,
    members: [{ identity: a, displayName: 'Asha' }, { identity: d, displayName: 'Dev' }],
    expenses: [{ id: 10n, title: 'Saturday groceries', amountPaise: 56_000n, paidBy: a, category: 'groceries' }],
    metadata: [{ expenseId: 10n, expenseDateMicros: 1_725_552_000_000_000n, recordedAtMicros: 1_725_552_000_000_000n, splitMethod: 'equal' }],
    splits: [
      { id: 1n, expenseId: 10n, memberIdentity: a, amountPaise: 28_000n, settled: true, reason: 'Equal split' },
      { id: 2n, expenseId: 10n, memberIdentity: d, amountPaise: 28_000n, settled: false, reason: 'Equal split' },
    ],
    settlements: [],
  });

  const html = renderExpenseBalances(projection, { online: true });

  assert.match(html, /You owe/i);
  assert.match(html, /Who owes whom/i);
  assert.match(html, /Dev owes Asha/);
  assert.match(html, /Recent expenses/i);
  assert.match(html, /Saturday groceries/);
  assert.match(html, /Equal split/i);
  assert.match(html, /data-settle-counterparty="asha"/);
});

test('the expenses route explains a newly recorded expense', () => {
  const a = identity('asha');
  const d = identity('dev');
  const projection = projectExpenseBalances({
    currentIdentity: d,
    members: [{ identity: a, displayName: 'Asha' }, { identity: d, displayName: 'Dev' }],
    expenses: [{ id: 10n, title: 'E2E groceries', amountPaise: 100n, paidBy: a, category: 'groceries' }],
    metadata: [{ expenseId: 10n, expenseDateMicros: 1_725_552_000_000_000n, recordedAtMicros: 1_725_552_000_000_000n, splitMethod: 'equal' }],
    splits: [
      { id: 1n, expenseId: 10n, memberIdentity: a, amountPaise: 50n, settled: true, reason: 'Equal split' },
      { id: 2n, expenseId: 10n, memberIdentity: d, amountPaise: 50n, settled: false, reason: 'Equal split' },
    ],
    settlements: [],
  });

  const html = renderExpenseBalances(projection, {
    online: true,
    currentIdentity: d.toHexString(),
    recentlyRecorded: { title: 'E2E groceries', amountPaise: 100n, ownSharePaise: 50n },
  });

  assert.match(html, /Expense recorded/);
  assert.match(html, /E2E groceries/);
  assert.match(html, /Your share/);
  assert.match(html, /₹0\.50/);
  assert.match(html, /Balances are live/);
  assert.match(html, /expense-history-item is-latest/);
  assert.doesNotMatch(html, /Bill review is a preview/);
});

test('settlement activity keeps a dated audit trail after an open balance is cleared', () => {
  const a = identity('asha');
  const d = identity('dev');
  const projection = projectExpenseBalances({
    currentIdentity: d,
    members: [{ identity: a, displayName: 'Asha' }, { identity: d, displayName: 'Dev' }],
    expenses: [{ id: 10n, title: 'Saturday groceries', amountPaise: 56_000n, paidBy: a, category: 'groceries' }],
    metadata: [{ expenseId: 10n, expenseDateMicros: 1_725_552_000_000_000n, recordedAtMicros: 1_725_552_000_000_000n, splitMethod: 'equal' }],
    splits: [
      { id: 1n, expenseId: 10n, memberIdentity: a, amountPaise: 28_000n, settled: true, reason: 'Equal split' },
      { id: 2n, expenseId: 10n, memberIdentity: d, amountPaise: 28_000n, settled: true, reason: 'Equal split' },
    ],
    settlements: [{ id: 7n, debtorIdentity: d, creditorIdentity: a, amountPaise: 28_000n, settledAtMicros: 1_725_638_400_000_000n }],
  });

  const html = renderExpenseBalances(projection, { online: true });

  assert.deepEqual(projection.summary, { youOwePaise: 0n, youAreOwedPaise: 0n, netPaise: 0n });
  assert.match(html, /Settlement activity/i);
  assert.match(html, /Dev paid Asha/);
  assert.match(html, /₹280/);
});

test('a recorded bill no longer describes allocations as preview-only or offers to record twice', () => {
  const member = { identity: identity('browser-qa'), displayName: 'Browser QA' };
  const html = renderBillReview({
    title: 'Browser test groceries',
    category: 'general',
    payer: member,
    expenseDateMicros: 1_725_552_000_000_000n,
    lines: [{
      id: 'groceries',
      label: 'Groceries',
      amountPaise: 84_000n,
      allocations: [{ member, amountPaise: 84_000n, exempt: false, reason: '' }],
    }],
  }, true, { step: 'recorded', reviewId: 10n, acknowledgement: { status: 'acknowledged' } });

  assert.doesNotMatch(html, /original backend|preview only/i);
  assert.match(html, /Recorded/);
  assert.match(html, /data-record-bill disabled/);
  assert.match(html, /bill-review-header/);
  assert.match(html, /bill-review-total/);
  assert.match(html, /bill-review-section/);
  assert.match(html, /bill-share-field/);
  assert.match(html, /share in rupees/);
  assert.match(html, /data-allocation-unit="rupees" value="840"/);
  assert.doesNotMatch(html, /value="84000"/);
});
