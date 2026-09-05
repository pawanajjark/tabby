import type { KeyValueStorage } from '../../services/authSession.ts';
import type { OutboxCommand, OutboxStatus } from '../../services/outbox.ts';
import type { ConversationDeliveryStatus } from './model.ts';

export interface DeliveryRecord {
  messageId: string;
  commandId: string;
  idempotencyKey: string;
  status: ConversationDeliveryStatus;
  updatedAt: string;
  error?: string;
}

function deliveryStatus(status: OutboxStatus): ConversationDeliveryStatus {
  if (status === 'acknowledged') return 'sent';
  if (status === 'failed') return 'rejected';
  if (status === 'processing') return 'sending';
  return 'unsent';
}

function key(identity: string): string {
  const clean = encodeURIComponent(identity.trim().toLowerCase());
  if (!clean) throw new Error('Identity is required to scope conversation delivery.');
  return `tabby_conversation_delivery_v1:${clean}`;
}

export class ConversationDeliveryStore {
  private readonly storageKey: string;
  private readonly storage: KeyValueStorage;

  constructor(identity: string, storage: KeyValueStorage = globalThis.localStorage) {
    this.storageKey = key(identity);
    this.storage = storage;
  }

  list(): DeliveryRecord[] {
    try {
      const parsed = JSON.parse(this.storage.getItem(this.storageKey) ?? '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  project(messageId: string, command: OutboxCommand): DeliveryRecord {
    const record: DeliveryRecord = {
      messageId,
      commandId: command.id,
      idempotencyKey: command.idempotencyKey,
      status: deliveryStatus(command.status),
      updatedAt: command.updatedAt,
      error: command.lastError,
    };
    const records = this.list();
    const exists = records.some(item => item.messageId === messageId);
    this.storage.setItem(this.storageKey, JSON.stringify(exists
      ? records.map(item => item.messageId === messageId ? record : item)
      : [...records, record]));
    return record;
  }

  projectOutbox(bindings: Record<string, string>, commands: OutboxCommand[]): DeliveryRecord[] {
    for (const command of commands) {
      const messageId = bindings[command.idempotencyKey];
      if (messageId) this.project(messageId, command);
    }
    return this.list();
  }
}
