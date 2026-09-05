import type { AcknowledgementState, HouseholdAction, IdentityRef } from './actions.ts';
import { escapeHouseholdHtml, paiseLabel } from './html.ts';

export interface BillMember {
  identity: IdentityRef;
  displayName: string;
}

export interface BillLineAllocation {
  member: BillMember;
  amountPaise: bigint;
  exempt: boolean;
  reason: string;
  persistedId?: bigint;
}

export interface BillLine {
  id: string;
  persistedId?: bigint;
  label: string;
  amountPaise: bigint;
  allocations: BillLineAllocation[];
}

export interface BillDraft {
  title: string;
  category: string;
  payer: BillMember;
  expenseDateMicros: bigint;
  lines: BillLine[];
}

export interface BillTotals {
  billPaise: bigint;
  allocatedPaise: bigint;
  unallocatedPaise: bigint;
  lineErrors: Array<{ lineId: string; differencePaise: bigint }>;
  valid: boolean;
}

export type BillRecordPhase =
  | { step: 'editing'; acknowledgement: AcknowledgementState }
  | { step: 'creating-review'; acknowledgement: AcknowledgementState }
  | { step: 'persisting-lines'; acknowledgement: AcknowledgementState; reviewId: bigint }
  | { step: 'allocating'; acknowledgement: AcknowledgementState; reviewId: bigint }
  | { step: 'recording'; acknowledgement: AcknowledgementState; reviewId: bigint }
  | { step: 'recorded'; acknowledgement: { status: 'acknowledged' }; reviewId: bigint };

export function setBillPayer(draft: BillDraft, payer: BillMember): BillDraft {
  return { ...draft, payer };
}

export function setBillDate(draft: BillDraft, expenseDateMicros: bigint): BillDraft {
  return { ...draft, expenseDateMicros };
}

export function assignBillLine(
  draft: BillDraft,
  lineId: string,
  member: BillMember,
  amountPaise: bigint,
  options: { exempt?: boolean; reason?: string } = {},
): BillDraft {
  if (amountPaise < 0n) throw new Error('Allocation cannot be negative.');
  return {
    ...draft,
    lines: draft.lines.map(line => {
      if (line.id !== lineId) return line;
      const memberHex = member.identity.toHexString();
      const previous = line.allocations.find(allocation => allocation.member.identity.toHexString() === memberHex);
      const replacement: BillLineAllocation = {
        member,
        amountPaise: options.exempt ? 0n : amountPaise,
        exempt: options.exempt ?? false,
        reason: options.reason?.trim() ?? '',
        persistedId: previous?.persistedId,
      };
      return {
        ...line,
        allocations: [
          ...line.allocations.filter(allocation => allocation.member.identity.toHexString() !== memberHex),
          replacement,
        ],
      };
    }),
  };
}

export function billTotals(draft: BillDraft): BillTotals {
  const billPaise = draft.lines.reduce((total, line) => total + line.amountPaise, 0n);
  let allocatedPaise = 0n;
  const lineErrors = draft.lines.flatMap(line => {
    const allocated = line.allocations.reduce(
      (total, allocation) => total + (allocation.exempt ? 0n : allocation.amountPaise),
      0n,
    );
    allocatedPaise += allocated;
    const differencePaise = line.amountPaise - allocated;
    return differencePaise === 0n ? [] : [{ lineId: line.id, differencePaise }];
  });
  return {
    billPaise,
    allocatedPaise,
    unallocatedPaise: billPaise - allocatedPaise,
    lineErrors,
    valid: draft.lines.length > 0 && billPaise > 0n && lineErrors.length === 0,
  };
}

export function billRecordControl(draft: BillDraft, online: boolean, phase: BillRecordPhase) {
  const totals = billTotals(draft);
  if (!online) return { disabled: true, reason: 'Reconnect to record this bill.' };
  if (!totals.valid) return { disabled: true, reason: 'Allocate every line before recording.' };
  if (phase.acknowledgement.status === 'submitting') return { disabled: true, reason: 'Waiting for the home to confirm.' };
  if (phase.step === 'recorded') return { disabled: true, reason: 'Bill recorded.' };
  return { disabled: false, reason: '' };
}

export function createBillReviewAction(draft: BillDraft): HouseholdAction {
  const totals = billTotals(draft);
  if (!totals.valid) throw new Error('Bill allocations must match every line before review.');
  return {
    reducer: 'createBillReview',
    payload: {
      title: draft.title.trim(),
      amountPaise: totals.billPaise,
      paidBy: draft.payer.identity,
      expenseDate: { microsSinceUnixEpoch: draft.expenseDateMicros },
      category: draft.category.trim() || 'general',
    },
  };
}

export function billLineActions(draft: BillDraft, reviewId: bigint): HouseholdAction[] {
  return draft.lines.map((line, position) => ({
    reducer: 'upsertBillLine',
    payload: {
      id: line.persistedId ?? 0n,
      billReviewId: reviewId,
      lineKey: line.id,
      label: line.label,
      amountPaise: line.amountPaise,
      position,
    },
  }));
}

export function billAllocationActions(
  draft: BillDraft,
  reviewId: bigint,
  subscribedLineIds: ReadonlyMap<string, bigint> = new Map(),
): HouseholdAction[] {
  return draft.lines.flatMap(line => {
    const billLineId = line.persistedId ?? subscribedLineIds.get(line.id);
    if (billLineId === undefined) throw new Error(`Wait for bill line acknowledgement: ${line.id}.`);
    return line.allocations.map(allocation => ({
      reducer: 'upsertBillLineAllocation' as const,
      payload: {
        id: allocation.persistedId ?? 0n,
        billReviewId: reviewId,
        billLineId,
        memberIdentity: allocation.member.identity,
        amountPaise: allocation.amountPaise,
        exempt: allocation.exempt,
        reason: allocation.reason,
      },
    }));
  });
}

export function startBillRecord(draft: BillDraft, online: boolean): BillRecordPhase {
  const control = billRecordControl(draft, online, { step: 'editing', acknowledgement: { status: 'idle' } });
  return control.disabled
    ? { step: 'editing', acknowledgement: { status: 'rejected', message: control.reason } }
    : { step: 'creating-review', acknowledgement: { status: 'submitting' } };
}

export function billReviewAcknowledged(reviewId: bigint): BillRecordPhase {
  return { step: 'persisting-lines', reviewId, acknowledgement: { status: 'submitting' } };
}

export function billLinesAcknowledged(reviewId: bigint): BillRecordPhase {
  return { step: 'allocating', reviewId, acknowledgement: { status: 'submitting' } };
}

export function billAllocationsAcknowledged(reviewId: bigint): BillRecordPhase {
  return { step: 'recording', reviewId, acknowledgement: { status: 'submitting' } };
}

export function billRecordingAcknowledged(reviewId: bigint): BillRecordPhase {
  return { step: 'recorded', reviewId, acknowledgement: { status: 'acknowledged' } };
}

export function billRecordRejected(phase: BillRecordPhase, message: string): BillRecordPhase {
  return { ...phase, acknowledgement: { status: 'rejected', message } } as BillRecordPhase;
}

export function recordReviewedBillAction(reviewId: bigint): HouseholdAction {
  return { reducer: 'recordReviewedBill', payload: { billReviewId: reviewId } };
}

export function renderBillReview(draft: BillDraft, online: boolean, phase: BillRecordPhase, mobile = false): string {
  const totals = billTotals(draft);
  const control = billRecordControl(draft, online, phase);
  const payerOptions = new Map<string, string>();
  payerOptions.set(draft.payer.identity.toHexString(), draft.payer.displayName);
  for (const line of draft.lines) {
    for (const allocation of line.allocations) {
      payerOptions.set(allocation.member.identity.toHexString(), allocation.member.displayName);
    }
  }
  const options = [...payerOptions].map(([identity, name]) =>
    `<option value="${escapeHouseholdHtml(identity)}" ${identity === draft.payer.identity.toHexString() ? 'selected' : ''}>${escapeHouseholdHtml(name)}</option>`,
  ).join('');
  const dateValue = new Date(Number(draft.expenseDateMicros / 1_000n)).toISOString().slice(0, 10);
  const lines = draft.lines.map(line => `<article class="bill-line" data-line-id="${escapeHouseholdHtml(line.id)}">
    <header><h3>${escapeHouseholdHtml(line.label)}</h3><strong>${paiseLabel(line.amountPaise)}</strong></header>
    <div class="bill-line-allocations">${line.allocations.map(allocation => `<label class="bill-person ${allocation.exempt ? 'is-exempt' : ''}">
      <span>${escapeHouseholdHtml(allocation.member.displayName)}</span>
      <input type="number" data-allocation-member="${escapeHouseholdHtml(allocation.member.identity.toHexString())}" value="${allocation.amountPaise}" ${allocation.exempt ? 'disabled' : ''} />
      <input type="checkbox" data-allocation-exempt ${allocation.exempt ? 'checked' : ''} /> Exempt
    </label>`).join('')}</div>
  </article>`).join('');
  return `<section class="bill-review ${mobile ? 'bill-review-mobile' : 'bill-review-desktop'} ${online ? '' : 'is-offline'}" data-bill-review>
    <header><p class="eyebrow">REVIEW BEFORE RECORDING</p><h2>${escapeHouseholdHtml(draft.title)}</h2></header>
    ${online ? '' : '<p class="bill-offline" role="status">Reconnect to edit shared allocations or record this bill.</p>'}
    <div class="bill-fields"><label>Paid by<select data-bill-payer>${options}</select></label><label>Date<input type="date" data-bill-date value="${dateValue}" /></label></div>
    <div class="bill-lines">${lines}</div>
    <footer><span>Allocated ${paiseLabel(totals.allocatedPaise)} of ${paiseLabel(totals.billPaise)}</span>
      <button type="button" data-record-bill ${control.disabled ? 'disabled' : ''}>${phase.step === 'recorded' ? 'Recorded' : 'Record bill'}</button>
      <p class="bill-record-state">${escapeHouseholdHtml(control.reason)}</p>
    </footer>
  </section>`;
}
