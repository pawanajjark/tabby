export type CommandStatus = 'idle' | 'queued' | 'pending' | 'acknowledged' | 'rejected';

export interface CommandSnapshot {
  key: string;
  status: CommandStatus;
  error?: string;
  updatedAt: number;
}

export type CommandResult<T = void> =
  | { status: 'queued' }
  | { status: 'acknowledged'; value: T }
  | { status: 'rejected'; error: Error };

type CommandTask<T = unknown> = () => Promise<T>;

export function settleWithin<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), timeoutMs);
    promise.then(
      value => { clearTimeout(timer); resolve(value); },
      cause => { clearTimeout(timer); reject(cause); },
    );
  });
}

export class ActionCoordinator {
  private readonly snapshots = new Map<string, CommandSnapshot>();
  private readonly queued = new Map<string, CommandTask>();
  private readonly listeners = new Set<(snapshot: CommandSnapshot) => void>();
  private readonly isOnline: () => boolean;

  constructor(isOnline: () => boolean) {
    this.isOnline = isOnline;
  }

  subscribe(listener: (snapshot: CommandSnapshot) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  get(key: string): CommandSnapshot {
    return this.snapshots.get(key) ?? { key, status: 'idle', updatedAt: 0 };
  }

  async execute<T>(
    key: string,
    task: CommandTask<T>,
    options: { queueIfOffline?: boolean } = {},
  ): Promise<CommandResult<T>> {
    if (this.get(key).status === 'pending') {
      return { status: 'rejected', error: new Error('This action is already in progress.') };
    }

    if (!this.isOnline()) {
      if (options.queueIfOffline) {
        this.queued.set(key, task);
        this.publish(key, 'queued');
        return { status: 'queued' };
      }
      const error = new Error('This shared action is unavailable while offline.');
      this.publish(key, 'rejected', error.message);
      return { status: 'rejected', error };
    }

    return this.run(key, task);
  }

  async retry<T = unknown>(key: string): Promise<CommandResult<T>> {
    const task = this.queued.get(key) as CommandTask<T> | undefined;
    if (!task) {
      const error = new Error('There is no queued action to retry.');
      this.publish(key, 'rejected', error.message);
      return { status: 'rejected', error };
    }
    if (!this.isOnline()) return { status: 'queued' };
    return this.run(key, task);
  }

  async flushQueued(): Promise<CommandResult<unknown>[]> {
    if (!this.isOnline()) return [];
    return Promise.all([...this.queued.entries()].map(([key, task]) => this.run(key, task)));
  }

  private async run<T>(key: string, task: CommandTask<T>): Promise<CommandResult<T>> {
    this.publish(key, 'pending');
    try {
      const value = await task();
      this.queued.delete(key);
      this.publish(key, 'acknowledged');
      return { status: 'acknowledged', value };
    } catch (cause) {
      const error = cause instanceof Error ? cause : new Error(String(cause));
      this.publish(key, 'rejected', error.message);
      return { status: 'rejected', error };
    }
  }

  private publish(key: string, status: CommandStatus, error?: string) {
    const snapshot = { key, status, error, updatedAt: Date.now() };
    this.snapshots.set(key, snapshot);
    this.listeners.forEach(listener => listener(snapshot));
  }
}
