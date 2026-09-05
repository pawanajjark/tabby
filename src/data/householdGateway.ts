import { tables, type DbConnection } from '../module_bindings';
import type { HouseholdAction } from '../features/household';

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
  people: tables.member,
  household: [
    tables.residence,
    tables.flat,
    tables.flatRule,
    tables.pantryItem,
    tables.expense,
    tables.expenseSplit,
    tables.sharedMemory,
  ],
};

export function createHouseholdGateway(
  connection: () => DbConnection,
  activeHomeId: () => bigint | null = () => null,
) {
  const scoped = <T extends HomeScopedRow>(rows: readonly T[]) => scopeRowsToActiveHome(rows, activeHomeId());
  const requireActiveHome = () => {
    if (activeHomeId() === null) throw new Error('Choose a home before using shared household data.');
  };

  return {
    members: () => scoped([...connection().db.member.iter()]),
    residences: () => [...connection().db.residence.iter()],
    homes: () => [...connection().db.flat.iter()],
    homeMemberships: () => [...connection().db.member.iter()].map(row => ({
      identity: row.identity,
      flatId: row.flatId,
      displayName: row.displayName,
      role: 'member',
      active: true,
    })),
    conversations: () => scoped([...connection().db.myConversations.iter()]),
    conversationMessages: () => {
      const conversationIds = new Set(scoped([...connection().db.myConversations.iter()]).map(row => row.id));
      return [...connection().db.myConversationMessages.iter()].filter(row => conversationIds.has(row.conversationId));
    },
    pantryItems: () => scoped([...connection().db.pantryItem.iter()]).filter(row => row.quantity > 0),
    pantryItemDetails: () => [],
    flatRules: () => scoped([...connection().db.flatRule.iter()]),
    sharedMemories: () => scoped([...connection().db.sharedMemory.iter()]),
    expenses: () => scoped([...connection().db.expense.iter()]),
    expenseSplits: () => {
      const expenseIds = new Set(scoped([...connection().db.expense.iter()]).map(row => row.id));
      return [...connection().db.expenseSplit.iter()].filter(row => expenseIds.has(row.expenseId));
    },
    billReviews: () => [],
    billAllocations: () => [],
    billLines: () => [],
    billLineAllocations: () => [],
    reminders: () => [],
    reminderDeliveries: () => [],
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
        case 'addPantryItem':
          return connection().reducers.addPantryItem(action.payload);
        case 'upsertPantryItem': {
          const current = [...connection().db.pantryItem.iter()].find(row => row.id === action.payload.id);
          const quantity = current ? action.payload.quantity - current.quantity : action.payload.quantity;
          return connection().reducers.addPantryItem({
            name: action.payload.name,
            quantity,
            unit: action.payload.unit,
          });
        }
        case 'deletePantryItem': {
          const current = [...connection().db.pantryItem.iter()].find(row => row.id === action.payload.id);
          if (!current || current.quantity === 0) return Promise.resolve();
          return connection().reducers.addPantryItem({
            name: current.name,
            quantity: -current.quantity,
            unit: current.unit,
          });
        }
        case 'deleteFlatRule':
          return connection().reducers.deleteFlatRule(action.payload);
        default:
          throw new Error('This action is not stored by the original backend.');
      }
    },
  };
}
