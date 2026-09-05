import './style.css';
import { DbConnection, tables } from './module_bindings';
import { Timestamp } from 'spacetimedb';
import { AppStore, type AppRoute } from './app/store';
import { installRouteNavigation, reflectRoute, routeNavigation } from './app/routeShell';
import { createHouseholdGateway, householdSubscriptionTables } from './data/householdGateway';
import { identityBackRoute, renderIdentityFlow } from './app/identityFlowView';
import { installDrawerController } from './shared/drawer';
import { ActionCoordinator, settleWithin } from './services/actionCoordinator';
import { PersistentOutbox, type OutboxCommand } from './services/outbox';
import {
  ConversationDeliveryStore,
  canPersistConversationMessage,
  createConversationState,
  decodeStoredConversationMessage,
  emptyHomeStarterSuggestions,
  encodeStoredConversationMessage,
  pendingRoutePresentation,
  reduceConversationState,
  renderConversationRoute,
  type ConversationFeatureState,
  type ConversationRecord,
  type ConversationRoutePresentation,
} from './features/conversations';
import {
  completeReminderAction,
  assignBillLine,
  billAllocationActions,
  billAllocationsAcknowledged,
  billLineActions,
  billLinesAcknowledged,
  billRecordingAcknowledged,
  billRecordRejected,
  billReviewAcknowledged,
  confirmCookingActions,
  cookingAcknowledged,
  createCookingConfirmation,
  createBillReviewAction,
  createReminderAction,
  parsePantryCommand,
  pantryViewItems,
  reminderViews,
  renderCookingConfirmation,
  renderBillReview,
  projectExpenseBalances,
  renderExpenseBalances,
  renderHomeShelfSummary,
  renderPantryRoute as renderRichPantryRoute,
  renderReminderShelf,
  recordReviewedBillAction,
  scheduleDeletion,
  setBillDate,
  setBillPayer,
  startBillRecord,
  undoDeletion,
  deletionActionWhenDue,
  type BillDraft,
  type BillRecordPhase,
  type CookingConfirmation,
  type DeletableHouseholdRow,
  type PendingDeletion,
  type PantryFilters,
} from './features/household';
import {
  beginRecovery,
  connectAi,
  createHome,
  createIdentityState,
  createSpacetimeIdentityPorts,
  deleteAccount,
  disconnectAi as disconnectIdentityAi,
  saveFirstTask,
  saveHomeBasics,
  saveProfile,
  signOut,
  switchAccount,
  switchHome,
  homePreview,
  selectedFirstTaskItems,
  updateIdentityTextField,
  type IdentityFeatureState,
  type IdentityPorts,
  type IdentityRoute,
} from './features/identity';
import { sharedActionAvailability } from './features/household/availability.ts';
import { AgentShopping } from './services/agentShopping';
import { AgentCooking, type Recipe, type RecipeIngredient } from './services/agentCooking';
import { AgentInstamart, type InstamartCartPreparation, type InstamartShoppingState } from './services/agentInstamart';
import { AgentBilling, type SplitResult } from './services/agentBilling';
import { AIProvider } from './services/aiProvider';
import { AuthManager, type AuthUser } from './services/authManager';
import type { ActiveFlatSelection } from './services/residenceManager';
import { peopleListPresentation, selectFlatRoommates } from './services/roommateList';
import { createSubscriptionGroups } from './services/subscriptionPlan';
import {
  HouseholdConfigManager,
  type DietaryTag,
  type RoommateProfile,
} from './services/householdConfig';
import {
  TabbyBrain,
  type AgentIntent,
  type MemoryFact,
  type SharedContextRecord,
} from './services/tabbyBrain';

type MessageAgent = 'tabby' | AgentIntent;

interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant';
  agent: MessageAgent;
  text?: string;
  contentHtml?: string;
  pending?: boolean;
  progressLabel?: string;
  delivery?: 'sending' | 'unsent' | 'rejected' | 'sent';
  commandKey?: string;
  routes?: ConversationRoutePresentation[];
}

const app = document.querySelector<HTMLDivElement>('#app')!;

app.innerHTML = `
  <main class="app-frame household-workspace">
    <div class="offline-banner" id="offline-banner" role="status" aria-live="polite" hidden>
      <span><strong>Offline.</strong> Private messages stay on this device. Shared actions are unavailable until Tabby reconnects.</span>
      <button type="button" id="retry-connection">Retry connection</button>
    </div>
    <header class="command-rail top-bar" aria-label="Tabby household workspace">
      <div class="brand-block top-bar-brand">
        <div class="wordmark">tabby</div>
        <p>Home, handled.</p>
      </div>

      <div class="rail-card home-switcher" id="rail-flat-card">
        <button type="button" class="header-pill-badge home-switcher-button rail-card-header" id="header-flat-badge" title="Choose a home">
          <span class="rail-label">HOME</span>
          <span class="home-switcher-copy rail-card-title">
            <span class="rail-card-name" id="rail-flat-name">Choose a home</span>
            <span class="rail-card-sub" id="rail-residence-name">No shared home selected</span>
          </span>
          <span class="sr-only" id="header-flat-text">No shared home selected</span>
        </button>
      </div>

      <div class="pantry-status" aria-label="Pantry connection status">
        <span class="rail-label">PANTRY</span>
        <p class="connection-status"><span class="status-dot offline"></span><span id="status-text">Pantry is connecting</span></p>
      </div>

      ${routeNavigation('desktop-route-nav')}
      <button type="button" class="context-toggle top-bar-link" id="context-toggle" aria-expanded="false" aria-controls="context-panel"><span class="context-long">Home shelf</span><span class="context-short">Shelf</span></button>

      <div class="rail-card account-switcher" id="rail-user-card">
        <button type="button" class="header-pill-badge user-pill account-switcher-button rail-card-header" id="header-user-badge" title="Switch account">
          <span class="rail-avatar" id="rail-user-avatar">?</span>
          <span class="account-switcher-copy rail-card-title">
            <span class="rail-card-name" id="rail-user-name">Account</span>
            <span class="rail-card-sub" id="rail-user-phone">Set up your profile</span>
          </span>
          <span class="sr-only" id="header-user-text">Account not set up</span>
        </button>
      </div>

      <button type="button" class="quiet-button settings-trigger rail-card-btn" id="open-ai-settings">Settings</button>
    </header>

    <section class="conversation-shell" data-route-view="conversations">
      <header class="conversation-header conversation-toolbar">
        <div class="conversation-title-group">
          <p class="conversation-picker-label">PRIVATE TO YOU</p>
          <h1>Conversations</h1>
        </div>
        <div class="header-actions conversation-actions rail-actions">
          <label class="sr-only" for="conversation-picker">Choose conversation</label>
          <select id="conversation-picker" aria-label="Choose conversation"></select>
          <button type="button" class="quiet-button" id="new-conversation">New conversation</button>
          <div class="route-status idle" id="route-status" aria-live="polite">
            <span class="route-signal"></span>
            <span id="route-label">Ready</span>
          </div>
        </div>
      </header>

      <div class="conversation-workspace">
        <div id="conversation-feature-mount" class="conversation-feature-mount" hidden></div>
        <div class="conversation-live-detail">
          <div class="conversation conversation-transcript" id="conversation" aria-live="polite"></div>
        </div>
      </div>

      <div class="composer-zone conversation-composer-zone">
        <form class="composer" id="chat-form">
          <label class="sr-only" for="chat-input">Message Tabby</label>
          <textarea id="chat-input" rows="1" maxlength="3000" placeholder="Message Tabby" required></textarea>
          <div class="composer-footer">
            <div class="attachment-group">
              <label class="attachment-button" for="receipt-input">Add receipt</label>
              <input id="receipt-input" type="file" accept="image/png,image/jpeg,image/webp" />
              <span id="attachment-name"></span>
            </div>
            <button class="send-button" type="submit">Send</button>
          </div>
        </form>
        <p class="privacy-note">Private chat. Only items you explicitly save appear in the Home shelf.</p>
      </div>
    </section>

    <section class="route-page pantry-page" data-route-view="pantry" hidden>
      <header class="route-page-header">
        <div><p class="eyebrow">SHARED PANTRY</p><h1>Pantry</h1><p>Current items from this home. Shared changes require a connection.</p></div>
        <label class="pantry-search">Search pantry<input id="pantry-search" type="search" placeholder="Search items" /></label>
      </header>
      <div id="pantry-route-content" class="pantry-route-content" aria-live="polite">
        <div class="skeleton-list" aria-label="Loading pantry"><span></span><span></span><span></span></div>
      </div>
    </section>

    <section class="route-page expenses-page" data-route-view="expenses" hidden>
      <div id="expenses-route-content" class="expenses-route-content" aria-live="polite">
        <div class="skeleton-list route-skeleton" aria-label="Loading expenses"><span></span><span></span><span></span></div>
      </div>
    </section>

    <section class="route-page home-page" data-route-view="home" hidden>
      <header class="route-page-header"><div><p class="eyebrow">SHARED HOME</p><h1>Home</h1><p>People, notes, pantry, and agreements live on the Home shelf.</p></div></header>
      <div class="route-empty"><h2>Your shared home at a glance</h2><p>Use the Home shelf to review live household details. Nothing is filled with sample data.</p><button type="button" id="open-home-shelf" class="primary-button">Open Home shelf</button></div>
    </section>

    <aside class="context-panel home-shelf" id="context-panel" aria-label="Home shelf">
      <div class="context-header">
        <div>
          <h2>Home shelf</h2>
          <p>Shared household details, separate from private conversations.</p>
        </div>
        <button class="context-close" id="context-close" aria-label="Close Home shelf">Close</button>
      </div>
      <p class="shelf-offline" id="shelf-offline" hidden>Shared actions are unavailable while offline. You can still read the last synchronized shelf.</p>
      <div class="mobile-context-actions">
        <button id="mobile-new-conversation">New conversation</button>
        <button id="mobile-onboard">Switch home</button>
        <button id="mobile-login">Account</button>
        <button id="mobile-profile">Your profile</button>
        <button id="mobile-ai-settings">Settings</button>
      </div>
      <section class="context-section shelf-people">
        <div class="section-heading"><h3>People</h3><span id="people-count">0</span></div>
        <div id="people-list" class="context-list"></div>
      </section>
      <section class="context-section shelf-notes">
        <div class="section-heading"><h3>Home notes</h3><span id="memory-count">0</span></div>
        <div id="memory-list" class="context-list"></div>
      </section>
      <section class="context-section shelf-pantry">
        <div class="section-heading"><h3>In the kitchen</h3><span id="pantry-count">0</span></div>
        <form id="quick-pantry-form" class="quick-pantry-form">
          <input id="quick-pantry-name" placeholder="Add an item, such as milk" autocomplete="off" required />
          <input id="quick-pantry-qty" type="number" min="1" value="1" />
          <button type="submit" class="quick-add-btn">Add</button>
        </form>
        <div id="pantry-list" class="context-list"></div>
      </section>
      <section class="context-section shelf-agreements">
        <div class="section-heading"><h3>House agreements</h3><span id="rules-count">0</span></div>
        <form id="quick-rule-form" class="quick-rule-form">
          <select id="quick-rule-type">
            <option value="explicit">Agreed</option>
            <option value="implicit">Usual</option>
          </select>
          <input id="quick-rule-title" placeholder="Add a house agreement" autocomplete="off" required />
          <button type="submit" class="quick-add-btn">Add</button>
        </form>
        <div id="rules-list" class="context-list"></div>
      </section>
      <div id="shelf-summary-mount" class="shelf-summary-mount"></div>
      <div id="bill-review-mount" class="bill-review-mount"></div>
    </aside>
    <button type="button" class="drawer-scrim" id="drawer-scrim" aria-label="Close Home shelf" hidden></button>
  </main>

  ${routeNavigation('mobile-bottom-nav')}

  <section id="identity-flow" class="identity-flow" role="dialog" aria-modal="true" aria-label="Tabby setup and settings" hidden>
    <button type="button" class="identity-flow-close" id="identity-flow-close" aria-label="Close setup">Close</button>
    <div id="identity-flow-mount" class="identity-flow-mount"></div>
  </section>

  <dialog id="login-dialog" class="onboarding-dialog welcome-screen">
    <form id="login-form" class="settings-form onboarding-screen">
      <div class="dialog-heading">
        <div><p class="conversation-picker-label">WELCOME TO TABBY</p><h2>Run your home from one conversation.</h2><p>Groceries, meals, bills, notes, and house decisions stay in one place.</p></div>
        <button type="button" class="dialog-close" data-close-dialog="login-dialog">Close</button>
      </div>
      <div class="welcome-home-actions" aria-label="Set up a home">
        <button type="button" class="primary-button welcome-home-action create-home-action">Create a home</button>
        <button type="button" class="secondary-button welcome-home-action join-home-action">Choose an existing home</button>
      </div>
      <p class="returning-user-copy">Returning to Tabby? Sign in below.</p>
      <div class="onboarding-section-heading"><span>PRIVATE SETUP</span><strong>Your profile</strong></div>
      <label>Name<input id="login-name" placeholder="Your name" required /></label>
      <label>Phone number<input id="login-phone" placeholder="+91 98765 43210" required /></label>
      <p class="privacy-note">Your conversations stay private. Only items you explicitly save appear in the Home shelf.</p>
      <div class="dialog-actions">
        <button type="button" class="secondary-button" data-close-dialog="login-dialog">Cancel</button>
        <button type="submit" class="primary-button" id="login-submit-btn">Continue</button>
      </div>
    </form>
  </dialog>

  <dialog id="onboard-dialog" class="onboarding-dialog home-setup-screen">
    <form id="onboard-form" class="settings-form onboarding-screen">
      <div class="dialog-heading">
        <div><p class="conversation-picker-label">STEP 2 OF 3 · CREATE OR JOIN</p><h2>Create a home or join a home</h2><p>Choose an existing home, or create one people will recognise.</p></div>
        <button type="button" class="dialog-close" data-close-dialog="onboard-dialog">Close</button>
      </div>
      <label>Home<select id="onboard-residence" class="dialog-select"></select></label>
      <div id="new-residence-group" class="nested-input-group" hidden>
        <label>Home name<input id="new-res-name" placeholder="Sunshine Haven" /></label>
        <label>Area or building<input id="new-res-address" placeholder="Palm Grove Residency" /></label>
      </div>
      <label>Flat or address<select id="onboard-flat" class="dialog-select"></select></label>
      <div id="new-flat-group" class="nested-input-group" hidden>
        <label>Flat or address label<input id="new-flat-num" placeholder="Flat 402" /></label>
        <label>Home nickname<input id="new-flat-name" placeholder="Sunshine Haven" /></label>
      </div>
      <label>Your name in this home<input id="onboard-display-name" placeholder="Your name" required /></label>
      <section class="onboarding-preview">
        <p class="conversation-picker-label">STEP 3 OF 3 · INVITE AND BASICS</p>
        <h3>Bring the house together</h3>
        <p>Invite housemates and set optional basics later from the Home shelf.</p>
      </section>
      <div class="dialog-actions">
        <button type="button" class="secondary-button" data-close-dialog="onboard-dialog">Cancel</button>
        <button type="submit" class="primary-button" id="onboard-submit-btn">Continue to Tabby</button>
      </div>
    </form>
  </dialog>

  <dialog id="profile-dialog" class="onboarding-dialog profile-screen">
    <form id="profile-form" class="settings-form onboarding-screen">
      <div class="dialog-heading">
        <div><p class="conversation-picker-label">PRIVATE SETUP · STEP 1 OF 3</p><h2>Your profile</h2><p>Your name helps housemates recognise shared updates.</p></div>
        <button type="button" class="dialog-close" data-close-dialog="profile-dialog">Close</button>
      </div>
      <label>Name<input id="profile-name" autocomplete="name" required /></label>
      <fieldset>
        <legend>Dietary preferences</legend>
        <div class="choice-grid">
          <label><input type="checkbox" name="diet" value="vegetarian" /> Vegetarian</label>
          <label><input type="checkbox" name="diet" value="vegan" /> Vegan</label>
          <label><input type="checkbox" name="diet" value="eggetarian" /> Eggetarian</label>
          <label><input type="checkbox" name="diet" value="jain" /> Jain</label>
          <label><input type="checkbox" name="diet" value="halal" /> Halal</label>
          <label><input type="checkbox" name="diet" value="lactose_intolerant" /> Lactose-free</label>
          <label><input type="checkbox" name="diet" value="gluten_free" /> Gluten-free</label>
          <label><input type="checkbox" name="diet" value="no_alcohol" /> No alcohol</label>
        </div>
      </fieldset>
      <label>Meals you cook often<input id="profile-habits" placeholder="Dal, pasta, stir-fry" /></label>
      <p class="privacy-note">Your conversations stay private. Only items you explicitly save appear in the Home shelf.</p>
      <div class="dialog-actions">
        <button type="button" class="secondary-button" data-close-dialog="profile-dialog">Cancel</button>
        <button type="submit" class="primary-button">Save profile</button>
      </div>
    </form>
  </dialog>

  <dialog id="ai-dialog" class="settings-board">
    <form id="ai-form" class="settings-form settings-board-form">
      <div class="dialog-heading">
        <div><p class="conversation-picker-label">TABBY</p><h2>Settings and account</h2><p>Manage your profile, home, account, AI connection, and data.</p></div>
        <button type="button" class="dialog-close" data-close-dialog="ai-dialog">Close</button>
      </div>
      <div class="settings-grid">
        <section class="settings-card profile-settings-card">
          <h3>Your profile</h3>
          <p>Update the name, dietary preferences, and cooking habits Tabby uses.</p>
          <button type="button" class="secondary-button" id="open-profile">Edit profile</button>
        </section>
        <section class="settings-card home-settings-card">
          <h3>Choose a home</h3>
          <p>Switch homes, join an existing home, or create a new one.</p>
          <button type="button" class="secondary-button" id="open-onboard-dialog">Choose a home</button>
        </section>
        <section class="settings-card account-settings-card">
          <h3>Switch account</h3>
          <p>Switching accounts keeps this home unchanged.</p>
          <button type="button" class="secondary-button" id="open-login-dialog">Switch account</button>
        </section>
        <section class="settings-card ai-settings-card">
          <h3>AI connection</h3>
          <p>Optional connection. Core Tabby tools work without AI.</p>
          <div id="ai-status-indicator" class="ai-status-badge"></div>
          <label>OpenAI API key<input id="ai-key" type="password" autocomplete="off" placeholder="Enter a key to connect OpenAI" /></label>
          <label>Model<input id="ai-model" autocomplete="off" placeholder="gpt-5.6-sol" /></label>
          <button type="button" id="disconnect-ai" class="secondary-button danger-button" hidden>Disconnect AI</button>
        </section>
      </div>
      <div class="dialog-actions">
        <button type="button" class="secondary-button" data-close-dialog="ai-dialog">Cancel</button>
        <button type="submit" class="primary-button">Save AI connection</button>
      </div>
    </form>
  </dialog>

  <div id="toast-region" class="toast-region" aria-live="polite"></div>
`;

const host = import.meta.env.VITE_SPACETIMEDB_URI ?? 'https://maincloud.spacetimedb.com';
const database = import.meta.env.VITE_SPACETIMEDB_DB ?? 'tabby';
const tokenKey = `${host}/${database}/auth_token`;

function getStoredDatabaseToken() {
  try {
    return localStorage.getItem(tokenKey) ?? undefined;
  } catch {
    return undefined;
  }
}

function storeDatabaseToken(token: string) {
  try {
    localStorage.setItem(tokenKey, token);
  } catch (error) {
    console.warn('Could not persist the SpacetimeDB token:', error);
  }
}

let currentIdentity = '';
let isConnected = false;
let isConnecting = true;
let isDatabaseSynchronized = false;
let isPeopleSynchronized = false;
let attachedReceipt: string | undefined;
let attachedReceiptName = '';
let routeIntent: AgentIntent | 'idle' = 'idle';
let currentRecipes = new Map<string, Recipe>();
let currentInstamartCarts = new Map<string, InstamartCartPreparation>();
const currentShoppingLists = new Map<string, RecipeIngredient[]>();
let currentSplit: SplitResult | null = null;
let currentBillDraft: BillDraft | null = null;
let currentBillPhase: BillRecordPhase = { step: 'editing', acknowledgement: { status: 'idle' } };
let syncingConversation = false;
let conversationFeatureState: ConversationFeatureState = createConversationState();
let pantryFilters: PantryFilters = { stockState: 'all' };
let cookingConfirmation: CookingConfirmation | null = null;
let identityState: IdentityFeatureState = createIdentityState('welcome');
let requestedHomePath: 'create' | 'join' | null = null;
let identityReturnFocus: HTMLElement | null = null;
let identityCompletionVisible = false;
let editingExistingHomeBasics = false;
let identityEntryRoute: IdentityRoute | undefined;
let lastAiConnectionError: { model: string; message: string } | null = null;
const outboxes = new Map<string, PersistentOutbox>();
const pendingDeletions = new Map<string, PendingDeletion>();
const pendingDeletionHomes = new Map<string, string>();
const pendingDeletionTimers = new Map<string, number>();

const FIRST_TASK_STARTERS = [
  { id: 'starter-milk', label: 'Milk', selected: false },
  { id: 'starter-eggs', label: 'Eggs', selected: false },
  { id: 'starter-rice', label: 'Rice', selected: false },
  { id: 'starter-cooking-oil', label: 'Cooking oil', selected: false },
] as const;

const appStore = new AppStore({ route: 'conversations', connectivity: 'connecting', synchronized: false });
const commandCoordinator = new ActionCoordinator(() => isConnected && navigator.onLine !== false);

const welcomeMessage: ConversationMessage = {
  id: 'welcome',
  role: 'assistant',
  agent: 'tabby',
  text: 'Run your home from one conversation. Tell me what needs handling, from a pantry check or dinner to a bill or Home note.',
};

const emptyHomeSelection: ActiveFlatSelection = {
  residenceId: '', residenceName: '', flatId: '', flatName: '', flatNumber: '',
};

function activeHomeSelection(): ActiveFlatSelection {
  if (!connection || !currentIdentity) return emptyHomeSelection;
  const membership = householdGateway.homeMemberships()
    .find(row => row.identity.toHexString() === currentIdentity && row.active);
  if (!membership) return emptyHomeSelection;
  const home = householdGateway.homes().find(row => row.id === membership.flatId);
  if (!home) return emptyHomeSelection;
  const residence = householdGateway.residences().find(row => row.id === home.residenceId);
  return {
    residenceId: String(home.residenceId),
    residenceName: residence?.name ?? '',
    flatId: String(home.id),
    flatName: home.name,
    flatNumber: home.flatNumber,
  };
}

function getLocalConversation(id: string): ConversationMessage[] {
  if (!id) return [welcomeMessage];
  try {
    const raw = localStorage.getItem(`tabby_convo:${id}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return [welcomeMessage];
}

function conversationOwnerIdentity(): string {
  return currentIdentity || AuthManager.getCurrentUser().identity || 'local';
}

function conversationRegistryKey(identity: string): string {
  return `tabby_conversation_ids:${encodeURIComponent(identity.toLowerCase())}`;
}

function registerConversationArtifact(identity: string, id: string) {
  if (!id) return;
  try {
    const key = conversationRegistryKey(identity);
    const existing = JSON.parse(localStorage.getItem(key) || '[]');
    const ids = new Set(Array.isArray(existing) ? existing.filter(value => typeof value === 'string') : []);
    ids.add(id);
    localStorage.setItem(key, JSON.stringify([...ids]));
  } catch {}
}

function saveLocalConversation(id: string, messages: ConversationMessage[]) {
  if (!id) return;
  try {
    localStorage.setItem(`tabby_convo:${id}`, JSON.stringify(messages));
    localStorage.setItem('tabby_active_conversation_default', id);
    registerConversationArtifact(conversationOwnerIdentity(), id);
  } catch (err) {
    console.warn('Failed saving conversation to localStorage:', err);
  }
}

let activeConversationId = localStorage.getItem('tabby_active_conversation_default') || crypto.randomUUID();
localStorage.setItem('tabby_active_conversation_default', activeConversationId);
let conversation: ConversationMessage[] = getLocalConversation(activeConversationId);

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[character]!);
}

function money(paise: bigint) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(paise) / 100);
}

function formatCategory(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase());
}

function memberName(identity: string, name: string) {
  const clean = name.trim();
  return clean && clean.toLowerCase() !== 'roommate' ? clean : `Housemate ${identity.slice(0, 6)}`;
}

function currentIdentityHasMembership() {
  return Boolean(
    isConnected &&
    currentIdentity &&
    householdGateway.members().some(member => member.identity.toHexString() === currentIdentity),
  );
}

function showToast(
  message: string,
  tone: 'success' | 'error' = 'success',
  action?: { label: string; onClick: () => void | Promise<void> },
) {
  const toast = document.createElement('div');
  toast.className = `toast ${tone}`;
  const textSpan = document.createElement('span');
  textSpan.textContent = message;
  toast.appendChild(textSpan);

  if (action) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'toast-action';
    btn.textContent = action.label;
    btn.onclick = async (e) => {
      e.stopPropagation();
      toast.remove();
      await action.onClick();
    };
    toast.appendChild(btn);
  }

  document.querySelector('#toast-region')?.appendChild(toast);
  window.setTimeout(() => toast.remove(), action ? 8500 : 4200);
}

function setRoute(intent: AgentIntent | 'idle', busy = false) {
  routeIntent = intent;
  const status = document.querySelector<HTMLElement>('#route-status')!;
  const label = document.querySelector<HTMLElement>('#route-label')!;
  const labels: Record<typeof routeIntent, string> = {
    idle: 'Ready',
    general: 'Tabby',
    grocery: 'Pantry',
    chef: 'Kitchen',
    billing: 'Bills',
    context: 'Home notes',
  };
  status.className = `route-status ${intent} ${busy ? 'working' : ''}`;
  label.textContent = busy ? `${labels[intent]} working` : labels[intent];
}

async function persistConversationMessage(message: ConversationMessage) {
  if (!activeConversationId || syncingConversation || !currentIdentityHasMembership() || !canPersistConversationMessage(message)) return;
  await householdGateway.appendConversationMessage({
      conversationId: activeConversationId,
      messageKey: message.id,
      role: message.role,
      agent: message.agent,
      content: encodeStoredConversationMessage(message),
  });
}

type MessageOutboxPayload = {
  conversationId: string;
  messageId: string;
  role: string;
  agent: string;
  content: string;
  text: string;
};

function activeOutbox(): PersistentOutbox {
  const scope = `${currentIdentity || 'local'}:${activeHomeSelection().flatId || 'no-home'}`;
  let outbox = outboxes.get(scope);
  if (!outbox) {
    outbox = new PersistentOutbox({ identity: currentIdentity || 'local', homeId: activeHomeSelection().flatId || 'no-home' });
    outboxes.set(scope, outbox);
  }
  return outbox;
}

async function processOutboxCommand(command: Readonly<OutboxCommand>) {
  if (command.kind !== 'appendConversationMessage') throw new Error(`Unsupported queued command: ${command.kind}`);
  const payload = command.payload as MessageOutboxPayload;
  await householdGateway.appendConversationMessage({
    conversationId: payload.conversationId,
    messageKey: payload.messageId,
    role: payload.role,
    agent: payload.agent,
    content: payload.content,
  });
}

async function flushActiveOutbox() {
  if (!isConnected || navigator.onLine === false) return;
  const outbox = activeOutbox();
  const commands = await outbox.flush(processOutboxCommand);
  const bindings = Object.fromEntries(commands.map(command => [command.idempotencyKey, (command.payload as MessageOutboxPayload).messageId]));
  const deliveries = new ConversationDeliveryStore(currentIdentity || 'local').projectOutbox(bindings, commands);
  for (const delivery of deliveries) {
    const message = conversation.find(candidate => candidate.id === delivery.messageId);
    if (message) updateMessage(message.id, { delivery: delivery.status });
    const command = commands.find(candidate => candidate.id === delivery.commandId);
    if (delivery.status === 'sent' && command) {
      const payload = command.payload as MessageOutboxPayload;
      await routeAcknowledgedCommandOnce(command, payload);
    }
  }
}

async function routeAcknowledgedCommandOnce(command: Readonly<OutboxCommand>, payload: MessageOutboxPayload) {
  const routedKey = `tabby_outbox_routed:${command.id}`;
  const routeOnce = async () => {
    if (localStorage.getItem(routedKey) === '1') return;
    localStorage.setItem(routedKey, 'routing');
    try {
      await routeMessage(payload.text, `reply:${command.id}`);
      localStorage.setItem(routedKey, '1');
    } catch (cause) {
      localStorage.removeItem(routedKey);
      throw cause;
    }
  };
  if (navigator.locks) {
    await navigator.locks.request(`tabby:${routedKey}`, routeOnce);
  } else {
    await routeOnce();
  }
}

function addMessage(message: Omit<ConversationMessage, 'id'>, persist = true, id: string = crypto.randomUUID()) {
  const newMsg = { ...message, id };
  conversation.push(newMsg);
  saveLocalConversation(activeConversationId, conversation);
  renderConversation();
  if (persist) void persistConversationMessage(newMsg).catch(err => {
    console.warn('Failed persisting message to SpacetimeDB:', err);
  });
  return newMsg;
}

function updateMessage(id: string, patch: Partial<ConversationMessage>) {
  const message = conversation.find(candidate => candidate.id === id);
  if (!message) return;
  Object.assign(message, patch);
  saveLocalConversation(activeConversationId, conversation);
  renderConversation();
}

function completeProgressMessage(id: string, message: Omit<ConversationMessage, 'id'>) {
  const pending = conversation.find(candidate => candidate.id === id);
  if (!pending) {
    addMessage(message);
    return;
  }
  Object.assign(pending, message, { pending: false, progressLabel: undefined });
  saveLocalConversation(activeConversationId, conversation);
  renderConversation();
  void persistConversationMessage(pending).catch(err => console.warn('Failed persisting response:', err));
}

function syncConversationFromDatabase() {
  if (!activeConversationId) return;
  const rows = householdGateway.conversationMessages()
    .filter(row => row.conversationId === activeConversationId)
    .sort((a, b) => Number(a.id - b.id));
  syncingConversation = true;
  if (rows.length > 0) {
    conversation = rows.map(row => ({
      id: row.id.toString(),
      role: row.role === 'user' ? 'user' : 'assistant',
      agent: ['tabby', 'general', 'grocery', 'chef', 'billing', 'context'].includes(row.agent)
        ? row.agent as MessageAgent
        : 'tabby',
      ...decodeStoredConversationMessage(row.content),
    }));
    saveLocalConversation(activeConversationId, conversation);
  } else {
    const local = getLocalConversation(activeConversationId);
    conversation = local.length > 0 ? local : [welcomeMessage];
  }
  renderConversation();
  syncingConversation = false;
}

function selectConversation(id: string) {
  activeConversationId = id;
  const identity = currentIdentity || 'local';
  localStorage.setItem(`tabby_active_conversation:${identity}`, id);
  localStorage.setItem('tabby_active_conversation_default', id);
  conversationFeatureState = reduceConversationState(conversationFeatureState, {
    type: 'select', conversationId: id,
  });
  conversation = getLocalConversation(id);
  renderConversation();
  syncConversationFromDatabase();
}

function renderConversationPicker() {
  const picker = document.querySelector<HTMLSelectElement>('#conversation-picker')!;
  const rows = householdGateway.conversations()
    .sort((a, b) => Number(b.updatedAt.microsSinceUnixEpoch - a.updatedAt.microsSinceUnixEpoch));
  picker.innerHTML = rows.map((row, index) =>
    `<option value="${escapeHtml(row.id)}" ${row.id === activeConversationId ? 'selected' : ''}>${escapeHtml(row.title)}${index === 0 ? ' · Recent' : ''}</option>`
  ).join('');
  picker.disabled = rows.length === 0;
}

function ensureConversation() {
  if (!currentIdentityHasMembership()) {
    renderConversationPicker();
    return;
  }

  const rows = householdGateway.conversations();
  if (currentIdentity) rows.forEach(row => registerConversationArtifact(currentIdentity, row.id));
  const saved = (currentIdentity && localStorage.getItem(`tabby_active_conversation:${currentIdentity}`)) ||
    localStorage.getItem('tabby_active_conversation_default') ||
    activeConversationId;
  const selected = rows.find(row => row.id === saved) ||
    rows.sort((a, b) => Number(b.updatedAt.microsSinceUnixEpoch - a.updatedAt.microsSinceUnixEpoch))[0];

  if (selected) {
    selectConversation(selected.id);
  } else {
    const id = saved || activeConversationId || crypto.randomUUID();
    activeConversationId = id;
    if (currentIdentity) localStorage.setItem(`tabby_active_conversation:${currentIdentity}`, id);
    localStorage.setItem('tabby_active_conversation_default', id);
    try {
      connection.reducers.createConversation({ conversationId: id, title: 'New conversation' });
    } catch (err) {
      console.warn('createConversation notice:', err);
    }
    // Sync any existing local messages to SpacetimeDB!
    conversation.forEach(msg => {
      if (msg.id !== 'welcome' && msg.role) {
        persistConversationMessage(msg);
      }
    });
  }
  renderConversationPicker();
}

const EMPTY_CONVERSATION_STARTERS = [
  {
    label: 'What should we restock this week?',
    prompt: 'What should we restock this week?',
    icon: '<path d="M4 10h16l-2 9H6l-2-9Zm4 0 4-6 4 6M9 14v2m3-2v2m3-2v2"/>',
  },
  {
    label: 'What can we cook with what’s here?',
    prompt: 'What can we cook with what’s here?',
    icon: '<path d="M6 3v6a3 3 0 0 0 3 3V3m-3 4h3m6-4v18m0-18c3 2 4 5 4 8h-4"/>',
  },
  {
    label: 'Split this bill fairly.',
    prompt: 'Help me review and split a bill fairly.',
    icon: '<path d="M6 3h12v18l-2-1-2 1-2-1-2 1-2-1-2 1V3Zm3 5h6m-6 4h6m-6 4h4"/>',
  },
] as const;

function renderEmptyConversationHome(): string {
  return `<section class="empty-conversation-home" aria-labelledby="empty-home-title">
    <div class="empty-conversation-copy">
      <h1 id="empty-home-title">What needs handling?</h1>
      <p>Ask Tabby about groceries, dinner, a bill, or the home.</p>
    </div>
    <div class="empty-conversation-starters" aria-label="Suggested first messages">
      ${EMPTY_CONVERSATION_STARTERS.map(starter => `<button type="button" data-empty-prompt="${escapeHtml(starter.prompt)}"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${starter.icon}</svg><span>${escapeHtml(starter.label)}</span><span aria-hidden="true" class="starter-arrow">↗</span></button>`).join('')}
    </div>
  </section>`;
}

function bindEmptyConversationStarters() {
  document.querySelectorAll<HTMLButtonElement>('[data-empty-prompt]').forEach(button => {
    button.addEventListener('click', () => {
      const composer = document.querySelector<HTMLTextAreaElement>('#chat-input');
      if (!composer) return;
      composer.value = button.dataset.emptyPrompt || '';
      composer.dispatchEvent(new Event('input', { bubbles: true }));
      composer.focus();
    });
  });
}

function renderConversation() {
  const target = document.querySelector<HTMLElement>('#conversation')!;
  const visibleConversation = conversation.filter(message => message.id !== 'welcome');
  if (visibleConversation.length === 0) {
    target.innerHTML = renderEmptyConversationHome();
    bindEmptyConversationStarters();
    renderConversationFeature();
    return;
  }
  target.innerHTML = `<div class="conversation-day-label">Private chat</div>${visibleConversation.map(message => {
    const agentNames: Record<MessageAgent, string> = {
      tabby: 'Tabby',
      general: 'Tabby',
      grocery: 'Pantry',
      chef: 'Kitchen',
      billing: 'Bills',
      context: 'Home notes',
    };
    const agentLabel = message.role === 'assistant'
      ? `<span class="message-agent ${message.agent}">${agentNames[message.agent]}</span>`
      : '';
    return `
      <article class="message ${message.role} ${message.pending ? 'pending' : ''} ${message.delivery ?? ''}">
        ${agentLabel}
        <div class="message-content">
          ${message.contentHtml ?? `<p>${escapeHtml(message.text ?? '')}</p>`}
        </div>
        ${message.routes?.length ? `<ol class="message-route-results" aria-label="Request progress">${message.routes.map(route => `<li class="message-route-result route-${route.status}"><strong>${escapeHtml(route.intent === 'grocery' ? 'Pantry' : route.intent === 'chef' ? 'Kitchen' : route.intent === 'billing' ? 'Bills' : route.intent === 'context' ? 'Home notes' : 'Tabby')}</strong><span>${escapeHtml(route.error || route.summary || (route.status === 'pending' ? 'Working…' : route.status === 'unavailable' ? 'Unavailable' : 'Done'))}</span></li>`).join('')}</ol>` : ''}
        ${message.pending ? `<p class="message-progress" role="status"><span class="route-signal"></span>${escapeHtml(message.progressLabel || 'Tabby is working')}</p>` : ''}
        ${message.role === 'user' && message.delivery && message.delivery !== 'sent' ? `
          <div class="message-delivery" role="status">
            <span>${message.delivery === 'sending' ? 'Sending' : message.delivery === 'rejected' ? 'Could not send' : 'Not sent'}</span>
            ${message.commandKey && message.delivery !== 'sending' ? `<button type="button" data-retry-message="${escapeHtml(message.commandKey)}">Retry</button>` : ''}
          </div>` : ''}
      </article>
    `;
  }).join('')}`;
  bindMessageActions();
  document.querySelectorAll<HTMLButtonElement>('[data-retry-message]').forEach(button => {
    button.addEventListener('click', () => void retryMessage(button.dataset.retryMessage || ''));
  });
  requestAnimationFrame(() => target.scrollTo({ top: target.scrollHeight, behavior: 'smooth' }));
  renderConversationFeature();
}

function plainMessage(message: ConversationMessage): string {
  if (message.text) return message.text;
  if (!message.contentHtml) return '';
  const container = document.createElement('div');
  container.innerHTML = message.contentHtml;
  return container.textContent?.replace(/\s+/g, ' ').trim() || 'Household result';
}

function conversationRecords(): ConversationRecord[] {
  if (isConnected && isDatabaseSynchronized) {
    const rows = householdGateway.conversations()
      .sort((left, right) => Number(right.updatedAt.microsSinceUnixEpoch - left.updatedAt.microsSinceUnixEpoch));
    const messages = householdGateway.conversationMessages();
    const priorReadAt = new Map(conversationFeatureState.conversations.flatMap(record =>
      record.messages.filter(message => message.readAt).map(message => [message.id, message.readAt] as const)));
    if (rows.length) return rows.map(row => ({
      id: row.id,
      title: row.title,
      messages: messages.filter(message => message.conversationId === row.id)
        .sort((left, right) => Number(left.id - right.id))
        .map(message => {
          const decoded = decodeStoredConversationMessage(message.content);
          return {
            id: message.id.toString(),
            role: message.role === 'user' ? 'user' as const : 'assistant' as const,
            text: decoded.text || (() => {
              const node = document.createElement('div');
              node.innerHTML = decoded.contentHtml || '';
              return node.textContent?.replace(/\s+/g, ' ').trim() || 'Household result';
            })(),
            createdAt: message.createdAt.toISOString(),
            readAt: priorReadAt.get(message.id.toString()),
          };
        }),
    }));
  }
  return [{
    id: activeConversationId,
    title: conversation.find(message => message.role === 'user')?.text?.slice(0, 48) || 'New conversation',
    messages: conversation.map((message, index) => ({
      id: message.id,
      role: message.role,
      text: plainMessage(message),
      createdAt: new Date(Date.now() - Math.max(0, conversation.length - index) * 1_000).toISOString(),
      delivery: message.delivery,
      routes: message.routes,
    })),
  }];
}

function renderConversationFeature() {
  const target = document.querySelector<HTMLElement>('#conversation-feature-mount');
  if (!target) return;
  conversationFeatureState = reduceConversationState(conversationFeatureState, {
    type: 'replace', conversations: conversationRecords(),
  });
  if (!conversationFeatureState.activeConversationId && activeConversationId) {
    conversationFeatureState = reduceConversationState(conversationFeatureState, {
      type: 'select', conversationId: activeConversationId,
    });
  }
  const reminderCount = isDatabaseSynchronized ? householdGateway.reminders().length : 0;
  const starters = reminderCount > 0 ? [] : emptyHomeStarterSuggestions({
      synchronized: isDatabaseSynchronized,
      homeSelected: Boolean(activeHomeSelection().flatId),
      pantryCount: isDatabaseSynchronized ? householdGateway.pantryItems().length : 0,
      noteCount: isDatabaseSynchronized ? householdGateway.sharedMemories().length : 0,
      agreementCount: isDatabaseSynchronized ? householdGateway.flatRules().length : 0,
      billCount: isDatabaseSynchronized ? householdGateway.billReviews().length : 0,
    });
  target.innerHTML = renderConversationRoute(conversationFeatureState, { starters });
  target.querySelector<HTMLInputElement>('[data-conversation-search]')?.addEventListener('input', event => {
    conversationFeatureState = reduceConversationState(conversationFeatureState, {
      type: 'search', query: (event.currentTarget as HTMLInputElement).value,
    });
    renderConversationFeature();
  });
  target.querySelectorAll<HTMLButtonElement>('[data-conversation-id]').forEach(button => {
    button.addEventListener('click', () => selectConversation(button.dataset.conversationId || ''));
  });
  target.querySelectorAll<HTMLButtonElement>('[data-starter-prompt]').forEach(button => {
    button.addEventListener('click', () => {
      const composer = document.querySelector<HTMLTextAreaElement>('#chat-input');
      if (!composer) return;
      composer.value = button.dataset.starterPrompt || '';
      composer.focus();
    });
  });
}

function getSharedContext(): SharedContextRecord[] {
  return householdGateway.sharedMemories()
    .map(row => ({
      id: row.id.toString(),
      subjectIdentity: row.subjectIdentity.toHexString(),
      subjectName: row.subjectName,
      category: row.category as SharedContextRecord['category'],
      key: row.memoryKey,
      value: row.value,
      visibility: 'shared' as const,
      learnedAt: row.updatedAt.toISOString(),
    }))
    .sort((a, b) => b.learnedAt.localeCompare(a.learnedAt));
}

function getRoommates(): RoommateProfile[] {
  const shared = getSharedContext();
  const activeFlat = activeHomeSelection();
  const members = selectFlatRoommates(
    householdGateway.members().map(member => ({
      identityHex: member.identity.toHexString(),
      flatId: member.flatId.toString(),
      displayName: member.displayName,
    })),
    activeFlat.flatId,
    currentIdentity,
  );

  const result: RoommateProfile[] = [];

  for (const member of members) {
    const identity = member.identityHex;
    const displayName = memberName(identity, member.displayName);
    const profile = scopedHouseholdConfig()?.getProfile(identity, displayName) ?? {
      identityHex: identity,
      displayName,
      dietaryTags: [],
      cookingHabits: [],
      customSplitExclusions: [],
    };
    profile.displayName = displayName;
    const facts = shared.filter(record => record.subjectIdentity === identity);
    for (const fact of facts) {
      if (fact.category === 'diet') {
        const diet = fact.value.replace(/ /g, '_') as DietaryTag;
        if (!profile.dietaryTags.includes(diet)) profile.dietaryTags.push(diet);
      }
      if (fact.category === 'routine' && !profile.cookingHabits.includes(fact.value)) profile.cookingHabits.push(fact.value);
    }
    result.push(profile);
  }

  return result;
}

function currentName() {
  if (isConnected && currentIdentity) {
    const member = householdGateway.members()
      .find(row => row.identity.toHexString() === currentIdentity);
    const databaseName = member?.displayName.trim() || '';
    if (databaseName && !/^(?:housemate\s+)?(?:0x)?c200[a-f0-9]*$/i.test(databaseName)) {
      return databaseName;
    }
  }
  const currentUser = AuthManager.getCurrentUser();
  if (currentUser.isLoggedIn && currentUser.name.trim()) return currentUser.name.trim();
  return '';
}

interface LocalPantryItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
}

function scopedHouseholdConfig() {
  const identity = currentIdentity || AuthManager.getCurrentUser().identity || '';
  const homeId = activeHomeSelection().flatId;
  if (!identity || !homeId) return null;
  return HouseholdConfigManager.forScope({ identity, homeId });
}

function activeHomeCacheKey(namespace: 'pantry' | 'rules'): string | null {
  const identity = currentIdentity || AuthManager.getCurrentUser().identity || '';
  const homeId = activeHomeSelection().flatId;
  if (!identity || !/^\d+$/.test(homeId)) return null;
  return `tabby_local_${namespace}:${encodeURIComponent(identity.toLowerCase())}:${homeId}`;
}

function getLocalPantry(): LocalPantryItem[] {
  const key = activeHomeCacheKey('pantry');
  if (!key) return [];
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

function saveLocalPantry(items: LocalPantryItem[]) {
  const key = activeHomeCacheKey('pantry');
  if (!key) return;
  try {
    localStorage.setItem(key, JSON.stringify(items));
  } catch {}
}

function pantryData() {
  const dbRows = householdGateway.pantryItems().map(item => ({
    id: item.id.toString(),
    name: item.name,
    quantity: item.quantity,
    unit: item.unit,
  }));

  if (isDatabaseSynchronized) {
    saveLocalPantry(dbRows);
    return dbRows;
  }

  return getLocalPantry();
}

async function addOrUpdatePantryItem(name: string, quantity: number, unit: string) {
  const cleanName = name.trim().toLowerCase();
  if (!cleanName || quantity === 0) return { status: 'rejected' as const, error: new Error('Enter an item and quantity.') };

  const cleanUnit = unit.trim() || 'items';
  const commandKey = `pantry:${cleanName}:${Date.now()}`;
  const result = await commandCoordinator.execute(commandKey, async () => {
    await householdGateway.addPantryItem({ name: cleanName, quantity, unit: cleanUnit });
  });

  if (result.status === 'acknowledged') {
    const local = getLocalPantry();
    const existingIndex = local.findIndex(i => i.name.toLowerCase() === cleanName);
    if (existingIndex >= 0) {
      local[existingIndex].quantity = Math.max(0, local[existingIndex].quantity + quantity);
      local[existingIndex].unit = cleanUnit;
    } else if (quantity > 0) {
      local.push({ id: crypto.randomUUID(), name: cleanName, quantity, unit: cleanUnit });
    }
    saveLocalPantry(local.filter(i => i.quantity > 0));
    renderContextPanel();
    renderPantryRoute();
  }
  return result;
}

export interface LocalFlatRule {
  id: string;
  ruleType: 'implicit' | 'explicit';
  title: string;
  description: string;
}

function getLocalRules(): LocalFlatRule[] {
  const key = activeHomeCacheKey('rules');
  if (!key) return [];
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

function saveLocalRules(rules: LocalFlatRule[]) {
  const key = activeHomeCacheKey('rules');
  if (!key) return;
  try {
    localStorage.setItem(key, JSON.stringify(rules));
  } catch {}
}

function flatRulesData(): LocalFlatRule[] {
  if (connection?.db?.flatRule) {
    try {
      const dbRows = householdGateway.flatRules()
        .map(r => ({
          id: r.id.toString(),
          ruleType: (r.ruleType === 'implicit' ? 'implicit' : 'explicit') as 'implicit' | 'explicit',
          title: r.title,
          description: r.description || '',
        }));
      if (isDatabaseSynchronized) {
        saveLocalRules(dbRows);
        return dbRows;
      }
    } catch (e) {
      console.warn('flatRulesData read notice:', e);
    }
  }
  return getLocalRules();
}

async function addOrUpdateFlatRule(ruleType: 'implicit' | 'explicit', title: string, description = '') {
  const result = await commandCoordinator.execute(`rule:add:${Date.now()}`, async () => {
    await householdGateway.upsertFlatRule({
        id: 0n,
        ruleType,
        title,
        description,
    });
  });
  if (result.status === 'acknowledged') {
    const rules = getLocalRules();
    rules.push({ id: crypto.randomUUID(), ruleType, title, description });
    saveLocalRules(rules);
    renderContextPanel();
  }
  return result;
}

function pendingDeletionFor(kind: DeletableHouseholdRow['kind'], id: string): boolean {
  const activeHomeId = activeHomeSelection().flatId;
  return [...pendingDeletions.values()].some(pending =>
    pending.target.kind === kind &&
    pending.target.row.id.toString() === id &&
    pendingDeletionHomes.get(pending.token) === activeHomeId);
}

function removePendingDeletion(token: string) {
  pendingDeletions.delete(token);
  pendingDeletionHomes.delete(token);
  const timer = pendingDeletionTimers.get(token);
  if (timer !== undefined) window.clearTimeout(timer);
  pendingDeletionTimers.delete(token);
}

function scheduleHouseholdDeletion(target: DeletableHouseholdRow) {
  const homeId = activeHomeSelection().flatId;
  if (!isConnected || navigator.onLine === false || !homeId) {
    showToast('Reconnect before removing shared household items.', 'error');
    return;
  }

  const token = `delete:${homeId}:${target.kind}:${target.row.id}:${crypto.randomUUID()}`;
  const pending = scheduleDeletion(token, target, Date.now());
  pendingDeletions.set(token, pending);
  pendingDeletionHomes.set(token, homeId);
  renderContextPanel();
  renderPantryRoute();

  const label = target.kind === 'pantry' ? target.row.name : target.row.title;
  showToast(`${label} is pending removal.`, 'success', {
    label: 'Undo',
    onClick: () => {
      const current = pendingDeletions.get(token);
      if (!current || !undoDeletion(current, Date.now()).restored) return;
      removePendingDeletion(token);
      renderContextPanel();
      renderPantryRoute();
      showToast(`${label} was restored.`);
    },
  });

  const timer = window.setTimeout(async () => {
    const current = pendingDeletions.get(token);
    if (!current) return;
    const action = deletionActionWhenDue(current, Date.now());
    if (!action) return;
    if (pendingDeletionHomes.get(token) !== activeHomeSelection().flatId) {
      removePendingDeletion(token);
      renderContextPanel();
      renderPantryRoute();
      showToast(`${label} was restored because the active home changed.`, 'error');
      return;
    }
    const result = await commandCoordinator.execute(token, () => householdGateway.executeHouseholdAction(action));
    removePendingDeletion(token);
    if (result.status === 'acknowledged') {
      if (target.kind === 'pantry') saveLocalPantry(getLocalPantry().filter(row => row.id !== target.row.id.toString()));
      else saveLocalRules(getLocalRules().filter(row => row.id !== target.row.id.toString()));
      showToast(`${label} was removed.`);
    } else {
      showToast(result.status === 'rejected' ? result.error.message : `${label} was restored because Tabby went offline.`, 'error');
    }
    renderContextPanel();
    renderPantryRoute();
  }, Math.max(0, pending.deleteAtMs - Date.now()));
  pendingDeletionTimers.set(token, timer);
}

function renderContextPanel() {
  const roommates = getRoommates();
  const peoplePresentation = peopleListPresentation(isPeopleSynchronized, roommates.length);
  const memory = getSharedContext();
  const pantry = pantryData().filter(item => item.quantity > 0 && !pendingDeletionFor('pantry', item.id)).sort((a, b) => a.name.localeCompare(b.name));
  const rules = flatRulesData().filter(rule => !pendingDeletionFor('rule', rule.id));
  const shared = currentSharedAvailability();
  const deletionAvailable = shared.available;

  document.querySelector('#people-count')!.textContent = peoplePresentation.countLabel;
  document.querySelector('#memory-count')!.textContent = String(memory.length);
  document.querySelector('#pantry-count')!.textContent = String(pantry.length);
  document.querySelector('#rules-count')!.textContent = String(rules.length);

  document.querySelector('#people-list')!.innerHTML = peoplePresentation.showRows
    ? roommates.map(roommate => `
      <div class="person-row">
        <span class="avatar">${escapeHtml(roommate.displayName.slice(0, 1).toUpperCase())}</span>
        <span><strong>${escapeHtml(roommate.displayName)}</strong><small>${roommate.identityHex === currentIdentity ? 'You' : 'Housemate'}</small></span>
      </div>`).join('')
    : `<p class="empty-state">${escapeHtml(peoplePresentation.emptyMessage)}</p>`;

  document.querySelector('#memory-list')!.innerHTML = !isDatabaseSynchronized
    ? '<div class="skeleton-list" aria-label="Loading Home notes"><span></span><span></span></div>'
    : memory.length
    ? memory.slice(0, 8).map(fact => `
      <div class="memory-row">
        <span class="memory-category">${escapeHtml(formatCategory(fact.category))}</span>
        <p><strong>${escapeHtml(fact.subjectName)}</strong> · ${escapeHtml(fact.value)}</p>
      </div>`).join('')
    : '<p class="empty-state">Nothing saved yet. Ask Tabby to remember a shared Home note.</p>';

  document.querySelector('#pantry-list')!.innerHTML = !isDatabaseSynchronized
    ? '<div class="skeleton-list" aria-label="Loading pantry"><span></span><span></span><span></span></div>'
    : pantry.length
    ? pantry.map(item => `
      <div class="pantry-row">
        <span>${escapeHtml(item.name)}</span>
        <div class="pantry-actions">
          <strong>${item.quantity} ${escapeHtml(item.unit)}</strong>
          <button type="button" class="pantry-item-del" data-remove-pantry="${escapeHtml(item.id)}" data-shared-action title="Remove item" ${!deletionAvailable || !/^\d+$/.test(item.id) ? 'disabled' : ''}>×</button>
        </div>
      </div>`).join('')
    : '<p class="empty-state">The kitchen is empty. Add an item here or ask Pantry to save what you bought.</p>';

  document.querySelector('#rules-list')!.innerHTML = !isDatabaseSynchronized
    ? '<div class="skeleton-list" aria-label="Loading agreements"><span></span><span></span></div>'
    : rules.length
    ? rules.map(rule => `
      <div class="rule-row">
        <div class="rule-row-header">
          <span class="rule-badge ${rule.ruleType}">${rule.ruleType}</span>
          <button type="button" class="pantry-item-del" data-remove-rule="${escapeHtml(rule.id)}" data-shared-action title="Delete rule" ${!deletionAvailable || !/^\d+$/.test(rule.id) ? 'disabled' : ''}>×</button>
        </div>
        <div class="rule-title">${escapeHtml(rule.title)}</div>
        ${rule.description ? `<small style="color: var(--muted);">${escapeHtml(rule.description)}</small>` : ''}
      </div>`).join('')
    : '<p class="empty-state">No house agreements yet. Add an agreed or usual house rule above.</p>';

  document.querySelectorAll<HTMLButtonElement>('[data-remove-pantry]').forEach(btn => {
    btn.onclick = () => {
      const id = btn.dataset.removePantry || '';
      const current = pantry.find(item => item.id === id);
      if (current && /^\d+$/.test(id)) scheduleHouseholdDeletion({ kind: 'pantry', row: { id: BigInt(id), name: current.name } });
    };
  });

  document.querySelectorAll<HTMLButtonElement>('[data-remove-rule]').forEach(btn => {
    btn.onclick = () => {
      const id = btn.dataset.removeRule || '';
      const current = rules.find(rule => rule.id === id);
      if (current && /^\d+$/.test(id)) scheduleHouseholdDeletion({ kind: 'rule', row: { id: BigInt(id), title: current.title } });
    };
  });

  const pantryViews = isDatabaseSynchronized
    ? pantryViewItems(householdGateway.pantryItems(), householdGateway.pantryItemDetails())
      .filter(item => !pendingDeletionFor('pantry', item.id.toString()))
    : [];
  const reminders = isDatabaseSynchronized
    ? reminderViews(householdGateway.reminders(), BigInt(Date.now()) * 1_000n)
    : [];
  const shelfSummary = document.querySelector<HTMLElement>('#shelf-summary-mount');
  if (shelfSummary) shelfSummary.innerHTML = renderHomeShelfSummary({
    homeName: activeHomeSelection().flatName,
    people: roommates,
    pantry: pantryViews,
    notes: memory.map(item => ({ title: item.value })),
    agreements: rules.map(item => ({ title: item.title })),
    reminders,
    online: shared.available,
    mobile: contextIsDrawer(),
  });
  const reminderMount = document.querySelector<HTMLElement>('#reminder-shelf-mount');
  if (reminderMount) {
    reminderMount.innerHTML = renderReminderShelf(reminders, shared.available);
    reminderMount.querySelectorAll<HTMLButtonElement>('[data-complete-reminder]').forEach(button => {
      button.addEventListener('click', async () => {
        const id = button.closest<HTMLElement>('[data-reminder-id]')?.dataset.reminderId;
        if (!id) return;
        button.disabled = true;
        const result = await commandCoordinator.execute(`reminder:complete:${id}`, () =>
          householdGateway.executeHouseholdAction(completeReminderAction(BigInt(id))));
        if (result.status !== 'acknowledged') {
          button.disabled = false;
          showToast(result.status === 'rejected' ? result.error.message : 'Reconnect to complete this reminder.', 'error');
        }
      });
    });
  }
}

function renderPantryRoute() {
  const target = document.querySelector<HTMLElement>('#pantry-route-content');
  if (!target) return;
  if (!isDatabaseSynchronized) {
    target.innerHTML = '<div class="skeleton-list route-skeleton" aria-label="Loading pantry"><span></span><span></span><span></span></div>';
    return;
  }
  const items = pantryViewItems(householdGateway.pantryItems(), householdGateway.pantryItemDetails())
    .filter(item => !pendingDeletionFor('pantry', item.id.toString()));
  const shared = currentSharedAvailability();
  target.innerHTML = renderRichPantryRoute(items, {
    nowMicros: BigInt(Date.now()) * 1_000n,
    online: shared.available,
    mobile: window.matchMedia('(max-width: 720px)').matches,
    filters: pantryFilters,
  });
  const search = target.querySelector<HTMLInputElement>('[data-pantry-search]');
  const category = target.querySelector<HTMLSelectElement>('[data-pantry-category]');
  const location = target.querySelector<HTMLSelectElement>('[data-pantry-location]');
  const stock = target.querySelector<HTMLSelectElement>('[data-pantry-stock]');
  if (category) category.value = pantryFilters.category || '';
  if (location) location.value = pantryFilters.location || '';
  if (stock) stock.value = pantryFilters.stockState || 'all';
  const updateFilters = () => {
    pantryFilters = {
      query: search?.value || '',
      category: category?.value || '',
      location: location?.value || '',
      stockState: (stock?.value || 'all') as PantryFilters['stockState'],
    };
    renderPantryRoute();
  };
  search?.addEventListener('input', updateFilters);
  category?.addEventListener('change', updateFilters);
  location?.addEventListener('change', updateFilters);
  stock?.addEventListener('change', updateFilters);
}

function renderExpensesRoute() {
  const target = document.querySelector<HTMLElement>('#expenses-route-content');
  if (!target) return;
  if (!isDatabaseSynchronized) {
    target.innerHTML = '<div class="skeleton-list route-skeleton" aria-label="Loading expenses"><span></span><span></span><span></span></div>';
    return;
  }

  const members = householdGateway.members();
  const currentMember = members.find(member => member.identity.toHexString() === currentIdentity);
  if (!currentMember) {
    target.innerHTML = '<div class="route-empty"><h2>Choose your shared home</h2><p>Expenses and balances appear after you join a synchronized home.</p><button type="button" data-route="conversations">Back to conversations</button></div>';
    target.querySelector<HTMLButtonElement>('[data-route="conversations"]')?.addEventListener('click', () => navigateTo('conversations'));
    return;
  }

  const projection = projectExpenseBalances({
    currentIdentity: currentMember.identity,
    members,
    expenses: householdGateway.expenses(),
    metadata: householdGateway.expenseMetadata().map(row => ({
      expenseId: row.expenseId,
      expenseDateMicros: row.expenseDate.microsSinceUnixEpoch,
      recordedAtMicros: row.recordedAt.microsSinceUnixEpoch,
      splitMethod: row.splitMethod,
    })),
    splits: householdGateway.expenseSplits(),
    settlements: householdGateway.expenseSettlements().map(row => ({
      id: row.id,
      debtorIdentity: row.debtorIdentity,
      creditorIdentity: row.creditorIdentity,
      amountPaise: row.amountPaise,
      settledAtMicros: row.settledAt.microsSinceUnixEpoch,
    })),
  });
  const shared = currentSharedAvailability();
  target.innerHTML = renderExpenseBalances(projection, { online: shared.available, currentIdentity });
  target.querySelectorAll<HTMLButtonElement>('[data-route="conversations"]').forEach(button => {
    button.addEventListener('click', () => navigateTo('conversations'));
  });
  target.querySelectorAll<HTMLButtonElement>('[data-settle-counterparty]').forEach(button => {
    button.addEventListener('click', async () => {
      const counterpartyHex = button.dataset.settleCounterparty || '';
      const counterparty = members.find(member => member.identity.toHexString() === counterpartyHex);
      if (!counterparty) return showToast('That household member is no longer available.', 'error');
      button.disabled = true;
      button.textContent = 'Settling';
      const result = await commandCoordinator.execute(`expense:settle:${currentIdentity}:${counterpartyHex}`, () =>
        householdGateway.settleExpensePair(counterparty.identity));
      if (result.status === 'acknowledged') {
        showToast(`Balance with ${counterparty.displayName} settled.`, 'success');
      } else {
        button.disabled = !shared.available;
        button.textContent = 'Settle up';
        showToast(result.status === 'rejected' ? result.error.message : 'Reconnect before settling this balance.', 'error');
      }
    });
  });
}

async function publishSharedFacts(facts: MemoryFact[]): Promise<number> {
  if (!facts.length) return 0;
  if (!isConnected || !currentIdentity || navigator.onLine === false) {
    throw new Error('Reconnect before saving a shared Home note.');
  }
  const existing = getSharedContext();
  let saved = 0;
  for (const fact of facts) {
    const duplicate = existing.some(record =>
      record.subjectIdentity === currentIdentity &&
      record.category === fact.category &&
      record.key === fact.key &&
      record.value.toLowerCase() === fact.value.toLowerCase()
    );
    if (!duplicate) {
      const result = await commandCoordinator.execute(`home-note:${fact.category}:${fact.key}:${crypto.randomUUID()}`, () =>
        connection.reducers.upsertSharedMemory({
          category: fact.category,
          memoryKey: fact.key,
          value: fact.value,
          sourceMessageId: 0n,
        }));
      if (result.status !== 'acknowledged') {
        throw result.status === 'rejected' ? result.error : new Error('Reconnect before saving a shared Home note.');
      }
      existing.push({
        ...fact,
        subjectIdentity: currentIdentity,
        subjectName: currentName(),
      });
      saved += 1;
    }
  }
  return saved;
}

function renderShoppingPlan(plan: Awaited<ReturnType<typeof AgentShopping.generateShoppingPlan>>) {
  const items = plan.items.slice(0, 8);
  const listId = crypto.randomUUID();
  currentShoppingLists.set(listId, items.map(item => ({
    name: item.itemName,
    quantity: item.suggestedQuantity,
    unit: item.unit,
    inPantry: false,
  })));
  return `
    <div class="agent-result">
      <div class="result-heading"><h3>Restock plan</h3><span>${items.length} suggestions</span></div>
      <p>${escapeHtml(plan.summary)}</p>
      <div class="result-list">
        ${items.map(item => `
          <div class="result-row">
            <div><strong>${escapeHtml(item.itemName)}</strong><small>${escapeHtml(item.reason)}</small></div>
            <div class="row-action"><span>${item.suggestedQuantity} ${escapeHtml(item.unit)}</span><button data-add-pantry="${escapeHtml(item.itemName)}" data-quantity="${item.suggestedQuantity}" data-unit="${escapeHtml(item.unit)}">Add</button></div>
          </div>`).join('')}
      </div>
      ${items.length ? `<button class="instamart-button shopping-checkout" data-shop-list="${escapeHtml(listId)}">Checkout groceries</button>` : ''}
    </div>`;
}

async function checkoutVisibleGroceries(button: HTMLButtonElement, ingredients: RecipeIngredient[]): Promise<void> {
  button.textContent = 'Ordering groceries';
  button.disabled = true;
  button.parentElement?.querySelector('[data-instamart-review]')?.remove();
  const sessionId = `conversation:${activeConversationId}`;
  const previousState = synchronizedShoppingState(sessionId);
  const requestedItems = ingredients
    .filter(item => !item.inPantry)
    .map(({ name, quantity, unit }) => ({ name, quantity, unit }));
  const attemptState: InstamartShoppingState = {
    sessionId,
    phase: 'selected',
    addressId: previousState?.addressId || '',
    requestedItems,
    selectedItems: previousState?.selectedItems || [],
    cart: previousState?.cart ?? null,
    payment: previousState?.payment ?? null,
    toolContext: [
      ...(previousState?.toolContext || []),
      { name: 'checkout_requested', arguments: { items: requestedItems }, result: { status: 'started' } },
    ].slice(-40),
    pendingConfirmation: false,
  };
  try {
    await persistShoppingState(attemptState);
  } catch (cause) {
    console.warn('Could not synchronize the initial shopping attempt:', cause);
  }
  try {
    const result = await AgentInstamart.checkoutRecipe(ingredients, {
      sessionId,
      priorState: attemptState,
      fallbackAddress: selectedHomeDeliveryAddress(),
    });
    const data = (result.order.data && typeof result.order.data === 'object' ? result.order.data : result.order) as Record<string, unknown>;
    const orderId = String(data.orderId || 'created');
    const unavailable = result.prepared.unavailable.map(item => item.name);
    button.insertAdjacentHTML('afterend', `<div class="instamart-review" data-instamart-review><strong>Instamart order placed</strong><p>Order ${escapeHtml(orderId)} is confirmed. ${result.prepared.matches.length} product${result.prepared.matches.length === 1 ? '' : 's'} ordered.${unavailable.length ? ` Not found: ${escapeHtml(unavailable.join(', '))}.` : ''}</p></div>`);
    button.textContent = 'Groceries ordered';
    if (result.state) {
      try {
        await persistShoppingState(result.state);
        showToast('Instamart order placed and shopping context synchronized.');
      } catch (cause) {
        console.warn('Order placed, but shopping context could not be synchronized:', cause);
        showToast('Order placed. Shopping history will synchronize after Tabby reconnects.', 'error');
      }
    } else {
      showToast('Instamart order placed successfully.');
    }
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    try {
      await persistShoppingState({
        ...attemptState,
        phase: 'failed',
        toolContext: [
          ...attemptState.toolContext,
          { name: 'checkout_failed', arguments: { items: requestedItems }, result: { error: message } },
        ].slice(-40),
      });
    } catch (stateCause) {
      console.warn('Could not synchronize the failed shopping attempt:', stateCause);
    }
    button.textContent = 'Checkout groceries';
    button.disabled = false;
    showToast(message, 'error');
  }
}

function selectedHomeDeliveryAddress(): { addressLine: string; label: string } | undefined {
  const selected = activeHomeSelection();
  if (!selected.flatId) return undefined;
  const home = householdGateway.homes().find(row => String(row.id) === selected.flatId);
  const residence = home && householdGateway.residences().find(row => row.id === home.residenceId);
  const addressLine = [selected.flatNumber, residence?.address].filter(Boolean).join(', ').trim();
  return addressLine ? { addressLine, label: selected.flatName || residence?.name || 'Tabby home' } : undefined;
}

function synchronizedShoppingState(sessionId: string): InstamartShoppingState | undefined {
  const row = householdGateway.shoppingAgentStates().find(candidate => candidate.sessionId === sessionId);
  if (!row) return undefined;
  const parse = <T>(value: string, fallback: T): T => {
    try { return JSON.parse(value) as T; } catch { return fallback; }
  };
  return {
    sessionId: row.sessionId,
    phase: row.phase as InstamartShoppingState['phase'],
    addressId: row.addressId,
    requestedItems: parse(row.requestedItemsJson, []),
    selectedItems: parse(row.selectedItemsJson, []),
    cart: parse(row.cartJson, null),
    payment: parse(row.paymentJson, null),
    toolContext: parse(row.toolContextJson, []),
    pendingConfirmation: row.pendingConfirmation,
  };
}

async function persistShoppingState(state: InstamartShoppingState): Promise<void> {
  if (!connection || !currentSharedAvailability().available) throw new Error('Tabby is not synchronized with the selected home.');
  await connection.reducers.upsertShoppingAgentState({
    sessionId: state.sessionId,
    phase: state.phase,
    addressId: state.addressId,
    requestedItemsJson: JSON.stringify(state.requestedItems),
    selectedItemsJson: JSON.stringify(state.selectedItems),
    cartJson: JSON.stringify(state.cart),
    paymentJson: JSON.stringify(state.payment),
    toolContextJson: JSON.stringify(state.toolContext.slice(-40)),
    pendingConfirmation: state.pendingConfirmation,
  });
}

function renderCookingPlan(plan: Awaited<ReturnType<typeof AgentCooking.generateRecipes>>) {
  currentRecipes = new Map(plan.recipes.map(recipe => [recipe.id, recipe]));
  currentInstamartCarts = new Map();
  const recipes = plan.recipes.slice(0, 4);
  return `
    <div class="agent-result">
      <div class="result-heading"><h3>Recipe plan</h3><span>${recipes.length} option${recipes.length === 1 ? '' : 's'}</span></div>
      <p>${escapeHtml(plan.headline)}</p>
      <div class="recipe-grid">
        ${recipes.map(recipe => {
          const atHome = recipe.ingredients.filter(ingredient => ingredient.inPantry);
          const toBuy = recipe.ingredients.filter(ingredient => !ingredient.inPantry);
          const substitutions = recipe.ingredients.filter(ingredient => ingredient.substitution?.trim());
          const ingredientRows = (items: typeof recipe.ingredients, empty: string) => items.length
            ? items.map(ingredient => `<li><span>${escapeHtml(ingredient.name)}</span><small>${escapeHtml(`${ingredient.quantity ?? ''} ${ingredient.unit ?? ''}`.trim())}</small></li>`).join('')
            : `<li class="recipe-empty">${empty}</li>`;
          return `
            <article class="recipe-card">
              <div class="recipe-meta"><span>${recipe.prepTimeMinutes + recipe.cookTimeMinutes} min · ${recipe.servings} serving${recipe.servings === 1 ? '' : 's'}</span><span>${toBuy.length} to buy</span></div>
              <h4>${escapeHtml(recipe.title)}</h4>
              <p>${escapeHtml(recipe.description)}</p>
              <div class="recipe-supplies">
                <section><h5>Use from home</h5><ul>${ingredientRows(atHome, 'No tracked pantry items')}</ul></section>
                <section><h5>Buy</h5><ul>${ingredientRows(toBuy, 'Nothing else needed')}</ul></section>
              </div>
              ${substitutions.length ? `<div class="recipe-substitutions"><h5>Smart substitutions</h5>${substitutions.map(ingredient => `<p><strong>${escapeHtml(ingredient.name)}:</strong> ${escapeHtml(ingredient.substitution!)}</p>`).join('')}</div>` : ''}
              <details class="recipe-steps">
                <summary>Cooking steps</summary>
                <ol>${recipe.instructions.map(step => `<li>${escapeHtml(step)}</li>`).join('')}</ol>
                ${recipe.tips ? `<p><strong>Kitchen note:</strong> ${escapeHtml(recipe.tips)}</p>` : ''}
              </details>
              <small>Suitable for ${escapeHtml(recipe.compatibleRoommates.join(', ') || 'the household')}</small>
              <div class="recipe-actions">
                <button data-cook-recipe="${escapeHtml(recipe.id)}">Cook this</button>
              </div>
            </article>`;
        }).join('')}
      </div>
    </div>`;
}

function renderSplit(split: SplitResult) {
  currentSplit = split;
  const members = householdGateway.members();
  const payerRow = members.find(member => member.identity.toHexString() === currentIdentity) || members[0];
  if (!payerRow) return '<div class="agent-result"><p>Join a synchronized home before reviewing a shared bill.</p></div>';
  const billMembers = members.map(member => ({ identity: member.identity, displayName: memberName(member.identity.toHexString(), member.displayName) }));
  const adjustedLines = split.lineItems.map(line => ({ ...line }));
  if (split.taxOrDiscountPaise > 0n) {
    adjustedLines.push({
      id: 'receipt-adjustment',
      name: 'Taxes and charges',
      pricePaise: split.taxOrDiscountPaise,
      category: 'general',
      assignedRoommates: billMembers.map(member => member.identity.toHexString()),
      excludedRoommates: [],
      exemptionReasons: {},
    });
  } else if (split.taxOrDiscountPaise < 0n) {
    let discountRemaining = -split.taxOrDiscountPaise;
    for (let index = adjustedLines.length - 1; index >= 0 && discountRemaining > 0n; index -= 1) {
      const available = adjustedLines[index].pricePaise - 1n;
      const applied = available > discountRemaining ? discountRemaining : available;
      adjustedLines[index].pricePaise -= applied;
      discountRemaining -= applied;
    }
  }
  currentBillDraft = {
    title: split.billTitle,
    category: 'general',
    payer: billMembers.find(member => member.identity.toHexString() === payerRow.identity.toHexString())!,
    expenseDateMicros: BigInt(Date.now()) * 1_000n,
    lines: adjustedLines.map(line => {
      const participants = line.assignedRoommates.length || billMembers.length;
      const share = line.pricePaise / BigInt(participants);
      const remainder = line.pricePaise % BigInt(participants);
      let participatingIndex = 0;
      return {
        id: line.id,
        label: line.name,
        amountPaise: line.pricePaise,
        allocations: billMembers.map(member => {
          const identity = member.identity.toHexString();
          const exempt = line.excludedRoommates.includes(identity);
          const participating = line.assignedRoommates.includes(identity) || (!line.assignedRoommates.length && !exempt);
          const amountPaise = participating ? share + (participatingIndex++ === 0 ? remainder : 0n) : 0n;
          return { member, amountPaise, exempt, reason: line.exemptionReasons[identity] || '' };
        }),
      };
    }),
  };
  currentBillPhase = { step: 'editing', acknowledgement: { status: 'idle' } };
  return renderBillReview(currentBillDraft, currentSharedAvailability().available, currentBillPhase, window.matchMedia('(max-width: 720px)').matches);
}

async function executeIntent(
  intent: AgentIntent,
  text: string,
  analysis: Awaited<ReturnType<typeof TabbyBrain.analyze>>,
): Promise<{ message: Omit<ConversationMessage, 'id'>; summary: string }> {
  if (intent === 'grocery') {
    const pantryCommand = parsePantryCommand(text);
    if (pantryCommand) {
      const { name, quantity, unit } = pantryCommand;
      const result = await addOrUpdatePantryItem(name, quantity, unit);
      if (result.status !== 'acknowledged') throw result.status === 'rejected' ? result.error : new Error('The pantry action is waiting for a connection.');
      const response = `Added ${quantity} ${unit} of ${name} to the shared pantry.`;
      return { message: { role: 'assistant', agent: intent, text: response }, summary: response };
    }
    const plan = await AgentShopping.generateShoppingPlan(pantryData(), getRoommates(), text);
    return { message: { role: 'assistant', agent: intent, contentHtml: renderShoppingPlan(plan) }, summary: plan.summary };
  }
  if (intent === 'billing') {
    if (!attachedReceipt && !/\d/.test(text)) {
      const response = 'Paste one item per line, such as “Rice - 450”, or attach a receipt image. I will apply the household dietary rules to the split.';
      return { message: { role: 'assistant', agent: intent, text: response }, summary: 'Bill details requested.' };
    }
    const split = await AgentBilling.parseAndSplitBill(
      { text, imageBase64: attachedReceipt, title: attachedReceiptName || 'Household expense' }, getRoommates(),
      scopedHouseholdConfig()?.getRules() ?? [],
    );
    return { message: { role: 'assistant', agent: intent, contentHtml: renderSplit(split) }, summary: `Reviewed ${split.lineItems.length} bill lines.` };
  }
  if (intent === 'context') {
    const answer = TabbyBrain.answerContextQuestion(text, getSharedContext());
    const saved = await publishSharedFacts(analysis.shareableFacts);
    const response = saved
      ? `Saved ${saved} shared Home note${saved === 1 ? '' : 's'}.`
      : analysis.shareableFacts.length
        ? 'That Home note was already shared.'
      : (answer || 'No matching shared Home note was found.');
    return { message: { role: 'assistant', agent: intent, text: response }, summary: response };
  }
  if (intent === 'chef') {
    const plan = await AgentCooking.generateRecipes(pantryData(), getRoommates(), text);
    return { message: { role: 'assistant', agent: intent, contentHtml: renderCookingPlan(plan) }, summary: plan.headline };
  }
  if (!AIProvider.hasApiKey()) {
    const response = 'AI is not connected. Core pantry, bill, reminder, and Home note tools remain available.';
    return { message: { role: 'assistant', agent: 'general', text: response }, summary: response };
  }
  const recentConversation = conversation.slice(-10).map(message => `${message.role}: ${message.text || 'Structured household result'}`).join('\n');
  const householdContext = getSharedContext().slice(0, 12).map(memory => `${memory.subjectName}: ${memory.value}`).join('; ');
  const generated = await AIProvider.generateText(
    `Recent conversation:\n${recentConversation}\n\nCurrent request:\n${text}`,
    `You are Tabby, a concise household coordination assistant. Do not claim an action happened unless it was performed. Shared household context: ${householdContext || 'No shared memories yet.'}`,
    attachedReceipt,
  );
  const response = generated || 'The AI connection could not complete that request.';
  return { message: { role: 'assistant', agent: 'general', text: response }, summary: response.slice(0, 120) };
}

async function routeMessage(text: string, responseMessageId?: string) {
  const personalAnswer = TabbyBrain.answerPersonalQuestion(text, currentName());
  if (personalAnswer) return void addMessage({ role: 'assistant', agent: 'general', text: personalAnswer }, true, responseMessageId);
  setRoute('general', true);
  const progress = addMessage(
    { role: 'assistant', agent: 'general', pending: true, progressLabel: 'Tabby is understanding your request' },
    false,
    responseMessageId,
  );
  try {
    const analysis = await settleWithin(
      TabbyBrain.analyze(text, conversation, getSharedContext()),
      30_000,
      'Tabby took too long to understand that request. Please try again.',
    );
    TabbyBrain.savePrivateFacts(currentIdentity || 'local', analysis.privateFacts);
    const routes = pendingRoutePresentation(analysis.intents);
    updateMessage(progress.id, { routes, progressLabel: 'Household routes are working in order' });
    const content: string[] = [];
    for (const [index, intent] of analysis.intents.entries()) {
      setRoute(intent, true);
      try {
        const result = await settleWithin(
          executeIntent(intent, text, analysis),
          45_000,
          'This household action took too long. Please try again.',
        );
        content.push(`<section class="inline-route-result route-${intent}">${result.message.contentHtml || `<p>${escapeHtml(result.message.text || '')}</p>`}</section>`);
        routes[index] = { intent, status: 'acknowledged', summary: result.summary };
      } catch (cause) {
        const error = cause instanceof Error ? cause.message : String(cause);
        content.push(`<section class="inline-route-result route-${intent} route-failed"><p>${escapeHtml(error)}</p></section>`);
        routes[index] = { intent, status: 'failed', error };
      }
      updateMessage(progress.id, { agent: intent, routes: [...routes] });
    }
    completeProgressMessage(progress.id, {
      role: 'assistant', agent: analysis.intents.at(-1) || 'general', contentHtml: content.join(''), routes,
    });
  } catch (cause) {
    const error = cause instanceof Error ? cause.message : String(cause);
    completeProgressMessage(progress.id, {
      role: 'assistant',
      agent: 'general',
      text: error || 'Tabby could not complete that request. Please try again.',
    });
  } finally {
    setRoute('idle', false);
    attachedReceipt = undefined;
    attachedReceiptName = '';
    (document.querySelector<HTMLInputElement>('#receipt-input')!).value = '';
    document.querySelector('#attachment-name')!.textContent = '';
    renderContextPanel();
  }
}

async function waitForSubscribed<T>(read: () => T | undefined, message: string, timeoutMs = 8_000): Promise<T> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const value = read();
    if (value !== undefined) return value;
    await new Promise(resolve => window.setTimeout(resolve, 50));
  }
  throw new Error(message);
}

function updateCurrentBillReviewMarkup() {
  if (!currentBillDraft) return;
  const rendered = renderBillReview(
    currentBillDraft,
    currentSharedAvailability().available,
    currentBillPhase,
    window.matchMedia('(max-width: 720px)').matches,
  );
  for (let index = conversation.length - 1; index >= 0; index -= 1) {
    const message = conversation[index];
    if (!message.contentHtml?.includes('data-bill-review')) continue;
    const container = document.createElement('div');
    container.innerHTML = message.contentHtml;
    const review = container.querySelector<HTMLElement>('[data-bill-review]');
    if (!review) continue;
    review.outerHTML = rendered;
    conversation[index] = { ...message, contentHtml: container.innerHTML };
    return;
  }
}

async function recordCurrentBill() {
  if (!currentBillDraft) return;
  if (currentBillPhase.step === 'recorded') {
    showToast('This bill is already recorded.');
    return;
  }
  currentBillPhase = startBillRecord(currentBillDraft, currentSharedAvailability().available);
  updateCurrentBillReviewMarkup();
  renderConversation();
  if (currentBillPhase.step !== 'creating-review') return;
  try {
    const amountPaise = currentBillDraft.lines.reduce((total, line) => total + line.amountPaise, 0n);
    const shareTotals = new Map<string, bigint>();
    for (const line of currentBillDraft.lines) {
      for (const allocation of line.allocations) {
        const identity = allocation.member.identity.toHexString();
        const amount = allocation.exempt ? 0n : allocation.amountPaise;
        shareTotals.set(identity, (shareTotals.get(identity) ?? 0n) + amount);
      }
    }
    const synchronizedMembers = householdGateway.members();
    const shares = [...shareTotals].map(([identity, shareAmountPaise]) => {
      const member = synchronizedMembers.find(candidate => candidate.identity.toHexString() === identity);
      if (!member) throw new Error('A person in this split is no longer in the active home.');
      return { member, shareAmountPaise };
    });
    const payer = synchronizedMembers.find(member => member.identity.toHexString() === currentBillDraft!.payer.identity.toHexString());
    if (!payer) throw new Error('Choose a payer who belongs to the active home.');
    const amounts = shares.map(share => share.shareAmountPaise);
    const lowestShare = amounts.reduce((lowest, amount) => amount < lowest ? amount : lowest, amounts[0] ?? 0n);
    const highestShare = amounts.reduce((highest, amount) => amount > highest ? amount : highest, amounts[0] ?? 0n);
    const splitMethod = amounts.length > 0 && highestShare - lowestShare <= 1n
      ? 'equal'
      : 'adjusted';
    await householdGateway.recordExpenseV2({
      title: currentBillDraft.title,
      amountPaise,
      paidBy: payer.identity,
      expenseDate: new Timestamp(currentBillDraft.expenseDateMicros),
      splitMethod,
      memberIdentities: shares.map(share => share.member.identity),
      shareAmountsPaise: amounts,
    });
    currentBillPhase = billRecordingAcknowledged(0n);
    updateCurrentBillReviewMarkup();
    renderConversation();
    showToast('Bill recorded. Expenses and household balances are now up to date.', 'success');
  } catch (cause) {
    currentBillPhase = billRecordRejected(currentBillPhase, cause instanceof Error ? cause.message : String(cause));
    updateCurrentBillReviewMarkup();
    renderConversation();
  }
}

function bindMessageActions() {
  const shared = currentSharedAvailability();
  document.querySelectorAll<HTMLButtonElement>('[data-shop-list]').forEach(button => {
    button.onclick = () => {
      const items = currentShoppingLists.get(button.dataset.shopList || '');
      if (items?.length) void checkoutVisibleGroceries(button, items);
    };
  });

  document.querySelectorAll<HTMLButtonElement>('[data-add-pantry]').forEach(button => {
    button.disabled = !shared.available;
    button.setAttribute('aria-disabled', String(!shared.available));
    if (!shared.available) button.title = shared.reason || 'Shared action unavailable';
    button.onclick = async () => {
      const name = button.dataset.addPantry || '';
      const qty = Math.max(1, Math.round(Number(button.dataset.quantity)));
      const unit = button.dataset.unit || 'items';
      button.textContent = 'Adding';
      button.disabled = true;
      const result = await addOrUpdatePantryItem(name, qty, unit);
      if (result.status === 'acknowledged') {
        button.textContent = 'Added';
        showToast(`Added ${qty} ${unit} of ${name} to the pantry.`);
      } else {
        button.textContent = 'Add';
        button.disabled = !shared.available;
        showToast(result.status === 'rejected' ? result.error.message : 'Waiting for a connection.', 'error');
      }
    };
  });

  document.querySelectorAll<HTMLButtonElement>('[data-cook-recipe]').forEach(button => {
    button.disabled = !shared.available;
    button.setAttribute('aria-disabled', String(!shared.available));
    button.onclick = async () => {
      const recipe = currentRecipes.get(button.dataset.cookRecipe!);
      if (!recipe) return;
      const toBuy = recipe.ingredients.filter(item => !item.inPantry);
      const pantry = pantryData();
      const changes = recipe.ingredients.filter(item => item.inPantry).flatMap(ingredient => {
        const match = pantry.find(item => {
          const pantryName = item.name.toLowerCase();
          const ingredientName = ingredient.name.toLowerCase();
          return pantryName.includes(ingredientName) || ingredientName.includes(pantryName);
        });
        return match && match.quantity > 0 ? [{ name: match.name, quantityUsed: 1, unit: match.unit }] : [];
      });
      const host = button.closest<HTMLElement>('.recipe-card') || button.parentElement;
      host?.querySelector<HTMLElement>('[data-cooking-workflow]')?.remove();
      cookingConfirmation = changes.length ? createCookingConfirmation(recipe.title, changes) : null;
      const pantryStep = cookingConfirmation
        ? renderCookingConfirmation(cookingConfirmation, shared.available)
        : `<section class="cooking-confirmation status-confirmed" data-cooking-confirmation><header><p class="eyebrow">READY TO SHOP</p><h2>${escapeHtml(recipe.title)}</h2></header><p>No tracked pantry quantities need updating.</p></section>`;
      host?.insertAdjacentHTML('beforeend', `<section class="cooking-workflow" data-cooking-workflow>
        ${pantryStep}
        ${toBuy.length ? `<div class="cooking-checkout"><p>Order these items from Instamart:</p><ul>${toBuy.map(item => `<li><span>${escapeHtml(item.name)}</span><strong>${escapeHtml(`${item.quantity ?? ''} ${item.unit ?? ''}`.trim())}</strong></li>`).join('')}</ul><button class="instamart-button" data-cook-checkout>Checkout groceries</button></div>` : '<p class="cooking-checkout-complete">Everything needed is already at home.</p>'}
      </section>`);
      const workflow = host?.querySelector<HTMLElement>('[data-cooking-workflow]');
      const checkout = workflow?.querySelector<HTMLButtonElement>('[data-cook-checkout]');
      if (checkout) checkout.onclick = () => void checkoutVisibleGroceries(checkout, recipe.ingredients);
      const confirm = workflow?.querySelector<HTMLButtonElement>('[data-confirm-cooking]');
      confirm?.addEventListener('click', async () => {
        if (!cookingConfirmation) return;
        confirm.disabled = true;
        for (const action of confirmCookingActions(cookingConfirmation, shared.available)) {
          if (action.reducer !== 'addPantryItem') continue;
          const result = await commandCoordinator.execute(`cooking:${recipe.id}:${action.payload.name}`, () => householdGateway.executeHouseholdAction(action));
          if (result.status !== 'acknowledged') {
            showToast(result.status === 'rejected' ? result.error.message : 'Reconnect before updating the pantry.', 'error');
            confirm.disabled = false;
            return;
          }
          cookingConfirmation = cookingAcknowledged(cookingConfirmation, action.payload.name);
        }
        const rendered = workflow?.querySelector<HTMLElement>('[data-cooking-confirmation]');
        if (rendered) rendered.outerHTML = renderCookingConfirmation(cookingConfirmation, shared.available);
        showToast(`Started ${recipe.title}. Pantry changes were acknowledged.`);
      });
    };
  });

  document.querySelectorAll<HTMLButtonElement>('[data-shop-recipe]').forEach(button => {
    button.onclick = async () => {
      const recipe = currentRecipes.get(button.dataset.shopRecipe!);
      if (!recipe) return;
      await checkoutVisibleGroceries(button, recipe.ingredients);
    };
  });

  document.querySelectorAll<HTMLButtonElement>('[data-record-expense]').forEach(button => {
    button.disabled = !shared.available;
    button.setAttribute('aria-disabled', String(!shared.available));
    button.onclick = async () => {
      if (!currentSplit || !shared.available) return showToast(shared.reason || 'Connect to the shared home before recording an expense.', 'error');
      button.textContent = 'Recording';
      button.disabled = true;
      const result = await commandCoordinator.execute(`expense:${Date.now()}`, async () => {
        await householdGateway.recordExpense({ title: currentSplit!.billTitle, amountPaise: currentSplit!.totalAmountPaise });
      });
      if (result.status === 'acknowledged') {
        button.textContent = 'Recorded';
        showToast('The household expense was recorded.');
      } else {
        button.textContent = 'Record household expense';
        button.disabled = !isConnected;
        showToast(result.status === 'rejected' ? result.error.message : 'Waiting for a connection.', 'error');
      }
    };
  });

  document.querySelectorAll<HTMLElement>('[data-bill-review]').forEach(review => {
    review.querySelector<HTMLSelectElement>('[data-bill-payer]')?.addEventListener('change', event => {
      if (!currentBillDraft) return;
      const identity = (event.currentTarget as HTMLSelectElement).value;
      const member = currentBillDraft.lines.flatMap(line => line.allocations.map(allocation => allocation.member))
        .find(candidate => candidate.identity.toHexString() === identity);
      if (member) currentBillDraft = setBillPayer(currentBillDraft, member);
    });
    review.querySelector<HTMLInputElement>('[data-bill-date]')?.addEventListener('change', event => {
      if (!currentBillDraft) return;
      const date = new Date(`${(event.currentTarget as HTMLInputElement).value}T12:00:00`);
      if (!Number.isNaN(date.getTime())) currentBillDraft = setBillDate(currentBillDraft, BigInt(date.getTime()) * 1_000n);
    });
    review.querySelectorAll<HTMLInputElement>('[data-allocation-member]').forEach(input => {
      const apply = () => {
        if (!currentBillDraft) return;
        const lineId = input.closest<HTMLElement>('[data-line-id]')?.dataset.lineId || '';
        const member = currentBillDraft.lines.flatMap(line => line.allocations.map(allocation => allocation.member))
          .find(candidate => candidate.identity.toHexString() === input.dataset.allocationMember);
        const exempt = input.closest('label')?.querySelector<HTMLInputElement>('[data-allocation-exempt]')?.checked || false;
        if (member) currentBillDraft = assignBillLine(currentBillDraft, lineId, member, BigInt(input.value || '0'), { exempt });
      };
      input.addEventListener('change', apply);
      input.closest('label')?.querySelector<HTMLInputElement>('[data-allocation-exempt]')?.addEventListener('change', apply);
    });
    review.querySelector<HTMLButtonElement>('[data-record-bill]')?.addEventListener('click', () => void recordCurrentBill());
  });
}

function renderInstamartReview(prepared: InstamartCartPreparation): string {
  const total = instamartCartTotal(prepared.cart);
  return `
    <section class="instamart-review" data-instamart-review>
      <div class="instamart-review-heading"><strong>Instamart cart</strong><span>${prepared.matches.length} matched</span></div>
      <ul>
        ${prepared.matches.map(match => `<li><span>${escapeHtml(match.productName)} <small>${escapeHtml(match.pack)} × ${match.quantity}</small></span><strong>${formatRupees(match.price * match.quantity)}</strong></li>`).join('')}
      </ul>
      ${prepared.unavailable.length ? `<p class="instamart-unavailable">Not found: ${prepared.unavailable.map(item => escapeHtml(item.name)).join(', ')}</p>` : ''}
      <dl>
        <div><dt>Deliver to</dt><dd>${escapeHtml(prepared.deliveryAddress)}</dd></div>
        <div><dt>Payment</dt><dd>${escapeHtml(prepared.paymentMethod)}</dd></div>
        <div><dt>Live total</dt><dd>${total === null ? 'Shown by Instamart at checkout' : formatRupees(total)}</dd></div>
      </dl>
      <p>This is a test order. Review the matched products, total, payment method, and address before placing it.</p>
      <button class="instamart-confirm" data-confirm-instamart="${escapeHtml(prepared.sessionId)}">Place order</button>
    </section>`;
}

function bindInstamartConfirmation(host: HTMLElement | null): void {
  const button = host?.querySelector<HTMLButtonElement>('[data-confirm-instamart]');
  if (!button) return;
  button.onclick = async () => {
    const sessionId = button.dataset.confirmInstamart || '';
    if (!currentInstamartCarts.has(sessionId)) return;
    button.disabled = true;
    button.textContent = 'Placing order';
    try {
      const result = await AgentInstamart.checkout(sessionId);
      currentInstamartCarts.delete(sessionId);
      const data = (result.data && typeof result.data === 'object' ? result.data : result) as Record<string, unknown>;
      const orderId = String(data.orderId || 'created');
      const review = host?.querySelector<HTMLElement>('[data-instamart-review]');
      if (review) review.innerHTML = `<strong>Instamart order placed</strong><p>Order ${escapeHtml(orderId)} is confirmed in the test environment. No real purchase was made.</p>`;
      showToast('Instamart order placed successfully.');
    } catch (cause) {
      button.disabled = false;
      button.textContent = 'Place order';
      showToast(cause instanceof Error ? cause.message : String(cause), 'error');
    }
  };
}

function instamartCartTotal(cart: Record<string, unknown>): number | null {
  const pricing = (cart.pricing && typeof cart.pricing === 'object' ? cart.pricing : {}) as Record<string, unknown>;
  for (const value of [pricing.toPay, pricing.to_pay, pricing.total, cart.total, cart.cartTotal]) {
    const number = Number(value);
    if (Number.isFinite(number) && number >= 0) return number;
  }
  return null;
}

function formatRupees(value: number): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);
}

function renderHeaderAndRailBadges() {
  const currentUser = AuthManager.getCurrentUser();
  const activeFlat = activeHomeSelection();
  const signedInName = currentUser.isLoggedIn ? currentUser.name.trim() : '';

  // Header badges
  const headerFlatText = document.querySelector<HTMLElement>('#header-flat-text');
  const headerUserText = document.querySelector<HTMLElement>('#header-user-text');
  if (headerFlatText) {
    headerFlatText.textContent = activeFlat.flatId ? `${activeFlat.flatName} · ${activeFlat.flatNumber}` : 'No shared home selected';
  }
  if (headerUserText) {
    headerUserText.textContent = signedInName || 'Account not set up';
  }

  // Rail cards
  const railUserName = document.querySelector<HTMLElement>('#rail-user-name');
  const railUserPhone = document.querySelector<HTMLElement>('#rail-user-phone');
  const railUserAvatar = document.querySelector<HTMLElement>('#rail-user-avatar');
  const railFlatName = document.querySelector<HTMLElement>('#rail-flat-name');
  const railResidenceName = document.querySelector<HTMLElement>('#rail-residence-name');

  if (railUserName) railUserName.textContent = signedInName || 'Account';
  if (railUserPhone) railUserPhone.textContent = signedInName ? (currentUser.phone || 'Phone not set') : 'Set up your profile';
  if (railUserAvatar) railUserAvatar.textContent = signedInName ? signedInName.slice(0, 1).toUpperCase() : '?';
  if (railFlatName) railFlatName.textContent = activeFlat.flatName || 'Choose a home';
  if (railResidenceName) railResidenceName.textContent = activeFlat.flatId ? `${activeFlat.flatNumber}, ${activeFlat.residenceName}` : 'No shared home selected';
}

function renderAll() {
  renderContextPanel();
  renderPantryRoute();
  renderExpensesRoute();
  renderHeaderAndRailBadges();
  const offline = !isConnected || navigator.onLine === false;
  const shared = sharedActionAvailability(isConnected, navigator.onLine !== false, currentActiveHomeId());
  const status = document.querySelector('#status-text')!;
  status.textContent = isDatabaseSynchronized && !shared.available && !offline
    ? shared.reason || 'Choose a home to use shared household tools'
    : isDatabaseSynchronized
    ? 'Pantry checked just now'
    : isConnected
      ? 'Pantry is checking the home'
      : isConnecting
        ? 'Pantry is reconnecting'
        : 'Offline: private messages remain on this device';
  document.querySelector('.status-dot')?.classList.toggle('offline', !isConnected);
  const offlineBanner = document.querySelector<HTMLElement>('#offline-banner');
  if (offlineBanner) offlineBanner.hidden = !offline;
  const shelfOffline = document.querySelector<HTMLElement>('#shelf-offline');
  if (shelfOffline) {
    shelfOffline.hidden = shared.available;
    shelfOffline.textContent = shared.reason || '';
  }
  document.querySelector('#context-panel')?.classList.toggle('is-offline', !shared.available);
  document.querySelectorAll<HTMLInputElement | HTMLButtonElement | HTMLSelectElement>('[data-shared-action], #quick-pantry-form input, #quick-pantry-form button, #quick-rule-form input, #quick-rule-form select, #quick-rule-form button, #quick-reminder-form input, #quick-reminder-form button')
    .forEach(control => {
      control.disabled = !shared.available;
      control.setAttribute('aria-disabled', String(!shared.available));
      if (!shared.available) control.title = shared.reason || 'Shared action unavailable';
      else control.removeAttribute('title');
    });
  bindMessageActions();
  appStore.update({
    connectivity: isConnected ? 'online' : isConnecting ? 'connecting' : 'offline',
    synchronized: isDatabaseSynchronized,
  });
}

function syncAiStatus() {
  const status = [...connection.db.myAiStatus.iter()][0];
  const isBackendConfigured = Boolean(status?.configured);
  const isBackendVerified = Boolean(status?.verified);
  const modelName = status?.model || AIProvider.getModelName() || (import.meta.env.VITE_OPENAI_MODEL as string | undefined)?.trim() || 'gpt-5.6-sol';

  if (currentIdentity) AIProvider.setConfigured(isBackendConfigured, modelName);

  const isVerified = isBackendVerified;
  const isConfigured = isBackendConfigured;

  document.querySelector('#open-ai-settings')!.textContent = 'Settings';
  document.querySelector('#mobile-ai-settings')!.textContent = isVerified
    ? 'Settings · AI connected'
    : isConfigured
      ? 'Settings · Verify AI'
      : 'Settings';
}

const DATABASE_RECONNECT_BASE_DELAY_MS = 1_000;
const DATABASE_RECONNECT_MAX_DELAY_MS = 30_000;

let connection!: DbConnection;
function currentActiveHomeId(): bigint | null {
  const value = activeHomeSelection().flatId;
  return /^\d+$/.test(value) ? BigInt(value) : null;
}
function currentSharedAvailability() {
  return sharedActionAvailability(isConnected, navigator.onLine !== false, currentActiveHomeId());
}
const householdGateway = createHouseholdGateway(() => connection, currentActiveHomeId);
let databaseToken = getStoredDatabaseToken();
let connectionGeneration = 0;
let reconnectAttempt = 0;
let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
let connectionAttemptInFlight = false;
let firstRunPromptShown = false;

function maybeShowFirstRunOnboarding(hasMembership: boolean) {
  if (hasMembership || firstRunPromptShown) return;
  firstRunPromptShown = true;
  const user = AuthManager.getCurrentUser();
  if (user.isLoggedIn && user.name.trim()) {
    showOnboardingDialog();
  } else {
    showLoginDialog();
  }
}

function showFreshSessionOnboarding() {
  const user = AuthManager.getCurrentUser();
  if (user.isLoggedIn || firstRunPromptShown) return;
  firstRunPromptShown = true;
  showLoginDialog();
}

function attachDatabaseListeners(conn: DbConnection) {
  const ifCurrent = (callback: () => void) => () => {
    if (conn === connection) callback();
  };
  const syncResidences = ifCurrent(() => {
    renderAll();
    refreshOpenIdentityFlowFromDatabase();
  });

  conn.db.residence.onInsert(syncResidences);
  conn.db.residence.onUpdate(syncResidences);
  conn.db.flat.onInsert(syncResidences);
  conn.db.flat.onUpdate(syncResidences);
  const syncActiveHome = ifCurrent(() => {
    renderAll();
    ensureConversation();
    refreshOpenIdentityFlowFromDatabase();
  });
  conn.db.member.onInsert(syncActiveHome);
  conn.db.member.onUpdate(syncActiveHome);
  conn.db.member.onDelete(syncActiveHome);
  conn.db.flatRule.onInsert(ifCurrent(renderAll));
  conn.db.flatRule.onUpdate(ifCurrent(renderAll));
  conn.db.flatRule.onDelete(ifCurrent(renderAll));
  conn.db.member.onInsert(ifCurrent(() => {
    renderAll();
    if (isPeopleSynchronized && isDatabaseSynchronized) ensureConversation();
  }));
  conn.db.member.onUpdate(ifCurrent(renderAll));
  conn.db.member.onDelete(ifCurrent(renderAll));
  conn.db.pantryItem.onInsert(ifCurrent(renderAll));
  conn.db.pantryItem.onUpdate(ifCurrent(renderAll));
  conn.db.pantryItem.onDelete(ifCurrent(renderAll));
  conn.db.sharedMemory.onInsert(ifCurrent(renderAll));
  conn.db.sharedMemory.onUpdate(ifCurrent(renderAll));
  conn.db.expense.onInsert(ifCurrent(renderAll));
  conn.db.expense.onUpdate(ifCurrent(renderAll));
  conn.db.expenseMetadata.onInsert(ifCurrent(renderAll));
  conn.db.expenseMetadata.onUpdate(ifCurrent(renderAll));
  conn.db.expenseSettlement.onInsert(ifCurrent(renderAll));
  conn.db.expenseSplit.onInsert(ifCurrent(renderAll));
  conn.db.expenseSplit.onUpdate(ifCurrent(renderAll));
  conn.db.myAiStatus.onInsert(ifCurrent(syncAiStatus));
  conn.db.myAiStatus.onUpdate(ifCurrent(syncAiStatus));
  conn.db.myAiStatus.onDelete(ifCurrent(syncAiStatus));
  conn.db.myConversations.onInsert(ifCurrent(() => {
    renderConversationPicker();
    if (!activeConversationId) ensureConversation();
  }));
  conn.db.myConversations.onUpdate(ifCurrent(renderConversationPicker));
  conn.db.myConversationMessages.onInsert(ifCurrent(syncConversationFromDatabase));
}

function scheduleDatabaseReconnect(generation: number) {
  if (generation !== connectionGeneration || reconnectTimer) return;

  isConnected = false;
  isConnecting = true;
  isDatabaseSynchronized = false;
  isPeopleSynchronized = false;
  const delay = Math.min(
    DATABASE_RECONNECT_BASE_DELAY_MS * 2 ** reconnectAttempt,
    DATABASE_RECONNECT_MAX_DELAY_MS,
  );
  reconnectAttempt += 1;
  reconnectTimer = setTimeout(() => {
    if (generation !== connectionGeneration) return;
    reconnectTimer = undefined;
    connectToDatabase();
  }, delay);
  renderAll();
}

function connectToDatabase() {
  if (connectionAttemptInFlight || isConnected) return;

  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = undefined;
  }

  const previousConnection = connection;
  const generation = ++connectionGeneration;
  if (previousConnection && !previousConnection.isDisconnectRequested) {
    previousConnection.disconnect();
  }

  connectionAttemptInFlight = true;
  isConnecting = true;
  isDatabaseSynchronized = false;
  isPeopleSynchronized = false;

  const nextConnection = DbConnection.builder()
    .withUri(host)
    .withDatabaseName(database)
    .withToken(databaseToken)
    .onConnect((ctx, identity, token) => {
      if (generation !== connectionGeneration) return;

      databaseToken = token;
      storeDatabaseToken(token);
      AgentInstamart.useDatabaseToken(token);
      currentIdentity = identity.toHexString();
      AIProvider.setIdentityScope(currentIdentity);
      const accountTokenKey = `${tokenKey}:${currentIdentity}`;
      localStorage.setItem(accountTokenKey, token);
      AuthManager.observeConnection({ identity: currentIdentity, tokenLabel: accountTokenKey });
      TabbyBrain.savePrivateFacts(currentIdentity, TabbyBrain.getPrivateFacts('local'));
      connectionAttemptInFlight = false;
      isConnecting = false;
      isConnected = true;
      isDatabaseSynchronized = false;
      isPeopleSynchronized = false;
      renderAll();

      const [peopleSubscription, householdSubscription] = createSubscriptionGroups(
        householdSubscriptionTables.people,
        [
          ...householdSubscriptionTables.household,
          tables.myConversations,
          tables.myConversationMessages,
          tables.myAiStatus,
        ],
      );

      ctx.subscriptionBuilder()
        .onApplied(() => {
          if (generation !== connectionGeneration) return;

          isPeopleSynchronized = true;
          const user = AuthManager.getCurrentUser();
          const isJoined = [...ctx.db.member.iter()]
            .some(member => member.identity.toHexString() === currentIdentity);
          if (isJoined && user && user.name) {
            try {
              ctx.reducers.setDisplayName({ displayName: user.name });
            } catch (error) {
              console.warn('Syncing displayName to SpacetimeDB:', error);
            }
          }
          maybeShowFirstRunOnboarding(isJoined);
          if (isJoined && isDatabaseSynchronized) ensureConversation();
          renderAll();
          refreshOpenIdentityFlowFromDatabase();
        })
        .onError(errorContext => {
          if (generation !== connectionGeneration) return;

          console.warn('SpacetimeDB people subscription error:', errorContext.event);
          isPeopleSynchronized = false;
          isDatabaseSynchronized = false;
          isConnected = false;
          connectionAttemptInFlight = false;
          errorContext.disconnect();
          scheduleDatabaseReconnect(generation);
        })
        .subscribe(peopleSubscription.tables[0]);

      ctx.subscriptionBuilder()
        .onApplied(() => {
          if (generation !== connectionGeneration) return;

          reconnectAttempt = 0;
          isDatabaseSynchronized = true;
          if (isPeopleSynchronized) ensureConversation();
          syncAiStatus();
          renderAll();
          refreshOpenIdentityFlowFromDatabase();
          void flushActiveOutbox();
        })
        .onError(errorContext => {
          if (generation !== connectionGeneration) return;

          console.warn('SpacetimeDB subscription error:', errorContext.event);
          isPeopleSynchronized = false;
          isDatabaseSynchronized = false;
          isConnected = false;
          connectionAttemptInFlight = false;
          errorContext.disconnect();
          scheduleDatabaseReconnect(generation);
        })
        .subscribe(householdSubscription.tables);
    })
    .onConnectError((_ctx, error) => {
      if (generation !== connectionGeneration) return;

      connectionAttemptInFlight = false;
      isConnected = false;
      isPeopleSynchronized = false;
      console.warn('SpacetimeDB connection error:', error);
      scheduleDatabaseReconnect(generation);
    })
    .onDisconnect((_ctx, error) => {
      if (generation !== connectionGeneration) return;

      connectionAttemptInFlight = false;
      isConnected = false;
      isDatabaseSynchronized = false;
      isPeopleSynchronized = false;
      if (error) console.warn('SpacetimeDB disconnected:', error);
      scheduleDatabaseReconnect(generation);
    })
    .build();

  connection = nextConnection;
  attachDatabaseListeners(nextConnection);
  renderAll();
}

function reconnectDatabaseImmediately() {
  if (connectionAttemptInFlight) return;
  if (isConnected && !connection.isSocketClosed) return;

  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = undefined;
  }
  reconnectAttempt = 0;
  isConnected = false;
  connectToDatabase();
}

window.addEventListener('online', reconnectDatabaseImmediately);
window.addEventListener('focus', reconnectDatabaseImmediately);
window.addEventListener('pageshow', reconnectDatabaseImmediately);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') reconnectDatabaseImmediately();
});

function hydrateIdentityState(route: IdentityRoute): IdentityFeatureState {
  const user = AuthManager.getCurrentUser();
  const active = activeHomeSelection();
  const residences = isDatabaseSynchronized ? householdGateway.residences() : [];
  const homes = isDatabaseSynchronized ? householdGateway.homes() : [];
  const profile = scopedHouseholdConfig()?.getProfile(currentIdentity || 'local', user.name || currentName()) ?? {
    identityHex: currentIdentity || 'local',
    displayName: user.name || currentName(),
    dietaryTags: [],
    cookingHabits: [],
    customSplitExclusions: [],
  };
  return {
    ...identityState,
    route,
    request: 'idle',
    message: undefined,
    profile: {
      displayName: user.name || profile.displayName,
      phone: user.phone || '',
      email: user.email || '',
      dietaryTags: [...profile.dietaryTags],
      cookingHabits: [...profile.cookingHabits],
    },
    homes: homes.map(home => ({
      id: home.id,
      name: home.name,
      label: home.flatNumber,
      residenceName: residences.find(residence => residence.id === home.residenceId)?.name || '',
      active: String(home.id) === active.flatId,
    })),
    homesSynchronized: isDatabaseSynchronized,
    accounts: AuthManager.getSavedAccounts().filter(account => Boolean(account.identity?.trim() && account.name.trim())).map(account => ({
      identity: account.identity || '',
      displayName: account.name,
      detail: account.phone || account.email || `Account ${account.identity?.slice(0, 8)}`,
      active: account.identity === currentIdentity,
    })),
    basics: identityState.basics,
    firstTaskItems: route === 'first-task' && identityState.firstTaskItems.length === 0
      ? FIRST_TASK_STARTERS.map(item => ({ ...item }))
      : identityState.firstTaskItems,
    ai: lastAiConnectionError
      ? { kind: 'error', model: lastAiConnectionError.model, message: lastAiConnectionError.message }
      : AIProvider.hasApiKey()
      ? { kind: 'connected', model: AIProvider.getModelName() }
      : { kind: 'disconnected', model: AIProvider.getModelName() },
  };
}

function seedFirstTaskChoices(state: IdentityFeatureState): IdentityFeatureState {
  return state.firstTaskItems.length
    ? state
    : { ...state, firstTaskItems: FIRST_TASK_STARTERS.map(item => ({ ...item })) };
}

async function reconnectSavedAccount(identity: string) {
  const tokenLabel = AuthManager.switchAccount(identity);
  const selectedToken = tokenLabel ? localStorage.getItem(tokenLabel) : null;
  if (!selectedToken) throw new Error('The saved account connection is not available on this device.');
  databaseToken = selectedToken;
  isConnected = false;
  connectToDatabase();
  const started = Date.now();
  while ((!isConnected || currentIdentity !== identity) && Date.now() - started < 12_000) {
    await new Promise(resolve => window.setTimeout(resolve, 50));
  }
  if (!isConnected || currentIdentity !== identity) throw new Error('The saved account did not reconnect.');
}

function clearDeletedIdentityArtifacts(identity: string, tokenLabel?: string) {
  const normalized = identity.trim().toLowerCase();
  const encoded = encodeURIComponent(normalized);
  if (!encoded) return;
  const registryKey = conversationRegistryKey(identity);
  let conversationIds: string[] = [];
  try {
    const parsed = JSON.parse(localStorage.getItem(registryKey) || '[]');
    if (Array.isArray(parsed)) conversationIds = parsed.filter(value => typeof value === 'string');
  } catch {}
  const activeId = localStorage.getItem(`tabby_active_conversation:${identity}`);
  if (activeId) conversationIds.push(activeId);

  const scopedPrefixes = [
    `tabby_local_pantry:${encoded}:`,
    `tabby_local_rules:${encoded}:`,
    `tabby_household_v2:${encoded}:`,
    `tabby_outbox_v1:${encoded}:`,
  ];
  for (const key of Object.keys(localStorage)) {
    if (scopedPrefixes.some(prefix => key.startsWith(prefix))) {
      if (key.startsWith(`tabby_outbox_v1:${encoded}:`)) {
        try {
          const commands = JSON.parse(localStorage.getItem(key) || '[]');
          if (Array.isArray(commands)) commands.forEach(command => command?.id && localStorage.removeItem(`tabby_outbox_routed:${command.id}`));
        } catch {}
      }
      localStorage.removeItem(key);
    }
  }
  for (const id of new Set(conversationIds)) localStorage.removeItem(`tabby_convo:${id}`);
  if (conversationIds.includes(localStorage.getItem('tabby_active_conversation_default') || '')) {
    localStorage.removeItem('tabby_active_conversation_default');
  }
  localStorage.removeItem(registryKey);
  localStorage.removeItem(`tabby_active_conversation:${identity}`);
  localStorage.removeItem(`tabby_brain_private_v1:${identity}`);
  if (identity !== normalized) localStorage.removeItem(`tabby_brain_private_v1:${normalized}`);
  localStorage.removeItem(`tabby_conversation_delivery_v1:${encoded}`);
  if (tokenLabel) localStorage.removeItem(tokenLabel);
  for (const scope of [...outboxes.keys()]) if (scope.toLowerCase().startsWith(`${normalized}:`)) outboxes.delete(scope);
}

function readIdentityDraft(): void {
  const form = document.querySelector<HTMLFormElement>('#identity-flow-form');
  if (!form) return;
  const data = new FormData(form);
  const text = (name: string) => String(data.get(name) || '').trim();
  if (identityState.route === 'profile') {
    identityState = { ...identityState, profile: {
      displayName: text('displayName'),
      phone: text('phone'),
      email: text('email'),
      dietaryTags: text('dietaryTags').split(',').map(value => value.trim()).filter(Boolean),
      cookingHabits: text('cookingHabits').split(',').map(value => value.trim()).filter(Boolean),
    } };
  } else if (identityState.route === 'create-home') {
    identityState = { ...identityState, createHome: {
      ...identityState.createHome,
      homeName: text('homeName'),
      homeLabel: text('homeLabel'),
      displayName: identityState.createHome.displayName || identityState.profile.displayName,
    } };
  } else if (identityState.route === 'bring-house-together') {
    identityState = { ...identityState, basics: {
      quietHoursStart: text('quietHoursStart'), quietHoursEnd: text('quietHoursEnd'),
      defaultBillingSplit: text('defaultBillingSplit') || 'equal',
      invitesEnabled: identityState.basics.invitesEnabled,
    } };
  } else if (identityState.route === 'delete-account') {
    identityState = { ...identityState, deletionInput: text('deletionInput') };
  } else if (identityState.route === 'first-task') {
    const selected = new Set([...form.querySelectorAll<HTMLInputElement>('[data-first-item]:checked')].map(input => input.dataset.firstItem));
    identityState = { ...identityState, firstTaskItems: identityState.firstTaskItems.map(item => ({ ...item, selected: selected.has(item.id) })) };
  }
}

function identityPorts(): IdentityPorts {
  return createSpacetimeIdentityPorts(() => connection, {
    async forgetCurrentAccount() {
      const deleted = AuthManager.getCurrentUser();
      const deletedIdentity = deleted.identity || currentIdentity;
      clearDeletedIdentityArtifacts(deletedIdentity, deleted.tokenLabel);
      if (deletedIdentity) AIProvider.clearIdentityScope(deletedIdentity);
      const forgotten = AuthManager.forgetCurrentAccount();
      if (forgotten?.tokenLabel) localStorage.removeItem(forgotten.tokenLabel);
      localStorage.removeItem(tokenKey);
      databaseToken = undefined;
      currentIdentity = '';
      isConnected = false;
      isConnecting = false;
      connectionGeneration += 1;
      connection.disconnect();
      activeConversationId = crypto.randomUUID();
      conversation = [welcomeMessage];
      conversationFeatureState = createConversationState();
    },
    async saveProfile(profile) {
      const current = AuthManager.getCurrentUser();
      AuthManager.saveUser({ ...current, name: profile.displayName, phone: profile.phone, email: profile.email, isLoggedIn: true });
      scopedHouseholdConfig()?.saveProfile({
        identityHex: currentIdentity,
        displayName: profile.displayName,
        dietaryTags: profile.dietaryTags as DietaryTag[],
        cookingHabits: profile.cookingHabits,
        customSplitExclusions: [],
      });
      if (currentIdentityHasMembership()) await connection.reducers.setDisplayName({ displayName: profile.displayName });
    },
    async saveFirstTaskItems(items) {
      for (const item of items) {
        await householdGateway.executeHouseholdAction({ reducer: 'addPantryItem', payload: { name: item.label, quantity: 1, unit: 'item' } });
      }
    },
    async switchAccount(identity) {
      await reconnectSavedAccount(identity);
    },
    async signOut() {
      AuthManager.logout();
      localStorage.removeItem(tokenKey);
      databaseToken = undefined;
      currentIdentity = '';
      isConnected = false;
      isConnecting = false;
      connectionGeneration += 1;
      connection.disconnect();
    },
    async beginRecovery(identity) {
      const saved = AuthManager.getSavedAccounts();
      const requested = identity ? saved.find(account => account.identity === identity && account.tokenLabel && localStorage.getItem(account.tokenLabel)) : undefined;
      const available = requested || saved.find(account => account.identity && account.tokenLabel && localStorage.getItem(account.tokenLabel));
      if (!available?.identity) throw new Error('No saved account connection is available on this device.');
      await reconnectSavedAccount(available.identity);
    },
    async connectAi(input) {
      const connected = await AIProvider.testConnection(input.apiKey, input.model);
      if (!connected) {
        lastAiConnectionError = { model: input.model, message: 'The AI provider could not confirm this connection. Nothing was saved.' };
        throw new Error(lastAiConnectionError.message);
      }
      try {
        await connection.reducers.setAiConfig({ apiKey: input.apiKey, model: input.model });
        AIProvider.setConfigured(true, input.model, input.apiKey);
        lastAiConnectionError = null;
      } catch (cause) {
        lastAiConnectionError = { model: input.model, message: cause instanceof Error ? cause.message : String(cause) };
        throw cause;
      }
      return { model: input.model };
    },
    async disconnectAi() {
      await connection.reducers.setAiConfig({ apiKey: '', model: '' });
      AIProvider.setConfigured(false, AIProvider.getModelName(), '');
      lastAiConnectionError = null;
    },
  });
}

function openIdentityFlow(route: IdentityRoute, entryRoute?: IdentityRoute) {
  identityCompletionVisible = false;
  if (route !== 'bring-house-together') editingExistingHomeBasics = false;
  identityEntryRoute = entryRoute;
  identityState = hydrateIdentityState(route);
  const flow = document.querySelector<HTMLElement>('#identity-flow')!;
  const wasHidden = flow.hidden;
  if (wasHidden && document.activeElement instanceof HTMLElement) identityReturnFocus = document.activeElement;
  for (const sibling of [...app.children]) {
    if (!(sibling instanceof HTMLElement) || sibling === flow) continue;
    sibling.inert = true;
    sibling.setAttribute('aria-hidden', 'true');
  }
  flow.hidden = false;
  document.body.classList.add('identity-flow-open');
  renderIdentityFlowUi();
  window.requestAnimationFrame(() => flow.querySelector<HTMLElement>('input, button')?.focus());
}

function refreshOpenIdentityFlowFromDatabase() {
  const flow = document.querySelector<HTMLElement>('#identity-flow');
  if (!flow || flow.hidden || !['home-access', 'join-home', 'accounts'].includes(identityState.route)) return;
  identityState = hydrateIdentityState(identityState.route);
  renderIdentityFlowUi();
}

function closeIdentityFlow() {
  const flow = document.querySelector<HTMLElement>('#identity-flow')!;
  flow.hidden = true;
  for (const sibling of [...app.children]) {
    if (!(sibling instanceof HTMLElement) || sibling === flow) continue;
    sibling.inert = false;
    sibling.removeAttribute('aria-hidden');
  }
  document.body.classList.remove('identity-flow-open');
  identityCompletionVisible = false;
  editingExistingHomeBasics = false;
  identityEntryRoute = undefined;
  identityReturnFocus?.focus();
  identityReturnFocus = null;
}

function renderIdentityFlowUi() {
  const mount = document.querySelector<HTMLElement>('#identity-flow-mount');
  if (!mount) return;
  mount.innerHTML = renderIdentityFlow(identityState, identityCompletionVisible, editingExistingHomeBasics);
  mount.querySelectorAll<HTMLButtonElement>('button[data-identity-route]').forEach(button => {
    button.addEventListener('click', () => openIdentityFlow(button.dataset.identityRoute as IdentityRoute, identityState.route));
  });
  mount.querySelectorAll<HTMLInputElement>('.identity-fields input').forEach(input => {
    input.addEventListener('input', () => {
      identityState = updateIdentityTextField(identityState, input.name, input.value);
      if (identityState.route === 'profile') {
        const action = mount.querySelector<HTMLButtonElement>('[data-identity-action="save-profile"]');
        if (action) {
          action.disabled = !identityState.profile.displayName.trim() || !identityState.profile.phone.trim();
          action.setAttribute('aria-disabled', String(action.disabled));
        }
      } else if (identityState.route === 'create-home') {
        const action = mount.querySelector<HTMLButtonElement>('[data-identity-action="confirm-create-home"]');
        if (action) {
          action.disabled = !homePreview(identityState.createHome);
          action.setAttribute('aria-disabled', String(action.disabled));
        }
        const previewName = mount.querySelector<HTMLElement>('[data-home-preview-name]');
        const previewAddress = mount.querySelector<HTMLElement>('[data-home-preview-address]');
        if (previewName) previewName.textContent = identityState.createHome.homeName || 'Your home';
        if (previewAddress) previewAddress.textContent = identityState.createHome.homeLabel || 'Address can be added later';
      }
    });
  });
  mount.querySelectorAll<HTMLInputElement>('[name="deletionInput"]').forEach(input => {
    input.addEventListener('input', () => { readIdentityDraft(); renderIdentityFlowUi(); });
  });
  mount.querySelectorAll<HTMLInputElement>('[data-first-item]').forEach(input => {
    input.addEventListener('change', () => {
      readIdentityDraft();
      const selected = selectedFirstTaskItems(identityState.firstTaskItems);
      const action = mount.querySelector<HTMLButtonElement>('[data-identity-action="save-first-items"]');
      if (!action) return;
      action.disabled = selected.length === 0;
      action.setAttribute('aria-disabled', String(action.disabled));
      action.textContent = `Save ${selected.length} item${selected.length === 1 ? '' : 's'}`;
    });
  });
  mount.querySelectorAll<HTMLButtonElement>('[data-identity-home]').forEach(button => {
    button.addEventListener('click', async () => {
      identityState = await switchHome(identityState, BigInt(button.dataset.identityHome || '0'), identityPorts());
      if (identityState.request === 'success' && identityEntryRoute !== 'settings') {
        renderAll();
        closeIdentityFlow();
        navigateTo('conversations');
        return;
      }
      renderIdentityFlowUi();
      if (identityState.request === 'success') renderAll();
    });
  });
  mount.querySelectorAll<HTMLButtonElement>('[data-identity-account]').forEach(button => {
    button.addEventListener('click', async () => {
      identityState = await switchAccount(identityState, button.dataset.identityAccount || '', identityPorts());
      renderIdentityFlowUi();
    });
  });
  mount.querySelectorAll<HTMLButtonElement>('[data-identity-action]').forEach(button => {
    button.addEventListener('click', () => void handleIdentityAction(button.dataset.identityAction || ''));
  });
}

async function handleIdentityAction(action: string) {
  readIdentityDraft();
  const ports = identityPorts();
  if (action === 'back') {
    const route = editingExistingHomeBasics && identityState.route === 'bring-house-together'
      ? 'settings'
      : identityBackRoute(identityState.route, identityEntryRoute);
    editingExistingHomeBasics = false;
    identityState = { ...identityState, route, request: 'idle', message: undefined };
  }
  else if (action === 'create-home') {
    requestedHomePath = 'create';
    identityState = { ...identityState, route: identityState.route === 'welcome' ? 'profile' : 'create-home', request: 'idle' };
  } else if (action === 'join-home') {
    requestedHomePath = 'join';
    identityState = { ...identityState, route: identityState.route === 'welcome' ? 'profile' : 'join-home', request: 'idle' };
  } else if (action === 'save-profile') {
    identityState = await saveProfile(identityState, ports);
    if (identityState.request === 'success') {
      const nextRoute = requestedHomePath === 'create' ? 'create-home' : requestedHomePath === 'join' ? 'join-home' : 'home-access';
      identityState = {
        ...hydrateIdentityState(nextRoute),
        createHome: { ...identityState.createHome, displayName: identityState.profile.displayName },
        request: 'idle',
        message: undefined,
      };
    }
  } else if (action === 'confirm-create-home') identityState = await createHome(identityState, ports);
  else if (action === 'edit-home-basics') {
    editingExistingHomeBasics = true;
    identityState = hydrateIdentityState('bring-house-together');
  } else if (action === 'save-basics') {
    identityState = await saveHomeBasics(identityState, ports);
    if (identityState.request === 'success' && editingExistingHomeBasics) {
      editingExistingHomeBasics = false;
      identityState = { ...identityState, route: 'settings', message: 'Household basics updated.' };
    } else if (identityState.request === 'success') {
      identityState = seedFirstTaskChoices(identityState);
    }
  }
  else if (action === 'add-first-item') {
    const input = document.querySelector<HTMLInputElement>('#identity-flow-form [name="firstTaskLabel"]');
    const label = input?.value.trim() || '';
    if (label) identityState = { ...identityState, firstTaskItems: [...identityState.firstTaskItems, { id: crypto.randomUUID(), label, selected: true }] };
  } else if (action === 'save-first-items') {
    identityState = await saveFirstTask(identityState, ports);
    if (identityState.request === 'success') {
      identityCompletionVisible = true;
    }
  } else if (action === 'sign-out') identityState = await signOut(identityState, ports);
  else if (action === 'recover-account') {
    identityState = await beginRecovery(identityState, currentIdentity || undefined, ports);
    if (identityState.request === 'success') identityState = { ...identityState, message: 'Saved account reconnected on this device.' };
  }
  else if (action === 'confirm-delete') identityState = await deleteAccount(identityState, ports);
  else if (action === 'connect-ai') {
    const apiKey = document.querySelector<HTMLInputElement>('#identity-flow-form [name="aiKey"]')?.value.trim() || '';
    const model = document.querySelector<HTMLInputElement>('#identity-flow-form [name="aiModel"]')?.value.trim() || '';
    identityState = await connectAi(identityState, { apiKey, model }, ports);
  } else if (action === 'disconnect-ai') identityState = await disconnectIdentityAi(identityState, ports);
  else if (action === 'open-conversation') { identityCompletionVisible = false; closeIdentityFlow(); navigateTo('conversations'); return; }
  renderIdentityFlowUi();
}

document.querySelector('#identity-flow-close')?.addEventListener('click', closeIdentityFlow);
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !document.querySelector<HTMLElement>('#identity-flow')?.hidden) closeIdentityFlow();
});

AIProvider.configureBackend(request => connection.procedures.runAi({
  prompt: request.prompt,
  instructions: request.instructions,
  imageDataUrl: request.imageDataUrl,
  jsonMode: request.jsonMode,
}));

async function sendUserMessage(text: string) {
  const commandKey = `message:${crypto.randomUUID()}`;
  const message = addMessage({
    role: 'user',
    agent: 'general',
    text,
    delivery: isConnected ? 'sending' : 'unsent',
    commandKey,
  }, false);
  if (!activeHomeSelection().flatId) {
    updateMessage(message.id, { delivery: 'sent' });
    await routeMessage(text);
    return;
  }
  activeOutbox().enqueue<MessageOutboxPayload>('appendConversationMessage', {
    conversationId: activeConversationId,
    messageId: message.id,
    role: message.role,
    agent: message.agent,
    content: encodeStoredConversationMessage(message),
    text,
  }, commandKey);
  if (isConnected && navigator.onLine !== false) await flushActiveOutbox();
  else updateMessage(message.id, { delivery: 'unsent' });
}

async function retryMessage(commandKey: string) {
  const message = conversation.find(candidate => candidate.commandKey === commandKey);
  if (!message) return;
  if (!isConnected) {
    showToast('Tabby is still offline. Your message remains on this device.', 'error');
    return;
  }
  updateMessage(message.id, { delivery: 'sending' });
  const outbox = activeOutbox();
  const command = outbox.list().find(candidate => candidate.idempotencyKey === commandKey);
  if (!command) {
    updateMessage(message.id, { delivery: 'rejected' });
    showToast('The queued message could not be found.', 'error');
    return;
  }
  if (command.status === 'failed') outbox.retry(command.id);
  await flushActiveOutbox();
}

document.querySelector<HTMLFormElement>('#chat-form')!.addEventListener('submit', event => {
  event.preventDefault();
  const input = document.querySelector<HTMLTextAreaElement>('#chat-input')!;
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  input.style.height = '';
  void sendUserMessage(text);
});

document.querySelector<HTMLTextAreaElement>('#chat-input')!.addEventListener('input', event => {
  const input = event.currentTarget as HTMLTextAreaElement;
  input.style.height = 'auto';
  input.style.height = `${Math.min(input.scrollHeight, 160)}px`;
});

document.querySelector<HTMLTextAreaElement>('#chat-input')!.addEventListener('keydown', event => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    document.querySelector<HTMLFormElement>('#chat-form')!.dispatchEvent(new Event('submit'));
  }
});

document.querySelector<HTMLInputElement>('#receipt-input')!.addEventListener('change', event => {
  const input = event.currentTarget as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
    showToast('Choose a PNG, JPG, or WebP receipt image.', 'error');
    input.value = '';
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    attachedReceipt = String(reader.result);
    attachedReceiptName = file.name;
    document.querySelector('#attachment-name')!.textContent = file.name;
  };
  reader.readAsDataURL(file);
});

function openDialog(id: string) {
  document.querySelector<HTMLDialogElement>(`#${id}`)?.showModal();
}

function closeSettingsBoard() {
  const settings = document.querySelector<HTMLDialogElement>('#ai-dialog');
  if (settings?.open) settings.close();
}

function showProfileDialog() {
  openIdentityFlow('profile', 'settings');
}
document.querySelector('#open-profile')!.addEventListener('click', () => {
  closeSettingsBoard();
  showProfileDialog();
});
document.querySelector('#mobile-profile')!.addEventListener('click', showProfileDialog);

document.querySelector<HTMLFormElement>('#profile-form')!.addEventListener('submit', async event => {
  event.preventDefault();
  const identity = currentIdentity || 'local';
  const displayName = document.querySelector<HTMLInputElement>('#profile-name')!.value.trim();
  if (!displayName) {
    document.querySelector<HTMLInputElement>('#profile-name')!.focus();
    return showToast('Name is required.', 'error');
  }
  const dietaryTags = [...document.querySelectorAll<HTMLInputElement>('input[name="diet"]:checked')].map(input => input.value as DietaryTag);
  const cookingHabits = document.querySelector<HTMLInputElement>('#profile-habits')!.value.split(',').map(value => value.trim()).filter(Boolean);
  scopedHouseholdConfig()?.saveProfile({ identityHex: identity, displayName, dietaryTags, cookingHabits, customSplitExclusions: [] });
  try {
    if (currentIdentityHasMembership()) {
      await connection.reducers.setDisplayName({ displayName });
      await publishSharedFacts([
        ...dietaryTags.map(diet => TabbyBrain.createSharedFact('diet', 'diet', diet.replace(/_/g, ' '))),
        ...cookingHabits.map(habit => TabbyBrain.createSharedFact('routine', 'cooking habit', habit)),
      ]);
    }
  } catch (cause) {
    showToast(cause instanceof Error ? cause.message : 'The shared profile update failed.', 'error');
    return;
  }
  document.querySelector<HTMLDialogElement>('#profile-dialog')!.close();
  renderContextPanel();
  showToast('Your profile was updated.');
});

async function undoAiChange() {
  const snapshot = AIProvider.getLastUndoSnapshot();
  if (!snapshot || !snapshot.apiKey) {
    showToast('No previous AI configuration to restore.', 'error');
    return;
  }

  const { apiKey, model } = snapshot;
  const connected = await AIProvider.testConnection(apiKey, model);
  if (!connected) {
    showToast('The previous AI connection is unavailable, so it was not restored.', 'error');
    return;
  }

  if (isConnected) {
    try {
      await connection.reducers.setAiConfig({ apiKey, model });
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'The AI connection could not be restored.', 'error');
      return;
    }
  }

  AIProvider.setConfigured(true, model, apiKey);
  syncAiStatus();
  showToast(`Restored OpenAI connection (${model}).`);
}

async function disconnectAi() {
  const currentKey = AIProvider.getApiKey();
  const currentModel = AIProvider.getModelName();
  if (currentKey) {
    AIProvider.saveUndoSnapshot(currentKey, currentModel);
  }

  if (isConnected) {
    try {
      await connection.reducers.setAiConfig({ apiKey: '', model: '' });
    } catch (e) {
      console.warn('Failed clearing SpacetimeDB AI config:', e);
    }
  }

  AIProvider.setConfigured(false, currentModel, '');
  lastAiConnectionError = null;
  syncAiStatus();
  document.querySelector<HTMLDialogElement>('#ai-dialog')?.close();

  showToast('OpenAI key disconnected.', 'success', {
    label: 'Undo',
    onClick: undoAiChange,
  });
}

function showAiDialog() {
  openIdentityFlow('settings');
}
document.querySelector('#open-ai-settings')!.addEventListener('click', showAiDialog);
document.querySelector('#mobile-ai-settings')!.addEventListener('click', showAiDialog);
document.querySelector('#disconnect-ai')?.addEventListener('click', disconnectAi);

document.querySelector<HTMLFormElement>('#ai-form')!.addEventListener('submit', async event => {
  event.preventDefault();
  const keyInput = document.querySelector<HTMLInputElement>('#ai-key')!;
  const modelInput = document.querySelector<HTMLInputElement>('#ai-model')!;
  const inputKey = keyInput.value.trim();
  const model = modelInput.value.trim() || AIProvider.getModelName() || (import.meta.env.VITE_OPENAI_MODEL as string | undefined)?.trim() || 'gpt-5.6-sol';

  const prevKey = AIProvider.getApiKey();
  const prevModel = AIProvider.getModelName();
  const apiKey = inputKey || prevKey;

  if (!apiKey) {
    return showToast('Enter an OpenAI API key (sk-...).', 'error');
  }

  if (!apiKey.startsWith('sk-') || apiKey.length < 20) {
    return showToast('Enter a valid OpenAI API key (must start with sk-).', 'error');
  }

  const submit = document.querySelector<HTMLButtonElement>('#ai-form button[type="submit"]');
  if (submit) submit.disabled = true;
  const status = document.querySelector<HTMLElement>('#ai-status-indicator');
  if (status) {
    status.className = 'ai-status-badge checking';
    status.textContent = 'Checking connection';
  }
  document.querySelector('#open-ai-settings')!.textContent = 'Settings';
  document.querySelector('#mobile-ai-settings')!.textContent = 'Settings · Checking AI';
  try {
    const connected = await AIProvider.testConnection(apiKey, model);
    if (!connected) throw new Error('The AI connection failed. Nothing was saved.');
    if (isConnected) await connection.reducers.setAiConfig({ apiKey, model });
    if (prevKey && (prevKey !== apiKey || prevModel !== model)) AIProvider.saveUndoSnapshot(prevKey, prevModel);
    AIProvider.setConfigured(true, model, apiKey);
    lastAiConnectionError = null;
    keyInput.value = '';
    document.querySelector<HTMLDialogElement>('#ai-dialog')?.close();
    syncAiStatus();
    showToast('OpenAI connected successfully.', 'success', prevKey && prevKey !== apiKey ? {
      label: 'Undo', onClick: undoAiChange,
    } : undefined);
  } catch (cause) {
    lastAiConnectionError = { model, message: cause instanceof Error ? cause.message : 'The AI connection failed. Nothing was saved.' };
    if (status) {
      status.className = 'ai-status-badge error';
      status.textContent = 'Connection failed · key not saved';
    }
    document.querySelector('#mobile-ai-settings')!.textContent = 'Settings · AI disconnected';
    showToast(cause instanceof Error ? cause.message : 'The AI connection failed. Nothing was saved.', 'error');
  } finally {
    if (submit) submit.disabled = false;
  }
});

function createNewConversation() {
  const id = crypto.randomUUID();
  activeConversationId = id;
  const identity = currentIdentity || 'local';
  localStorage.setItem(`tabby_active_conversation:${identity}`, id);
  localStorage.setItem('tabby_active_conversation_default', id);
  if (currentIdentityHasMembership()) {
    try {
      connection.reducers.createConversation({ conversationId: id, title: 'New conversation' });
    } catch (err) {
      console.warn('createConversation notice:', err);
    }
  }
  conversation = [welcomeMessage];
  saveLocalConversation(id, conversation);
  renderConversation();
  setContextOpen(false);
  renderConversationPicker();
}

document.querySelector('#new-conversation')!.addEventListener('click', createNewConversation);
document.querySelector('#mobile-new-conversation')!.addEventListener('click', createNewConversation);
document.querySelector<HTMLSelectElement>('#conversation-picker')!.addEventListener('change', event => {
  selectConversation((event.currentTarget as HTMLSelectElement).value);
});

document.querySelectorAll<HTMLButtonElement>('[data-close-dialog]').forEach(button => {
  button.addEventListener('click', () => document.querySelector<HTMLDialogElement>(`#${button.dataset.closeDialog}`)?.close());
});

const contextPanel = document.querySelector<HTMLElement>('#context-panel')!;
const contextToggle = document.querySelector<HTMLButtonElement>('#context-toggle')!;
const contextIsDrawer = () => window.matchMedia('(max-width: 1120px)').matches;
const drawerController = installDrawerController({
  panel: contextPanel,
  toggle: contextToggle,
  close: document.querySelector<HTMLButtonElement>('#context-close')!,
  scrim: document.querySelector<HTMLElement>('#drawer-scrim')!,
  isDrawer: contextIsDrawer,
});

function setContextOpen(open: boolean) {
  drawerController.setOpen(open);
}

document.querySelector<HTMLFormElement>('#quick-rule-form')?.addEventListener('submit', async event => {
  event.preventDefault();
  const typeSelect = document.querySelector<HTMLSelectElement>('#quick-rule-type')!;
  const titleInput = document.querySelector<HTMLInputElement>('#quick-rule-title')!;
  const ruleType = (typeSelect.value === 'implicit' ? 'implicit' : 'explicit') as 'implicit' | 'explicit';
  const title = titleInput.value.trim();
  if (!title) return;
  const result = await addOrUpdateFlatRule(ruleType, title);
  if (result.status === 'acknowledged') {
    titleInput.value = '';
    showToast(`Added an ${ruleType === 'explicit' ? 'agreed' : 'usual'} house rule.`);
  } else if (result.status === 'rejected') {
    showToast(result.error.message, 'error');
  }
});

document.querySelector('#reset-tabby-db')?.addEventListener('click', () => {
  closeSettingsBoard();
  openIdentityFlow('delete-account');
});

document.querySelector<HTMLFormElement>('#quick-pantry-form')?.addEventListener('submit', async event => {
  event.preventDefault();
  const nameInput = document.querySelector<HTMLInputElement>('#quick-pantry-name')!;
  const qtyInput = document.querySelector<HTMLInputElement>('#quick-pantry-qty')!;
  const name = nameInput.value.trim();
  const quantity = Math.max(1, parseInt(qtyInput.value, 10) || 1);
  if (!name) return;
  const result = await addOrUpdatePantryItem(name, quantity, 'items');
  if (result.status === 'acknowledged') {
    nameInput.value = '';
    qtyInput.value = '1';
    showToast(`Added ${quantity} ${name} to the pantry.`);
  } else if (result.status === 'rejected') {
    showToast(result.error.message, 'error');
  }
});

document.querySelector<HTMLFormElement>('#quick-reminder-form')?.addEventListener('submit', async event => {
  event.preventDefault();
  const titleInput = document.querySelector<HTMLInputElement>('#quick-reminder-title')!;
  const dueInput = document.querySelector<HTMLInputElement>('#quick-reminder-due')!;
  const title = titleInput.value.trim();
  const due = new Date(dueInput.value);
  if (!title || Number.isNaN(due.getTime())) return showToast('Add a reminder and choose when it is due.', 'error');
  const result = await commandCoordinator.execute(`reminder:create:${crypto.randomUUID()}`, () =>
    householdGateway.executeHouseholdAction(createReminderAction(title, BigInt(due.getTime()) * 1_000n)));
  if (result.status === 'acknowledged') {
    titleInput.value = '';
    dueInput.value = '';
    showToast('Reminder saved to the Home shelf.');
  } else showToast(result.status === 'rejected' ? result.error.message : 'Reconnect to add this reminder.', 'error');
});

// Login Modal Logic
function showLoginDialog() {
  const user = AuthManager.getCurrentUser();
  openIdentityFlow(user.isLoggedIn && user.name.trim() ? 'accounts' : 'welcome');
}

document.querySelector('#open-login-dialog')?.addEventListener('click', () => {
  closeSettingsBoard();
  showLoginDialog();
});
document.querySelector('#header-user-badge')?.addEventListener('click', showLoginDialog);
document.querySelector('#mobile-login')?.addEventListener('click', () => {
  setContextOpen(false);
  showLoginDialog();
});
document.querySelector('.create-home-action')?.addEventListener('click', () => {
  document.querySelector<HTMLDialogElement>('#login-dialog')?.close();
  showOnboardingDialog('create');
});
document.querySelector('.join-home-action')?.addEventListener('click', () => {
  document.querySelector<HTMLDialogElement>('#login-dialog')?.close();
  showOnboardingDialog('join');
});

document.querySelector<HTMLFormElement>('#login-form')?.addEventListener('submit', event => {
  event.preventDefault();
  const nameInput = document.querySelector<HTMLInputElement>('#login-name')!;
  const phoneInput = document.querySelector<HTMLInputElement>('#login-phone')!;

  const name = nameInput.value.trim();
  const phone = phoneInput.value.trim();

  const signIn = AuthManager.signIn(phone, name);
  if (!signIn.success) {
    return showToast(signIn.message, 'error');
  }

  const hasMembership = currentIdentityHasMembership();
  if (hasMembership) {
    try {
      connection.reducers.setDisplayName({ displayName: name });
    } catch (e) {
      console.warn('SpacetimeDB setDisplayName notice:', e);
    }
  }

  document.querySelector<HTMLDialogElement>('#login-dialog')?.close();
  renderAll();
  showToast(signIn.message, 'success');
  if (!hasMembership) showOnboardingDialog();
});

// Flat Onboarding Modal Logic
function updateOnboardFlatsDropdown() {
  const resSelect = document.querySelector<HTMLSelectElement>('#onboard-residence')!;
  const flatSelect = document.querySelector<HTMLSelectElement>('#onboard-flat')!;
  const newResGroup = document.querySelector<HTMLElement>('#new-residence-group')!;
  const newFlatGroup = document.querySelector<HTMLElement>('#new-flat-group')!;

  if (!resSelect || !flatSelect) return;
  const selectedResId = resSelect.value;
  if (selectedResId === '__new__') {
    if (newResGroup) newResGroup.hidden = false;
    flatSelect.innerHTML = `<option value="__new__">Create a new flat or address</option>`;
    if (newFlatGroup) newFlatGroup.hidden = false;
    return;
  }

  if (newResGroup) newResGroup.hidden = true;
  const flats = householdGateway.homes()
    .filter(home => String(home.residenceId) === selectedResId)
    .map(home => ({ id: String(home.id), name: home.name, flatNumber: home.flatNumber }));
  const activeFlat = activeHomeSelection();

  flatSelect.innerHTML = flats.map(f => `
    <option value="${escapeHtml(f.id)}" ${f.id === activeFlat.flatId ? 'selected' : ''}>${escapeHtml(f.flatNumber)}: ${escapeHtml(f.name)}</option>
  `).join('') + `<option value="__new__">Create a new flat or address</option>`;

  if (newFlatGroup) {
    newFlatGroup.hidden = flatSelect.value !== '__new__';
  }
}

function populateOnboardingDropdowns() {
  const residences = householdGateway.residences().map(row => ({ id: String(row.id), name: row.name, address: row.address }));
  const activeFlat = activeHomeSelection();
  const resSelect = document.querySelector<HTMLSelectElement>('#onboard-residence')!;
  const memberNameInput = document.querySelector<HTMLInputElement>('#onboard-display-name')!;

  if (memberNameInput) {
    const user = AuthManager.getCurrentUser();
    memberNameInput.value = user.isLoggedIn ? user.name : '';
  }

  if (resSelect) {
    resSelect.innerHTML = residences.map(r => `
      <option value="${escapeHtml(r.id)}" ${r.id === activeFlat.residenceId ? 'selected' : ''}>${escapeHtml(r.name)} (${escapeHtml(r.address)})</option>
    `).join('') + `<option value="__new__">Create a new home</option>`;
  }

  updateOnboardFlatsDropdown();
}

function showOnboardingDialog(mode: 'create' | 'join' = 'join') {
  requestedHomePath = mode;
  openIdentityFlow(mode === 'create' ? 'create-home' : 'home-access');
}

document.querySelector('#open-onboard-dialog')?.addEventListener('click', () => {
  closeSettingsBoard();
  showOnboardingDialog();
});
document.querySelector('#header-flat-badge')?.addEventListener('click', () => showOnboardingDialog());
document.querySelector('#mobile-onboard')?.addEventListener('click', () => {
  setContextOpen(false);
  showOnboardingDialog();
});
document.querySelector('#onboard-residence')?.addEventListener('change', updateOnboardFlatsDropdown);
document.querySelector('#onboard-flat')?.addEventListener('change', () => {
  const flatSelect = document.querySelector<HTMLSelectElement>('#onboard-flat')!;
  const newFlatGroup = document.querySelector<HTMLElement>('#new-flat-group')!;
  if (newFlatGroup && flatSelect) {
    newFlatGroup.hidden = flatSelect.value !== '__new__';
  }
});

document.querySelector<HTMLFormElement>('#onboard-form')?.addEventListener('submit', async event => {
  event.preventDefault();
  const resSelect = document.querySelector<HTMLSelectElement>('#onboard-residence')!;
  const flatSelect = document.querySelector<HTMLSelectElement>('#onboard-flat')!;
  const nameInput = document.querySelector<HTMLInputElement>('#onboard-display-name')!;

  const displayName = nameInput.value.trim();
  if (!displayName) {
    nameInput.focus();
    return showToast('Please enter your name.', 'error');
  }
  let resId = resSelect.value;
  let flatId = flatSelect.value;
  let newResidence: { name: string; address: string } | undefined;

  if (resId === '__new__') {
    const resNameInput = document.querySelector<HTMLInputElement>('#new-res-name')!;
    const resAddressInput = document.querySelector<HTMLInputElement>('#new-res-address')!;
    const resName = resNameInput.value.trim();
    const resAddress = resAddressInput.value.trim();
    if (!resName || !resAddress) {
      (resName ? resAddressInput : resNameInput).focus();
      return showToast('Enter a home name and area or building.', 'error');
    }
    newResidence = { name: resName, address: resAddress };
  }

  if (flatId === '__new__') {
    const flatNumInput = document.querySelector<HTMLInputElement>('#new-flat-num')!;
    const flatNameInput = document.querySelector<HTMLInputElement>('#new-flat-name')!;
    const flatNum = flatNumInput.value.trim();
    const flatName = flatNameInput.value.trim();
    if (!flatNum || !flatName) {
      (flatNum ? flatNameInput : flatNumInput).focus();
      return showToast('Enter the flat or address label and a home nickname.', 'error');
    }
    const result = await commandCoordinator.execute(`home:create:${Date.now()}`, async () => {
        if (newResidence) {
          await connection.reducers.createHomeAndJoin({
            residenceName: newResidence.name,
            address: newResidence.address,
            flatName,
            flatNumber: flatNum,
            displayName,
          });
        } else {
          if (!resId.match(/^\d+$/)) throw new Error('Choose a synchronized residence.');
          await connection.reducers.createAndJoinFlat({
            residenceId: BigInt(resId),
            flatName,
            flatNumber: flatNum,
            displayName,
          });
        }
    });
    if (result.status !== 'acknowledged') {
      return showToast(result.status === 'rejected' ? result.error.message : 'Waiting for a connection.', 'error');
    }
  } else {
    const result = await commandCoordinator.execute(`home:join:${flatId}`, async () => {
        if (!flatId.match(/^\d+$/)) throw new Error('Choose a synchronized home.');
        await connection.reducers.joinFlat({
          flatId: BigInt(flatId),
          displayName,
        });
    });
    if (result.status !== 'acknowledged') {
      return showToast(result.status === 'rejected' ? result.error.message : 'Waiting for a connection.', 'error');
    }
  }

  // Update AuthManager and local active flat
  const currentUser = AuthManager.getCurrentUser();
  AuthManager.saveUser({
    ...currentUser,
    name: displayName,
    isLoggedIn: true,
    residenceId: resId === '__new__' ? currentUser.residenceId : resId,
    flatId: flatId === '__new__' ? currentUser.flatId : flatId,
  });

  document.querySelector<HTMLDialogElement>('#onboard-dialog')?.close();
  renderAll();
  showToast('Home setup was acknowledged. Start with your first real task.', 'success');
  document.querySelector<HTMLTextAreaElement>('#chat-input')?.focus();
});

function navigateTo(route: AppRoute) {
  appStore.update({ route });
  reflectRoute(route);
  if (route === 'home' && contextIsDrawer()) setContextOpen(true);
  if (route !== 'home' && drawerController.isOpen()) setContextOpen(false);
  if (route === 'pantry') renderPantryRoute();
  if (route === 'expenses') renderExpensesRoute();
}

installRouteNavigation(navigateTo);
document.querySelector('#open-home-shelf')?.addEventListener('click', () => setContextOpen(true));
document.querySelector<HTMLInputElement>('#pantry-search')?.addEventListener('input', event => {
  pantryFilters = { ...pantryFilters, query: (event.currentTarget as HTMLInputElement).value };
  renderPantryRoute();
});
document.querySelector('#retry-connection')?.addEventListener('click', reconnectDatabaseImmediately);
reflectRoute(appStore.getState().route);

renderConversation();
setContextOpen(false);
showFreshSessionOnboarding();
connectToDatabase();
syncAiStatus();
