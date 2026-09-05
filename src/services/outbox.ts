import type { KeyValueStorage } from './authSession.ts';

export interface OutboxScope {
  identity: string;
  homeId: string;
}

export type OutboxStatus = 'pending' | 'processing' | 'failed' | 'acknowledged';

export interface OutboxCommand<T = unknown> {
  id: string;
  idempotencyKey: string;
  kind: string;
  payload: T;
  status: OutboxStatus;
  attempts: number;
  createdAt: string;
  updatedAt: string;
  lastError?: string;
  acknowledgedAt?: string;
}

export type OutboxProcessor = (command: Readonly<OutboxCommand>) => Promise<void>;

function storageKey(scope: OutboxScope): string {
  const identity = encodeURIComponent(scope.identity.trim().toLowerCase());
  const homeId = encodeURIComponent(scope.homeId.trim());
  if (!identity || !homeId) throw new Error('Identity and home are required to scope the outbox.');
  return `tabby_outbox_v1:${identity}:${homeId}`;
}

function makeId(): string {
  if (globalThis.crypto?.randomUUID) return `command_${globalThis.crypto.randomUUID()}`;
  return `command_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export class PersistentOutbox {
  private flushing: Promise<OutboxCommand[]> | null = null;
  private readonly key: string;
  private readonly storage: KeyValueStorage;

  constructor(
    scope: OutboxScope,
    storage: KeyValueStorage = globalThis.localStorage,
  ) {
    this.storage = storage;
    this.key = storageKey(scope);
    this.recoverInterruptedCommands();
  }

  list(): OutboxCommand[] {
    try {
      const parsed = JSON.parse(this.storage.getItem(this.key) ?? '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  enqueue<T>(kind: string, payload: T, idempotencyKey: string): OutboxCommand<T> {
    const cleanKind = kind.trim();
    const cleanKey = idempotencyKey.trim();
    if (!cleanKind || !cleanKey) throw new Error('Command kind and idempotency key are required.');
    const commands = this.list();
    const existing = commands.find(command => command.idempotencyKey === cleanKey);
    if (existing) return clone(existing as OutboxCommand<T>);

    const now = new Date().toISOString();
    const command: OutboxCommand<T> = {
      id: makeId(),
      idempotencyKey: cleanKey,
      kind: cleanKind,
      payload: clone(payload),
      status: 'pending',
      attempts: 0,
      createdAt: now,
      updatedAt: now,
    };
    this.save([...commands, command]);
    return clone(command);
  }

  retry(commandId: string): OutboxCommand {
    let retried: OutboxCommand | undefined;
    const commands = this.list().map(command => {
      if (command.id !== commandId) return command;
      if (command.status === 'acknowledged') return command;
      retried = { ...command, status: 'pending', updatedAt: new Date().toISOString(), lastError: undefined };
      return retried;
    });
    if (!retried) throw new Error('The outbox command was not found or was already acknowledged.');
    this.save(commands);
    return clone(retried);
  }

  flush(processor: OutboxProcessor): Promise<OutboxCommand[]> {
    if (this.flushing) return this.flushing;
    this.flushing = this.performFlush(processor).finally(() => { this.flushing = null; });
    return this.flushing;
  }

  private async performFlush(processor: OutboxProcessor): Promise<OutboxCommand[]> {
    const commandIds = this.list()
      .filter(command => command.status === 'pending')
      .map(command => command.id);

    for (const id of commandIds) {
      const current = this.list().find(command => command.id === id);
      if (!current || current.status !== 'pending') continue;
      const processing: OutboxCommand = {
        ...current,
        status: 'processing',
        attempts: current.attempts + 1,
        updatedAt: new Date().toISOString(),
        lastError: undefined,
      };
      this.replace(processing);
      try {
        await processor(clone(processing));
        this.replace({
          ...processing,
          status: 'acknowledged',
          updatedAt: new Date().toISOString(),
          acknowledgedAt: new Date().toISOString(),
        });
      } catch (error) {
        this.replace({
          ...processing,
          status: 'failed',
          updatedAt: new Date().toISOString(),
          lastError: error instanceof Error ? error.message : String(error),
        });
      }
    }
    return this.list();
  }

  private recoverInterruptedCommands(): void {
    const commands = this.list();
    if (!commands.some(command => command.status === 'processing')) return;
    this.save(commands.map(command => command.status === 'processing'
      ? { ...command, status: 'pending', updatedAt: new Date().toISOString() }
      : command));
  }

  private replace(next: OutboxCommand): void {
    this.save(this.list().map(command => command.id === next.id ? next : command));
  }

  private save(commands: OutboxCommand[]): void {
    this.storage.setItem(this.key, JSON.stringify(commands));
  }
}
