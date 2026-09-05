import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { identityBackRoute, renderIdentityFlow } from '../src/app/identityFlowView.ts';
import {
  createIdentityState,
  createHome,
  normalizeCreateHomeDraft,
  saveProfile,
  type IdentityPorts,
} from '../src/features/identity/index.ts';
import * as identityModel from '../src/features/identity/model.ts';
import { conversationListItems } from '../src/features/conversations/selectors.ts';
import { canPersistConversationMessage, encodeStoredConversationMessage } from '../src/features/conversations/persistence.ts';
import * as householdFeatures from '../src/features/household/index.ts';
import * as actionCoordinator from '../src/services/actionCoordinator.ts';
import { AuthSessionStore } from '../src/services/authSession.ts';

class MemoryStorage {
  private readonly values: Map<string, string>;
  constructor(values = new Map<string, string>()) { this.values = values; }
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, String(value)); }
  removeItem(key: string) { this.values.delete(key); }
}

function unusedPorts(overrides: Partial<IdentityPorts> = {}): IdentityPorts {
  const unused = async () => { throw new Error('Unexpected port call.'); };
  return {
    saveProfile: unused,
    createHome: unused,
    lookupInvitation: async () => null,
    joinHome: unused,
    createInvitation: unused,
    saveHomeBasics: unused,
    saveFirstTaskItems: unused,
    switchHome: unused,
    switchAccount: unused,
    signOut: unused,
    beginRecovery: unused,
    deleteAccount: unused,
    connectAi: async () => ({ model: '' }),
    disconnectAi: unused,
    ...overrides,
  };
}

test('an empty required profile name is rejected before it is saved', async () => {
  let saveCalls = 0;
  const state = createIdentityState('profile');
  state.profile.displayName = '   ';

  const result = await saveProfile(state, unusedPorts({
    saveProfile: async () => { saveCalls += 1; },
  }));

  assert.equal(result.request, 'error');
  assert.match(result.message ?? '', /name/i);
  assert.equal(saveCalls, 0);
});

test('the Pen profile contract requires both a name and phone number', async () => {
  let saveCalls = 0;
  const state = createIdentityState('profile');
  state.profile.displayName = 'Pawan';

  const result = await saveProfile(state, unusedPorts({
    saveProfile: async () => { saveCalls += 1; },
  }));

  assert.equal(result.request, 'error');
  assert.match(result.message ?? '', /phone/i);
  assert.equal(saveCalls, 0);
});

test('the two-field Pen home form maps to the existing atomic reducer payload', async () => {
  let received: ReturnType<typeof normalizeCreateHomeDraft> | undefined;
  const state = createIdentityState('create-home');
  state.profile.displayName = 'Pawan';
  state.createHome = {
    ...state.createHome,
    homeName: 'Sunshine Haven',
    homeLabel: '',
    displayName: 'Pawan',
  };

  const result = await createHome(state, unusedPorts({
    createHome: async home => { received = home; },
  }));

  assert.equal(result.request, 'success');
  assert.equal(result.route, 'bring-house-together');
  assert.deepEqual(received, {
    residenceName: 'Sunshine Haven',
    address: 'Address not added',
    homeName: 'Sunshine Haven',
    homeLabel: 'Home',
    displayName: 'Pawan',
  });
});

test('profile opened from settings returns to settings', () => {
  assert.equal(identityBackRoute('profile', 'settings'), 'settings');
});

test('accounts and homes are rendered once in the account chooser', () => {
  const state = createIdentityState('accounts');
  state.accounts = [{ identity: 'abc123', displayName: 'Pawan', detail: 'Current account', active: true }];
  state.homes = [{ id: 7n, name: 'Maple Home', label: '7A', residenceName: 'Maple House', active: true }];

  const html = renderIdentityFlow(state);

  assert.equal(html.match(/Pawan/g)?.length, 1);
  assert.equal(html.match(/Maple Home/g)?.length, 1);
});

test('join home lists available homes without asking for an invitation code', () => {
  const state = createIdentityState('join-home');
  state.homes = [
    { id: 7n, name: 'Maple Home', label: '7A', residenceName: 'Maple House', active: false },
    { id: 8n, name: 'Cedar Home', label: '8B', residenceName: 'Cedar House', active: true },
  ];

  const html = renderIdentityFlow(state);

  assert.match(html, /AVAILABLE HOMES/);
  assert.match(html, /data-identity-home="7"/);
  assert.match(html, /Click to join this home/);
  assert.doesNotMatch(html, /invite code|invitation/i);
});

test('join home does not claim the database is empty before homes synchronize', () => {
  const state = createIdentityState('join-home');

  const loadingHtml = renderIdentityFlow(state);

  assert.match(loadingHtml, /Loading homes/i);
  assert.doesNotMatch(loadingHtml, /No homes are available/i);

  state.homesSynchronized = true;
  const synchronizedEmptyHtml = renderIdentityFlow(state);

  assert.match(synchronizedEmptyHtml, /No homes are available/i);
});

test('an open join-home screen refreshes when synchronized homes arrive', () => {
  const mainSource = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
  const refreshStart = mainSource.indexOf('function refreshOpenIdentityFlowFromDatabase()');
  const refreshEnd = mainSource.indexOf('\nfunction closeIdentityFlow()', refreshStart);
  const refreshBlock = mainSource.slice(refreshStart, refreshEnd);

  assert.match(refreshBlock, /'join-home'/);
  assert.match(refreshBlock, /hydrateIdentityState\(identityState\.route\)/);
});

test('checking a first-task pantry item immediately refreshes the save action', () => {
  const mainSource = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
  const renderStart = mainSource.indexOf('function renderIdentityFlowUi()');
  const renderEnd = mainSource.indexOf('\nasync function handleIdentityAction', renderStart);
  const renderBlock = mainSource.slice(renderStart, renderEnd);

  assert.match(renderBlock, /querySelectorAll<HTMLInputElement>\('\[data-first-item\]'\)/);
  assert.match(renderBlock, /input\.addEventListener\('change'/);
  assert.match(renderBlock, /readIdentityDraft\(\)/);
  assert.match(renderBlock, /selectedFirstTaskItems\(identityState\.firstTaskItems\)/);
  assert.match(renderBlock, /action\.disabled = selected\.length === 0/);
  assert.match(renderBlock, /action\.textContent = `Save \$\{selected\.length\}/);
});

test('selecting an available home finishes joining without opening pantry setup', () => {
  const mainSource = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
  const renderStart = mainSource.indexOf('function renderIdentityFlowUi()');
  const renderEnd = mainSource.indexOf('\nasync function handleIdentityAction', renderStart);
  const renderBlock = mainSource.slice(renderStart, renderEnd);
  const homeSelectionStart = renderBlock.indexOf("mount.querySelectorAll<HTMLButtonElement>('[data-identity-home]')");
  const homeSelectionEnd = renderBlock.indexOf("mount.querySelectorAll<HTMLButtonElement>('[data-identity-account]')", homeSelectionStart);
  const homeSelectionBlock = renderBlock.slice(homeSelectionStart, homeSelectionEnd);

  assert.match(homeSelectionBlock, /identityEntryRoute !== 'settings'/);
  assert.match(homeSelectionBlock, /closeIdentityFlow\(\)/);
  assert.match(homeSelectionBlock, /navigateTo\('conversations'\)/);
  assert.doesNotMatch(homeSelectionBlock, /first-task|seedFirstTaskChoices/);
});

test('the active conversation never reports its messages as unread', () => {
  const [item] = conversationListItems({
    query: '',
    activeConversationId: 'conversation-1',
    conversations: [{
      id: 'conversation-1',
      title: 'Current chat',
      messages: [{
        id: 'message-1',
        role: 'assistant',
        text: 'Done',
        createdAt: '2026-09-06T00:00:00.000Z',
      }],
    }],
  });

  assert.equal(item.unreadCount, 0);
});

test('editing every create-home field immediately enables creation', () => {
  const update = (identityModel as unknown as {
    updateIdentityTextField?: (state: ReturnType<typeof createIdentityState>, name: string, value: string) => ReturnType<typeof createIdentityState>;
  }).updateIdentityTextField;
  assert.equal(typeof update, 'function');
  let state = createIdentityState('create-home');
  for (const [name, value] of [
    ['residenceName', 'Maple House'],
    ['address', 'MG Road'],
    ['homeName', '7A Crew'],
    ['homeLabel', '7A'],
    ['homeDisplayName', 'Pawan'],
  ]) state = update!(state, name, value);

  assert.doesNotMatch(renderIdentityFlow(state), /data-identity-action="confirm-create-home"[^>]*disabled/);
});

test('shared controls are unavailable with a clear no-home reason', () => {
  const availability = (householdFeatures as unknown as {
    sharedActionAvailability?: (connected: boolean, browserOnline: boolean, activeHomeId: bigint | null) => { available: boolean; reason?: string };
  }).sharedActionAvailability;
  assert.equal(typeof availability, 'function');
  assert.deepEqual(availability!(true, true, null), {
    available: false,
    reason: 'Choose a home before using shared household data.',
  });
});

test('chat work rejects with a useful error when its deadline expires', async () => {
  const settleWithin = (actionCoordinator as unknown as {
    settleWithin?: <T>(promise: Promise<T>, timeoutMs: number, message: string) => Promise<T>;
  }).settleWithin;
  assert.equal(typeof settleWithin, 'function');
  await assert.rejects(
    settleWithin!(new Promise(() => undefined), 5, 'Chat timed out.'),
    /Chat timed out/,
  );
});

test('saved sessions discard blanks and deduplicate canonical identities', () => {
  const storage = new MemoryStorage(new Map([['sessions', JSON.stringify({
    version: 1,
    activeIdentity: 'ABC',
    requestedIdentity: null,
    recovery: null,
    accounts: [
      { identity: '   ', displayName: '', lastConnectedAt: '2026-09-01T00:00:00Z' },
      { identity: 'ABC', displayName: 'Older', lastConnectedAt: '2026-09-01T00:00:00Z' },
      { identity: 'abc', displayName: 'Pawan', lastConnectedAt: '2026-09-02T00:00:00Z' },
    ],
  })]]));

  const state = new AuthSessionStore(storage, 'sessions').getState();

  assert.deepEqual(state.accounts.map(account => [account.identity, account.displayName]), [['abc', 'Pawan']]);
  assert.equal(state.activeIdentity, 'abc');
});

test('pending progress placeholders cannot be saved as empty database messages', () => {
  const pending = { id: 'progress-1', pending: true, text: undefined, contentHtml: undefined };
  assert.equal(canPersistConversationMessage(pending), false);
  assert.throws(() => encodeStoredConversationMessage(pending), /completed conversation messages/);
});
