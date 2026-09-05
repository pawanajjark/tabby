export interface ExpenseIdentity {
  toHexString(): string;
}

export interface ExpenseMember {
  identity: ExpenseIdentity;
  displayName: string;
}

export interface ExpenseRecord {
  id: bigint;
  title: string;
  amountPaise: bigint;
  paidBy: ExpenseIdentity;
  category: string;
}

export interface ExpenseMetadataRecord {
  expenseId: bigint;
  expenseDateMicros: bigint;
  recordedAtMicros: bigint;
  splitMethod: string;
}

export interface ExpenseSplitRecord {
  id: bigint;
  expenseId: bigint;
  memberIdentity: ExpenseIdentity;
  amountPaise: bigint;
  settled: boolean;
  reason: string;
}

export interface ExpenseSettlementRecord {
  id: bigint;
  debtorIdentity: ExpenseIdentity;
  creditorIdentity: ExpenseIdentity;
  amountPaise: bigint;
  settledAtMicros: bigint;
}

export interface ExpenseBalanceInput {
  currentIdentity: ExpenseIdentity;
  members: readonly ExpenseMember[];
  expenses: readonly ExpenseRecord[];
  metadata: readonly ExpenseMetadataRecord[];
  splits: readonly ExpenseSplitRecord[];
  settlements: readonly ExpenseSettlementRecord[];
}

export interface PairwiseExpenseBalance {
  debtorIdentity: string;
  debtorName: string;
  creditorIdentity: string;
  creditorName: string;
  amountPaise: bigint;
}

export interface ExpenseHistoryItem {
  id: bigint;
  title: string;
  amountPaise: bigint;
  payerIdentity: string;
  payerName: string;
  category: string;
  expenseDateMicros?: bigint;
  recordedAtMicros?: bigint;
  splitMethod: string;
  settled: boolean;
  shares: Array<{
    memberIdentity: string;
    memberName: string;
    amountPaise: bigint;
    settled: boolean;
    isDebt: boolean;
    reason: string;
  }>;
}

export interface ExpenseBalanceProjection {
  currentIdentity: string;
  summary: { youOwePaise: bigint; youAreOwedPaise: bigint; netPaise: bigint };
  balances: PairwiseExpenseBalance[];
  history: ExpenseHistoryItem[];
  settlements: Array<{
    id: bigint;
    debtorName: string;
    creditorName: string;
    amountPaise: bigint;
    settledAtMicros: bigint;
  }>;
}

function identityHex(identity: ExpenseIdentity): string {
  return identity.toHexString();
}

export function projectExpenseBalances(input: ExpenseBalanceInput): ExpenseBalanceProjection {
  const currentIdentity = identityHex(input.currentIdentity);
  const memberNames = new Map(input.members.map(member => [identityHex(member.identity), member.displayName]));
  const expenses = new Map(input.expenses.map(expense => [expense.id, expense]));
  const metadata = new Map(input.metadata.map(item => [item.expenseId, item]));
  const directed = new Map<string, { debtor: string; creditor: string; amountPaise: bigint }>();

  for (const split of input.splits) {
    const expense = expenses.get(split.expenseId);
    if (!expense || split.settled) continue;
    const debtor = identityHex(split.memberIdentity);
    const creditor = identityHex(expense.paidBy);
    if (debtor === creditor) continue;
    const key = `${debtor}\u0000${creditor}`;
    const existing = directed.get(key);
    directed.set(key, { debtor, creditor, amountPaise: (existing?.amountPaise ?? 0n) + split.amountPaise });
  }

  const seenPairs = new Set<string>();
  const balances: PairwiseExpenseBalance[] = [];
  for (const entry of directed.values()) {
    const pairKey = [entry.debtor, entry.creditor].sort().join('\u0000');
    if (seenPairs.has(pairKey)) continue;
    seenPairs.add(pairKey);
    const reverse = directed.get(`${entry.creditor}\u0000${entry.debtor}`)?.amountPaise ?? 0n;
    const difference = entry.amountPaise - reverse;
    if (difference === 0n) continue;
    const debtorIdentity = difference > 0n ? entry.debtor : entry.creditor;
    const creditorIdentity = difference > 0n ? entry.creditor : entry.debtor;
    balances.push({
      debtorIdentity,
      debtorName: memberNames.get(debtorIdentity) ?? 'Household member',
      creditorIdentity,
      creditorName: memberNames.get(creditorIdentity) ?? 'Household member',
      amountPaise: difference > 0n ? difference : -difference,
    });
  }

  let youOwePaise = 0n;
  let youAreOwedPaise = 0n;
  for (const balance of balances) {
    if (balance.debtorIdentity === currentIdentity) youOwePaise += balance.amountPaise;
    if (balance.creditorIdentity === currentIdentity) youAreOwedPaise += balance.amountPaise;
  }

  const history: ExpenseHistoryItem[] = input.expenses.map(expense => {
    const payerIdentity = identityHex(expense.paidBy);
    const expenseMetadata = metadata.get(expense.id);
    const shares = input.splits
      .filter(split => split.expenseId === expense.id)
      .map(split => {
        const memberIdentity = identityHex(split.memberIdentity);
        return {
          memberIdentity,
          memberName: memberNames.get(memberIdentity) ?? 'Household member',
          amountPaise: split.amountPaise,
          settled: split.settled,
          isDebt: memberIdentity !== payerIdentity && !split.settled,
          reason: split.reason,
        };
      });
    return {
      id: expense.id,
      title: expense.title,
      amountPaise: expense.amountPaise,
      payerIdentity,
      payerName: memberNames.get(payerIdentity) ?? 'Household member',
      category: expense.category,
      expenseDateMicros: expenseMetadata?.expenseDateMicros,
      recordedAtMicros: expenseMetadata?.recordedAtMicros,
      splitMethod: expenseMetadata?.splitMethod || shares[0]?.reason || 'Unknown split',
      settled: shares.every(share => share.settled),
      shares,
    };
  }).sort((left, right) => Number((right.expenseDateMicros ?? right.recordedAtMicros ?? 0n) - (left.expenseDateMicros ?? left.recordedAtMicros ?? 0n)));

  return {
    currentIdentity,
    summary: { youOwePaise, youAreOwedPaise, netPaise: youAreOwedPaise - youOwePaise },
    balances,
    history,
    settlements: input.settlements.map(settlement => ({
      id: settlement.id,
      debtorName: memberNames.get(identityHex(settlement.debtorIdentity)) ?? 'Household member',
      creditorName: memberNames.get(identityHex(settlement.creditorIdentity)) ?? 'Household member',
      amountPaise: settlement.amountPaise,
      settledAtMicros: settlement.settledAtMicros,
    })).sort((left, right) => Number(right.settledAtMicros - left.settledAtMicros)),
  };
}

function moneyLabel(value: bigint): string {
  const sign = value < 0n ? '-' : '';
  const absolute = value < 0n ? -value : value;
  const rupees = absolute / 100n;
  const paise = absolute % 100n;
  return `${sign}₹${rupees.toLocaleString('en-IN')}${paise === 0n ? '' : `.${String(paise).padStart(2, '0')}`}`;
}

function splitMethodLabel(value: string): string {
  const normalized = value.trim().toLocaleLowerCase();
  if (normalized === 'equal' || normalized === 'equal split') return 'Equal split';
  if (normalized === 'adjusted' || normalized === 'adjusted split') return 'Adjusted split';
  return value.trim() || 'Split unavailable';
}

function expenseDateLabel(item: ExpenseHistoryItem): string {
  const micros = item.expenseDateMicros ?? item.recordedAtMicros;
  if (micros === undefined || micros === 0n) return 'Date unavailable';
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
    .format(new Date(Number(micros / 1_000n)));
}

function timestampLabel(micros: bigint): string {
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
    .format(new Date(Number(micros / 1_000n)));
}

export function renderExpenseBalances(
  projection: ExpenseBalanceProjection,
  options: { online: boolean; currentIdentity?: string } = { online: true },
): string {
  const currentIdentity = options.currentIdentity ?? projection.currentIdentity;
  const summary = projection.summary;
  const balances = projection.balances.length
    ? projection.balances.map(balance => {
      const counterparty = balance.debtorIdentity === currentIdentity
        ? balance.creditorIdentity
        : balance.debtorIdentity;
      const canSettle = !currentIdentity || balance.debtorIdentity === currentIdentity || balance.creditorIdentity === currentIdentity;
      return `<article class="expense-balance-row">
        <span class="expense-avatar" aria-hidden="true">${escapeHouseholdHtml(balance.debtorName.slice(0, 1).toUpperCase())}</span>
        <div><strong>${escapeHouseholdHtml(balance.debtorName)} owes ${escapeHouseholdHtml(balance.creditorName)}</strong><small>Outstanding household balance</small></div>
        <strong>${moneyLabel(balance.amountPaise)}</strong>
        <button type="button" data-settle-counterparty="${escapeHouseholdHtml(counterparty)}" ${!options.online || !canSettle ? 'disabled' : ''}>Settle up</button>
      </article>`;
    }).join('')
    : '<div class="expenses-zero"><strong>Nothing to settle</strong><p>Everyone is square for recorded expenses.</p></div>';

  const history = projection.history.length
    ? projection.history.map((item, index) => `<details class="expense-history-item" data-expense-id="${item.id}" ${index === 0 ? 'open' : ''}>
      <summary>
        <span><strong>${escapeHouseholdHtml(item.title)}</strong><small>${escapeHouseholdHtml(expenseDateLabel(item))} · Paid by ${escapeHouseholdHtml(item.payerName)} · ${escapeHouseholdHtml(splitMethodLabel(item.splitMethod))}</small></span>
        <span><strong>${moneyLabel(item.amountPaise)}</strong><small>${item.settled ? 'Settled' : 'Open'}</small></span>
      </summary>
      <div class="expense-share-list">${item.shares.map(share => `<div>
        <span><strong>${escapeHouseholdHtml(share.memberName)}</strong><small>${share.memberIdentity === item.payerIdentity ? 'Own share · no debt' : share.settled ? 'Settled' : `Owes ${escapeHouseholdHtml(item.payerName)}`}</small></span>
        <strong>${moneyLabel(share.amountPaise)}</strong>
      </div>`).join('')}</div>
    </details>`).join('')
    : '<div class="expenses-empty"><p class="eyebrow">EMPTY</p><h2>No recorded expenses yet</h2><p>Review and record a bill to create balances and history.</p><button type="button" data-route="conversations">Record first expense</button></div>';

  const settlementActivity = projection.settlements.length
    ? `<section class="expense-section"><header><p class="eyebrow">AUDIT TRAIL</p><h2>Settlement activity</h2></header><div class="expense-settlement-list">${projection.settlements.map(settlement => `<article>
      <span><strong>${escapeHouseholdHtml(settlement.debtorName)} paid ${escapeHouseholdHtml(settlement.creditorName)}</strong><small>${escapeHouseholdHtml(timestampLabel(settlement.settledAtMicros))}</small></span>
      <strong>${moneyLabel(settlement.amountPaise)}</strong>
    </article>`).join('')}</div></section>`
    : '';

  return `<section class="expenses-route" data-household-route="expenses">
    <header class="expenses-route-header"><div><p class="eyebrow">SHARED HOUSEHOLD</p><h1>Expenses &amp; balances</h1><p>Bill review is a preview. Balances change only after recording succeeds.</p></div><button type="button" data-route="conversations">Add expense</button></header>
    ${options.online ? '' : '<p class="expenses-offline" role="status">Offline · shared balance actions are paused. Reconnect to settle up.</p>'}
    <div class="expense-summary-grid">
      <article><span>You owe</span><strong>${moneyLabel(summary.youOwePaise)}</strong></article>
      <article><span>You are owed</span><strong>${moneyLabel(summary.youAreOwedPaise)}</strong></article>
      <article><span>Net balance</span><strong>${moneyLabel(summary.netPaise)}</strong><small>${summary.netPaise < 0n ? 'You owe more than you are owed' : summary.netPaise > 0n ? 'You are owed more than you owe' : 'All square'}</small></article>
    </div>
    <section class="expense-section"><header><p class="eyebrow">OPEN BALANCES</p><h2>Who owes whom</h2></header><div class="expense-balance-list">${balances}</div></section>
    <section class="expense-section"><header><p class="eyebrow">HOUSEHOLD LEDGER</p><h2>Recent expenses</h2></header><div class="expense-history-list">${history}</div></section>
    ${settlementActivity}
  </section>`;
}
import { escapeHouseholdHtml } from './html.ts';
