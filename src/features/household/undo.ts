import type { HouseholdAction } from './actions.ts';

export type DeletableHouseholdRow =
  | { kind: 'pantry'; row: { id: bigint; name: string } }
  | { kind: 'rule'; row: { id: bigint; title: string } };

export interface PendingDeletion {
  token: string;
  target: DeletableHouseholdRow;
  requestedAtMs: number;
  deleteAtMs: number;
}

export function scheduleDeletion(
  token: string,
  target: DeletableHouseholdRow,
  nowMs: number,
  delayMs = 5_000,
): PendingDeletion {
  if (delayMs <= 0) throw new Error('Undo delay must be positive.');
  return { token, target, requestedAtMs: nowMs, deleteAtMs: nowMs + delayMs };
}

export function undoDeletion(pending: PendingDeletion, nowMs: number) {
  if (nowMs > pending.deleteAtMs) return { restored: false as const, target: undefined };
  return { restored: true as const, target: pending.target };
}

export function deletionActionWhenDue(pending: PendingDeletion, nowMs: number): HouseholdAction | undefined {
  if (nowMs < pending.deleteAtMs) return undefined;
  return pending.target.kind === 'pantry'
    ? { reducer: 'deletePantryItem', payload: { id: pending.target.row.id } }
    : { reducer: 'deleteFlatRule', payload: { id: pending.target.row.id } };
}
