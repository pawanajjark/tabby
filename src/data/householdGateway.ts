import { tables, type DbConnection } from '../module_bindings';
import type { HouseholdAction } from '../features/household';
import { Identity, Timestamp } from 'spacetimedb';

export interface HomeScopedRow {
  flatId: bigint;
}

export function scopeRowsToActiveHome<T extends HomeScopedRow>(
  rows: readonly T[],
  activeHomeId: bigint | null | undefined,
): T[] {
  if (activeHomeId === null || activeHomeId === undefined) return [];
  return rows.filter(row => row.flatId === activeHomeId);
}

export const householdSubscriptionTables = {
  people: tables.myMembers,
  household: [
    tables.myResidences,
    tables.myHomes,
    tables.myHomeMemberships,
    tables.myFlatRules,
    tables.myPantryItems,
    tables.myPantryItemDetails,
    tables.myExpenses,
    tables.myExpenseSplits,
    tables.mySharedMemories,
    tables.myBillReviews,
    tables.myBillAllocations,
    tables.myBillLines,
    tables.myBillLineAllocations,
    tables.myReminders,
    tables.myReminderDeliveries,
  ],
};

export function createHouseholdGateway(
  connection: () => DbConnection,
  activeHomeId: () => bigint | null = () => null,
) {
  const scoped = <T extends HomeScopedRow>(rows: readonly T[]) => scopeRowsToActiveHome(rows, activeHomeId());
  const requireActiveHome = () => {
    if (activeHomeId() === null) throw new Error('Choose an active home before using shared household data.');
  };
  return {
    members: () => scoped([...connection().db.myMembers.iter()]),
    residences: () => [...connection().db.myResidences.iter()],
    homes: () => [...connection().db.myHomes.iter()],
    homeMemberships: () => [...connection().db.myHomeMemberships.iter()],
    conversations: () => scoped([...connection().db.myConversations.iter()]),
    conversationMessages: () => {
      const conversationIds = new Set(scoped([...connection().db.myConversations.iter()]).map(row => row.id));
      return [...connection().db.myConversationMessages.iter()].filter(row => conversationIds.has(row.conversationId));
    },
    pantryItems: () => scoped([...connection().db.myPantryItems.iter()]),
    pantryItemDetails: () => scoped([...connection().db.myPantryItemDetails.iter()]),
    flatRules: () => scoped([...connection().db.myFlatRules.iter()]),
    sharedMemories: () => scoped([...connection().db.mySharedMemories.iter()]),
    billReviews: () => scoped([...connection().db.myBillReviews.iter()]),
    billAllocations: () => scoped([...connection().db.myBillAllocations.iter()]),
    billLines: () => scoped([...connection().db.myBillLines.iter()]),
    billLineAllocations: () => scoped([...connection().db.myBillLineAllocations.iter()]),
    reminders: () => scoped([...connection().db.myReminders.iter()]),
    reminderDeliveries: () => scoped([...connection().db.myReminderDeliveries.iter()]),
    addPantryItem(input: { name: string; quantity: number; unit: string }) {
      requireActiveHome();
      return connection().reducers.addPantryItem(input);
    },
    upsertFlatRule(input: { id: bigint; ruleType: string; title: string; description: string }) {
      requireActiveHome();
      return connection().reducers.upsertFlatRule(input);
    },
    deleteFlatRule(input: { id: bigint }) {
      requireActiveHome();
      return connection().reducers.deleteFlatRule(input);
    },
    recordExpense(input: { title: string; amountPaise: bigint }) {
      requireActiveHome();
      return connection().reducers.recordExpense(input);
    },
    appendConversationMessage(input: { conversationId: string; role: string; agent: string; content: string }) {
      requireActiveHome();
      return connection().reducers.appendConversationMessage(input);
    },
    executeHouseholdAction(action: HouseholdAction) {
      requireActiveHome();
      switch (action.reducer) {
        case 'addPantryItem': return connection().reducers.addPantryItem(action.payload);
        case 'upsertPantryItem': return connection().reducers.upsertPantryItem(action.payload);
        case 'deletePantryItem': return connection().reducers.deletePantryItem(action.payload);
        case 'deleteFlatRule': return connection().reducers.deleteFlatRule(action.payload);
        case 'createBillReview': return connection().reducers.createBillReview({
          ...action.payload,
          paidBy: new Identity(action.payload.paidBy.toHexString()),
          expenseDate: new Timestamp(action.payload.expenseDate.microsSinceUnixEpoch),
        });
        case 'upsertBillLine': return connection().reducers.upsertBillLine(action.payload);
        case 'deleteBillLine': return connection().reducers.deleteBillLine(action.payload);
        case 'upsertBillLineAllocation': return connection().reducers.upsertBillLineAllocation({
          ...action.payload,
          memberIdentity: new Identity(action.payload.memberIdentity.toHexString()),
        });
        case 'deleteBillLineAllocation': return connection().reducers.deleteBillLineAllocation(action.payload);
        case 'upsertBillAllocation': return connection().reducers.upsertBillAllocation({
          ...action.payload,
          memberIdentity: new Identity(action.payload.memberIdentity.toHexString()),
        });
        case 'recordReviewedBill': return connection().reducers.recordReviewedBill(action.payload);
        case 'createReminder': return connection().reducers.createReminder({
          ...action.payload,
          dueAt: new Timestamp(action.payload.dueAt.microsSinceUnixEpoch),
        });
        case 'completeReminder': return connection().reducers.completeReminder(action.payload);
        default: throw new Error('Reducer is not available in the current client bindings.');
      }
    },
  };
}
