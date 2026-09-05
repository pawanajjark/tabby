export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface AccountProfile {
  identity: string;
  tokenLabel?: string;
  displayName: string;
  phone?: string;
  email?: string;
  homeId?: string;
  flatId?: string;
  lastConnectedAt: string;
}

export interface SpacetimeSessionIdentity {
  /** Canonical identity reported by a live SpacetimeDB connection. */
  identity: string;
  /** Opaque label used by the connection owner to locate its token. */
  tokenLabel?: string;
}

export type RecoveryStage = 'requested' | 'provider_opened' | 'reconnected' | 'completed' | 'failed';

export interface RecoveryTransition {
  stage: RecoveryStage;
  at: string;
  detail?: string;
}

export interface RecoveryState {
  recoveryId: string;
  identity?: string;
  transitions: RecoveryTransition[];
}

export interface AuthSessionState {
  version: 1;
  accounts: AccountProfile[];
  /** Set only after observeConnection receives a SpacetimeDB identity. */
  activeIdentity: string | null;
  /** Account selected for the connection layer to reconnect as. */
  requestedIdentity: string | null;
  recovery: RecoveryState | null;
}

export interface ProfileMetadata {
  displayName?: string;
  phone?: string;
  email?: string;
  homeId?: string;
  flatId?: string;
}

const AUTH_SESSION_STORAGE_KEY = 'tabby_auth_session_v1';

function browserStorage(): KeyValueStorage {
  return globalThis.localStorage;
}

function emptyState(): AuthSessionState {
  return { version: 1, accounts: [], activeIdentity: null, requestedIdentity: null, recovery: null };
}

function makeId(prefix: string): string {
  if (globalThis.crypto?.randomUUID) return `${prefix}_${globalThis.crypto.randomUUID()}`;
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
}

function normalizedIdentity(identity: string): string {
  const clean = identity.trim().toLowerCase();
  if (!clean) throw new Error('A SpacetimeDB connection identity is required.');
  return clean;
}

function isAccountProfile(value: unknown): value is AccountProfile {
  if (!value || typeof value !== 'object') return false;
  const account = value as Partial<AccountProfile>;
  return Boolean(account.identity?.trim() && typeof account.displayName === 'string' && account.lastConnectedAt);
}

function canonicalAccounts(values: unknown[]): AccountProfile[] {
  const byIdentity = new Map<string, AccountProfile>();
  for (const value of values) {
    if (!isAccountProfile(value)) continue;
    const account = { ...value, identity: value.identity.trim().toLowerCase() };
    const previous = byIdentity.get(account.identity);
    if (!previous || Date.parse(account.lastConnectedAt) >= Date.parse(previous.lastConnectedAt)) {
      byIdentity.set(account.identity, account);
    }
  }
  return [...byIdentity.values()];
}

export class AuthSessionStore {
  private readonly storage: KeyValueStorage;
  private readonly storageKey: string;

  constructor(
    storage: KeyValueStorage = browserStorage(),
    storageKey = AUTH_SESSION_STORAGE_KEY,
  ) {
    this.storage = storage;
    this.storageKey = storageKey;
  }

  getState(): AuthSessionState {
    try {
      const raw = this.storage.getItem(this.storageKey);
      if (!raw) return emptyState();
      const parsed = JSON.parse(raw) as Partial<AuthSessionState>;
      const accounts = canonicalAccounts(Array.isArray(parsed.accounts) ? parsed.accounts : []);
      const parsedActiveIdentity = typeof parsed.activeIdentity === 'string' ? parsed.activeIdentity.trim().toLowerCase() : null;
      const parsedRequestedIdentity = typeof parsed.requestedIdentity === 'string' ? parsed.requestedIdentity.trim().toLowerCase() : null;
      const activeIdentity = accounts.some(account => account.identity === parsedActiveIdentity)
        ? parsedActiveIdentity
        : null;
      const requestedIdentity = accounts.some(account => account.identity === parsedRequestedIdentity)
        ? parsedRequestedIdentity
        : null;
      return { version: 1, accounts, activeIdentity, requestedIdentity, recovery: parsed.recovery ?? null };
    } catch {
      return emptyState();
    }
  }

  getActiveAccount(): AccountProfile | null {
    const state = this.getState();
    return state.accounts.find(account => account.identity === state.activeIdentity) ?? null;
  }

  /** Profile metadata never establishes a session without this connection identity. */
  observeConnection(connection: SpacetimeSessionIdentity, metadata: ProfileMetadata = {}): AccountProfile {
    const identity = normalizedIdentity(connection.identity);
    const state = this.getState();
    const previous = state.accounts.find(account => account.identity === identity);
    const account: AccountProfile = {
      ...previous,
      identity,
      tokenLabel: connection.tokenLabel ?? previous?.tokenLabel,
      displayName: metadata.displayName?.trim() ?? previous?.displayName ?? '',
      phone: metadata.phone?.trim() || previous?.phone,
      email: metadata.email?.trim() || previous?.email,
      homeId: metadata.homeId ?? previous?.homeId,
      flatId: metadata.flatId ?? previous?.flatId,
      lastConnectedAt: new Date().toISOString(),
    };
    const accounts = state.accounts.filter(candidate => candidate.identity !== identity).concat(account);
    this.persist({ ...state, accounts, activeIdentity: identity, requestedIdentity: null });
    return account;
  }

  updateProfile(identityValue: string, metadata: ProfileMetadata): AccountProfile {
    const identity = normalizedIdentity(identityValue);
    const state = this.getState();
    const previous = state.accounts.find(account => account.identity === identity);
    if (!previous) throw new Error('The account must be observed on a SpacetimeDB connection first.');
    const account: AccountProfile = {
      ...previous,
      displayName: metadata.displayName?.trim() ?? previous.displayName,
      phone: metadata.phone?.trim() || previous.phone,
      email: metadata.email?.trim() || previous.email,
      homeId: metadata.homeId ?? previous.homeId,
      flatId: metadata.flatId ?? previous.flatId,
    };
    this.persist({ ...state, accounts: state.accounts.map(item => item.identity === identity ? account : item) });
    return account;
  }

  requestAccountSwitch(identityValue: string): AccountProfile {
    const identity = normalizedIdentity(identityValue);
    const state = this.getState();
    const account = state.accounts.find(candidate => candidate.identity === identity);
    if (!account) throw new Error('The account has not connected on this device.');
    this.persist({ ...state, activeIdentity: null, requestedIdentity: identity });
    return account;
  }

  /** Removes only the currently connected account after authoritative deletion succeeds. */
  forgetActiveAccount(): AccountProfile | null {
    const state = this.getState();
    const activeIdentity = state.activeIdentity;
    if (!activeIdentity) return null;
    const account = state.accounts.find(candidate => candidate.identity === activeIdentity) ?? null;
    this.persist({
      ...state,
      accounts: state.accounts.filter(candidate => candidate.identity !== activeIdentity),
      activeIdentity: null,
      requestedIdentity: state.requestedIdentity === activeIdentity ? null : state.requestedIdentity,
      recovery: state.recovery?.identity === activeIdentity ? null : state.recovery,
    });
    return account;
  }

  signOut(options: { forgetAccount?: boolean } = {}): void {
    const state = this.getState();
    const accounts = options.forgetAccount
      ? state.accounts.filter(account => account.identity !== state.activeIdentity)
      : state.accounts;
    this.persist({ ...state, accounts, activeIdentity: null, requestedIdentity: null });
  }

  beginRecovery(identityValue?: string): RecoveryState {
    const identity = identityValue ? normalizedIdentity(identityValue) : undefined;
    if (identity && !this.getState().accounts.some(account => account.identity === identity)) {
      throw new Error('The account has not connected on this device.');
    }
    const recovery: RecoveryState = {
      recoveryId: makeId('recovery'),
      identity,
      transitions: [{ stage: 'requested', at: new Date().toISOString() }],
    };
    this.persist({ ...this.getState(), recovery });
    return recovery;
  }

  transitionRecovery(stage: RecoveryStage, detail?: string): RecoveryState {
    const state = this.getState();
    if (!state.recovery) throw new Error('No account recovery is in progress.');
    const recovery: RecoveryState = {
      ...state.recovery,
      transitions: [...state.recovery.transitions, { stage, at: new Date().toISOString(), detail }],
    };
    this.persist({ ...state, recovery });
    return recovery;
  }

  private persist(state: AuthSessionState): void {
    this.storage.setItem(this.storageKey, JSON.stringify(state));
  }
}
