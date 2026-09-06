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
import { formatPantryQuantity, pantryImageKey, parsePantryCommand } from '../src/features/household/pantry.ts';
import { routeNavigation } from '../src/app/routeShell.ts';

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
    { id: 7n, name: 'Maple Home', label: '7A', residenceName: 'Maple House', memberCount: 4, active: false },
    { id: 8n, name: 'Cedar Home', label: '8B', residenceName: 'Cedar House', memberCount: 2, active: true },
  ];

  const html = renderIdentityFlow(state);

  assert.match(html, /AVAILABLE HOMES/);
  assert.match(html, /data-identity-home="7"/);
  assert.match(html, /4 members/);
  assert.match(html, /data-identity-action="confirm-join-home"[^>]*disabled/);
  assert.doesNotMatch(html, /invite code|invitation/i);

  state.selectedHomeId = 7n;
  const selectedHtml = renderIdentityFlow(state);
  assert.match(selectedHtml, /data-identity-home="7" aria-pressed="true"/);
  assert.doesNotMatch(selectedHtml, /data-identity-action="confirm-join-home"[^>]*disabled/);
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

test('selecting an available home waits for explicit confirmation before joining', () => {
  const mainSource = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
  const renderStart = mainSource.indexOf('function renderIdentityFlowUi()');
  const renderEnd = mainSource.indexOf('\nasync function handleIdentityAction', renderStart);
  const renderBlock = mainSource.slice(renderStart, renderEnd);
  const homeSelectionStart = renderBlock.indexOf("mount.querySelectorAll<HTMLButtonElement>('[data-identity-home]')");
  const homeSelectionEnd = renderBlock.indexOf("mount.querySelectorAll<HTMLButtonElement>('[data-identity-account]')", homeSelectionStart);
  const homeSelectionBlock = renderBlock.slice(homeSelectionStart, homeSelectionEnd);

  assert.match(homeSelectionBlock, /selectedHomeId: homeId/);
  assert.match(homeSelectionBlock, /route: 'join-home'/);
  assert.match(homeSelectionBlock, /renderIdentityFlowUi\(\);/);
  assert.match(homeSelectionBlock, /\[data-identity-home="\$\{homeId\}"\]`\)\?\.focus\(\);\s*return;/);

  const actionStart = mainSource.indexOf('async function handleIdentityAction');
  const actionEnd = mainSource.indexOf("\ndocument.querySelector('#identity-flow-close')", actionStart);
  const actionBlock = mainSource.slice(actionStart, actionEnd);
  assert.match(actionBlock, /action === 'confirm-join-home'/);
  assert.match(actionBlock, /switchHome\(identityState, identityState\.selectedHomeId, ports\)/);
  assert.match(actionBlock, /identityCompletionVisible = true/);
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

test('empty conversation examples send immediately instead of only filling the composer', () => {
  const mainSource = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
  const startersStart = mainSource.indexOf('const EMPTY_CONVERSATION_STARTERS');
  const startersEnd = mainSource.indexOf('\nfunction renderEmptyConversationHome()', startersStart);
  const bindStart = mainSource.indexOf('function bindEmptyConversationStarters()');
  const bindEnd = mainSource.indexOf('\nfunction renderConversation()', bindStart);
  const sendStart = mainSource.indexOf('function sendComposerMessage(');
  const sendEnd = mainSource.indexOf("\ndocument.querySelector<HTMLFormElement>('#chat-form')", sendStart);

  assert.match(mainSource.slice(startersStart, startersEnd), /I bought milk and eggs/);
  assert.match(mainSource.slice(startersStart, startersEnd), /Split ₹900 for electricity/);
  assert.match(mainSource.slice(startersStart, startersEnd), /What can we cook tonight\?/);
  assert.match(mainSource.slice(bindStart, bindEnd), /sendComposerMessage\(button\.dataset\.emptyPrompt/);
  assert.doesNotMatch(mainSource.slice(bindStart, bindEnd), /composer\.focus\(\)/);
  assert.match(mainSource.slice(sendStart, sendEnd), /void sendUserMessage\(text\)/);
});

test('mobile navigation keeps More as the only shelf entry point in the phone chrome', () => {
  const mobileNavigation = routeNavigation('mobile-bottom-nav');
  assert.match(mobileNavigation, /<span>More<\/span>/);
  assert.doesNotMatch(mobileNavigation, /Shelf|Home shelf/);
  assert.equal(mobileNavigation.match(/<svg/g)?.length, 4);
});

test('the mobile composer grows with multiline input instead of clipping to a fixed row', () => {
  const styles = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');
  const mobileStart = styles.indexOf('@media (max-width: 740px)');
  const mobileStyles = styles.slice(mobileStart);

  assert.match(mobileStyles, /\.conversation-shell\s*\{[^}]*grid-template-rows:\s*minmax\(0, 1fr\) auto/s);
  assert.match(mobileStyles, /\.composer-zone\s*\{[^}]*min-height:\s*82px/s);
  assert.doesNotMatch(mobileStyles, /\.composer-zone\s*\{[^}]*\n\s*height:\s*82px/s);
  assert.match(mobileStyles, /\.composer textarea\s*\{[^}]*max-height:\s*160px[^}]*overflow-y:\s*auto/s);
});

test('the mobile composer opens the software keyboard without triggering input zoom', () => {
  const page = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const styles = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');
  const mobileStyles = styles.slice(styles.indexOf('@media (max-width: 740px)'));

  assert.match(page, /name="viewport" content="[^"]*interactive-widget=resizes-content[^"]*"/);
  assert.match(mobileStyles, /\.composer textarea\s*\{[^}]*font-size:\s*(?:1rem|16px)/s);
});

test('the mobile shelf puts household content before utilities and reveals quick actions on demand', () => {
  const mainSource = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
  const styles = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');
  const mobileStyles = styles.slice(styles.indexOf('@media (max-width: 740px)'));

  assert.match(mainSource, /id="mobile-home-name"/);
  assert.match(mainSource, /data-reveal-shelf-form="quick-pantry-form"/);
  assert.match(mainSource, /data-reveal-shelf-form="quick-rule-form"/);
  assert.match(mobileStyles, /\.shelf-pantry\s*\{\s*order:\s*3/);
  assert.match(mobileStyles, /\.shelf-people\s*\{\s*order:\s*6/);
  assert.match(mobileStyles, /\.mobile-context-actions\s*\{[^}]*order:\s*7/s);
  assert.match(mobileStyles, /#context-panel \.quick-pantry-form\.is-open/);
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

test('pantry chat commands keep the quantity out of the item name', () => {
  assert.deepEqual(parsePantryCommand('add 2 clean apples to the pantry'), {
    name: 'clean apples',
    quantity: 2,
    unit: 'items',
  });
  assert.deepEqual(parsePantryCommand('I bought 10 eggs'), {
    name: 'eggs',
    quantity: 10,
    unit: 'items',
  });
  assert.deepEqual(parsePantryCommand('I bought 2 kg rice'), {
    name: 'rice',
    quantity: 2,
    unit: 'kg',
  });
});

test('pantry staples receive a stable food illustration with a safe fallback', () => {
  assert.equal(pantryImageKey('eggs'), 'eggs');
  assert.equal(pantryImageKey('fresh bananas'), 'banana');
  assert.equal(pantryImageKey('leafy greens'), 'greens');
  assert.equal(pantryImageKey('house blend spice'), 'default');
  assert.equal(formatPantryQuantity(8, 'item'), '8 items');
  assert.equal(formatPantryQuantity(2, 'kg'), '2 kg');
  assert.equal(formatPantryQuantity(1, 'loaf'), '1 loaf');
});
