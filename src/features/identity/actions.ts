import {
  canDeleteAccount,
  homePreview,
  isCompleteInvitationCode,
  normalizeInvitationCode,
  type AiConnectionState,
  type CreateHomeDraft,
  type FirstTaskItem,
  type HomeBasicsDraft,
  type IdentityFeatureState,
  type InvitationDraft,
  type InvitationPreview,
  type ProfileDraft,
} from './model.ts';

export interface IdentityPorts {
  saveProfile(profile: ProfileDraft): Promise<void>;
  createHome(home: CreateHomeDraft): Promise<void>;
  lookupInvitation(code: string): Promise<InvitationPreview | null>;
  joinHome(code: string, displayName: string): Promise<void>;
  createInvitation(invitation: InvitationDraft): Promise<void>;
  saveHomeBasics(basics: HomeBasicsDraft): Promise<void>;
  saveFirstTaskItems(items: FirstTaskItem[]): Promise<void>;
  switchHome(homeId: bigint): Promise<void>;
  switchAccount(identity: string): Promise<void>;
  signOut(): Promise<void>;
  beginRecovery(identity?: string): Promise<void>;
  deleteAccount(): Promise<void>;
  connectAi(input: { apiKey: string; model: string }): Promise<{ model: string }>;
  disconnectAi(): Promise<void>;
}

function busy(state: IdentityFeatureState): IdentityFeatureState {
  return { ...state, request: 'loading', message: 'Working…' };
}

function succeeded(state: IdentityFeatureState, message: string): IdentityFeatureState {
  return { ...state, request: 'success', message };
}

function failed(state: IdentityFeatureState, cause: unknown): IdentityFeatureState {
  return { ...state, request: 'error', message: cause instanceof Error ? cause.message : String(cause) };
}

export async function saveProfile(state: IdentityFeatureState, ports: IdentityPorts): Promise<IdentityFeatureState> {
  const next = busy(state);
  try {
    await ports.saveProfile(state.profile);
    return succeeded(next, 'Profile saved.');
  } catch (cause) {
    return failed(next, cause);
  }
}

export async function createHome(state: IdentityFeatureState, ports: IdentityPorts): Promise<IdentityFeatureState> {
  if (!homePreview(state.createHome)) return failed(state, new Error('Complete every home detail before continuing.'));
  const next = busy(state);
  try {
    await ports.createHome(state.createHome);
    return succeeded({ ...next, route: 'first-task' }, 'Home created.');
  } catch (cause) {
    return failed(next, cause);
  }
}

export async function lookupInvitation(state: IdentityFeatureState, value: string, ports: IdentityPorts): Promise<IdentityFeatureState> {
  const code = normalizeInvitationCode(value);
  if (!isCompleteInvitationCode(code)) {
    return { ...state, invitation: { kind: 'invalid', code, message: 'Enter all six characters.' } };
  }
  const next = { ...state, invitation: { kind: 'loading' as const, code } };
  try {
    const preview = await ports.lookupInvitation(code);
    return preview
      ? { ...next, invitation: { kind: 'valid', code, preview } }
      : { ...next, invitation: { kind: 'invalid', code, message: 'This invitation is unavailable or expired.' } };
  } catch (cause) {
    return { ...next, invitation: { kind: 'error', code, message: cause instanceof Error ? cause.message : String(cause) } };
  }
}

export async function joinHome(state: IdentityFeatureState, displayName: string, ports: IdentityPorts): Promise<IdentityFeatureState> {
  if (state.invitation.kind !== 'valid') return failed(state, new Error('Look up a valid invitation first.'));
  const next = busy(state);
  try {
    await ports.joinHome(state.invitation.code, displayName.trim());
    return succeeded({ ...next, route: 'first-task' }, 'Home joined.');
  } catch (cause) {
    return failed(next, cause);
  }
}

export function createInvitationCode(random: () => number = Math.random): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => alphabet[Math.floor(random() * alphabet.length) % alphabet.length]).join('');
}

export async function createInvitation(state: IdentityFeatureState, invitation: Omit<InvitationDraft, 'code'>, ports: IdentityPorts) {
  const next = busy(state);
  const draft = { ...invitation, code: createInvitationCode() };
  try {
    await ports.createInvitation(draft);
    return { state: succeeded(next, 'Invitation created.'), invitation: draft };
  } catch (cause) {
    return { state: failed(next, cause), invitation: null };
  }
}

export async function saveHomeBasics(state: IdentityFeatureState, ports: IdentityPorts): Promise<IdentityFeatureState> {
  const next = busy(state);
  try {
    await ports.saveHomeBasics(state.basics);
    return succeeded({ ...next, route: 'first-task' }, 'Household basics saved.');
  } catch (cause) {
    return failed(next, cause);
  }
}

export async function saveFirstTask(state: IdentityFeatureState, ports: IdentityPorts): Promise<IdentityFeatureState> {
  const selected = state.firstTaskItems.filter(item => item.selected);
  if (!selected.length) return failed(state, new Error('Choose at least one real item.'));
  const next = busy(state);
  try {
    await ports.saveFirstTaskItems(selected);
    return succeeded(next, `${selected.length} item${selected.length === 1 ? '' : 's'} saved.`);
  } catch (cause) {
    return failed(next, cause);
  }
}

export async function switchHome(state: IdentityFeatureState, homeId: bigint, ports: IdentityPorts): Promise<IdentityFeatureState> {
  const next = busy(state);
  try {
    await ports.switchHome(homeId);
    return succeeded({ ...next, homes: state.homes.map(home => ({ ...home, active: home.id === homeId })) }, 'Home switched.');
  } catch (cause) {
    return failed(next, cause);
  }
}

export async function switchAccount(state: IdentityFeatureState, identity: string, ports: IdentityPorts): Promise<IdentityFeatureState> {
  const next = busy(state);
  try {
    await ports.switchAccount(identity);
    return succeeded({ ...next, accounts: state.accounts.map(account => ({ ...account, active: account.identity === identity })) }, 'Account connected.');
  } catch (cause) {
    return failed(next, cause);
  }
}

export async function signOut(state: IdentityFeatureState, ports: IdentityPorts): Promise<IdentityFeatureState> {
  const next = busy(state);
  try {
    await ports.signOut();
    return succeeded({ ...next, route: 'welcome', accounts: state.accounts.map(account => ({ ...account, active: false })) }, 'Signed out.');
  } catch (cause) {
    return failed(next, cause);
  }
}

export async function beginRecovery(state: IdentityFeatureState, identity: string | undefined, ports: IdentityPorts): Promise<IdentityFeatureState> {
  const next = busy(state);
  try {
    await ports.beginRecovery(identity);
    return succeeded(next, 'Recovery opened. Reconnect Tabby when it is complete.');
  } catch (cause) {
    return failed(next, cause);
  }
}

export async function deleteAccount(state: IdentityFeatureState, ports: IdentityPorts): Promise<IdentityFeatureState> {
  if (!canDeleteAccount(state.deletionInput)) return failed(state, new Error('Type DELETE exactly to continue.'));
  const next = busy(state);
  try {
    await ports.deleteAccount();
    return succeeded({ ...next, route: 'welcome', homes: [], accounts: [] }, 'Account data deleted.');
  } catch (cause) {
    return failed(next, cause);
  }
}

export async function connectAi(state: IdentityFeatureState, input: { apiKey: string; model: string }, ports: IdentityPorts): Promise<IdentityFeatureState> {
  const checking: AiConnectionState = { kind: 'checking', model: input.model };
  const next = { ...busy(state), ai: checking };
  try {
    const connected = await ports.connectAi(input);
    return succeeded({ ...next, ai: { kind: 'connected', model: connected.model } }, 'AI connected.');
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    return failed({ ...next, ai: { kind: 'error', model: input.model, message } }, cause);
  }
}

export async function disconnectAi(state: IdentityFeatureState, ports: IdentityPorts): Promise<IdentityFeatureState> {
  const next = busy(state);
  try {
    await ports.disconnectAi();
    return succeeded({ ...next, ai: { kind: 'disconnected', model: state.ai.model } }, 'AI disconnected.');
  } catch (cause) {
    return failed(next, cause);
  }
}
