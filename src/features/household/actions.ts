export interface IdentityRef {
  toHexString(): string;
}

export type HouseholdAction =
  | { reducer: 'addPantryItem'; payload: { name: string; quantity: number; unit: string } }
  | {
      reducer: 'upsertPantryItem';
      payload: {
        id: bigint;
        name: string;
        quantity: number;
        unit: string;
        category: string;
        location: string;
        lowStockThreshold: number;
        useSoon: boolean;
      };
    }
  | { reducer: 'deletePantryItem'; payload: { id: bigint } }
  | { reducer: 'deleteFlatRule'; payload: { id: bigint } }
  | {
      reducer: 'createBillReview';
      payload: {
        title: string;
        amountPaise: bigint;
        paidBy: IdentityRef;
        expenseDate: { microsSinceUnixEpoch: bigint };
        category: string;
      };
    }
  | {
      reducer: 'upsertBillLine';
      payload: {
        id: bigint;
        billReviewId: bigint;
        lineKey: string;
        label: string;
        amountPaise: bigint;
        position: number;
      };
    }
  | { reducer: 'deleteBillLine'; payload: { id: bigint } }
  | {
      reducer: 'upsertBillLineAllocation';
      payload: {
        id: bigint;
        billReviewId: bigint;
        billLineId: bigint;
        memberIdentity: IdentityRef;
        amountPaise: bigint;
        exempt: boolean;
        reason: string;
      };
    }
  | { reducer: 'deleteBillLineAllocation'; payload: { id: bigint } }
  | {
      reducer: 'upsertBillAllocation';
      payload: {
        id: bigint;
        billReviewId: bigint;
        memberIdentity: IdentityRef;
        amountPaise: bigint;
        exempt: boolean;
        reason: string;
      };
    }
  | { reducer: 'recordReviewedBill'; payload: { billReviewId: bigint } }
  | {
      reducer: 'createReminder';
      payload: { title: string; dueAt: { microsSinceUnixEpoch: bigint } };
    }
  | { reducer: 'completeReminder'; payload: { id: bigint } };

export type AcknowledgementState =
  | { status: 'idle' }
  | { status: 'submitting' }
  | { status: 'acknowledged' }
  | { status: 'rejected'; message: string };
