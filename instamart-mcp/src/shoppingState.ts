export type ShoppingPhase = 'idle' | 'selected' | 'cart_ready' | 'awaiting_confirmation' | 'ordered' | 'failed';

export interface RequestedItem { name: string; quantity: number; unit: string; }
export interface SelectedItem {
  query: string;
  productName: string;
  spinId: string;
  pack: string;
  quantity: number;
  price: number;
}

export interface ShoppingAgentState {
  sessionId: string;
  phase: ShoppingPhase;
  addressId: string;
  requestedItems: RequestedItem[];
  selectedItems: SelectedItem[];
  cart: unknown;
  payment: unknown;
  toolContext: Array<{ name: string; arguments: Record<string, unknown>; result: unknown }>;
  pendingConfirmation: boolean;
}

export interface ShoppingStateStore {
  readonly kind: 'memory' | 'spacetimedb';
  load(sessionId: string): Promise<ShoppingAgentState | undefined>;
  save(state: ShoppingAgentState): Promise<void>;
  clear(sessionId: string): Promise<void>;
}

export function emptyShoppingState(sessionId: string): ShoppingAgentState {
  return { sessionId, phase: 'idle', addressId: '', requestedItems: [], selectedItems: [], cart: null, payment: null, toolContext: [], pendingConfirmation: false };
}

export class MemoryShoppingStateStore implements ShoppingStateStore {
  readonly kind: 'memory' | 'spacetimedb' = 'memory';
  protected readonly states = new Map<string, ShoppingAgentState>();
  async load(sessionId: string) { return this.states.get(sessionId); }
  async save(state: ShoppingAgentState) { this.states.set(state.sessionId, structuredClone(state)); }
  async clear(sessionId: string) { this.states.delete(sessionId); }
}

export function createShoppingStateStore(_env = process.env): ShoppingStateStore {
  // The web app hydrates this short-lived store from its synchronized
  // my_shopping_agent_states view and persists the returned state through the
  // existing Tabby DbConnection. The bridge must not open a second DB socket.
  return new MemoryShoppingStateStore();
}
