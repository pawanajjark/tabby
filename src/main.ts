import './style.css';
import { DbConnection, tables } from './module_bindings';
import { AgentShopping } from './services/agentShopping';
import { AgentCooking, type Recipe } from './services/agentCooking';
import { AgentBilling, type SplitResult } from './services/agentBilling';
import { AIProvider } from './services/aiProvider';
import { AuthManager, type AuthUser } from './services/authManager';
import { ResidenceManager, type ResidenceItem, type FlatItem, type ActiveFlatSelection } from './services/residenceManager';
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
}

const app = document.querySelector<HTMLDivElement>('#app')!;

app.innerHTML = `
  <main class="app-frame household-workspace">
    <header class="command-rail top-bar" aria-label="Tabby household workspace">
      <div class="brand-block top-bar-brand">
        <div class="wordmark">tabby</div>
        <p>Home, handled.</p>
      </div>

      <div class="rail-card home-switcher" id="rail-flat-card">
        <button type="button" class="header-pill-badge home-switcher-button rail-card-header" id="header-flat-badge" title="Choose a home">
          <span class="rail-label">HOME</span>
          <span class="home-switcher-copy rail-card-title">
            <span class="rail-card-name" id="rail-flat-name">Sunshine Haven</span>
            <span class="rail-card-sub" id="rail-residence-name">Flat 402, Palm Grove Residency</span>
          </span>
          <span class="sr-only" id="header-flat-text">Sunshine Haven · Flat 402</span>
        </button>
      </div>

      <div class="pantry-status" aria-label="Pantry connection status">
        <span class="rail-label">PANTRY</span>
        <p class="connection-status"><span class="status-dot offline"></span><span id="status-text">Pantry is connecting</span></p>
      </div>

      <nav class="routing-guide top-bar-navigation" aria-label="Primary navigation">
        <span class="top-bar-link active" aria-current="page">Conversations</span>
        <button type="button" class="context-toggle top-bar-link" id="context-toggle" aria-expanded="false" aria-controls="context-panel"><span class="context-long">Home shelf</span><span class="context-short">Shelf</span></button>
      </nav>

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

    <section class="conversation-shell">
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

      <div class="conversation conversation-transcript" id="conversation" aria-live="polite"></div>

      <div class="composer-zone">
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

    <aside class="context-panel home-shelf" id="context-panel" aria-label="Home shelf">
      <div class="context-header">
        <div>
          <h2>Home shelf</h2>
          <p>Shared household details, separate from private conversations.</p>
        </div>
        <button class="context-close" id="context-close" aria-label="Close Home shelf">Close</button>
      </div>
      <div class="mobile-context-actions">
        <button id="mobile-new-conversation">New conversation</button>
        <button id="mobile-onboard">Switch home</button>
        <button id="mobile-login">Account</button>
        <button id="mobile-profile">Your profile</button>
        <button id="mobile-ai-settings">Settings</button>
      </div>
      <section class="context-section">
        <div class="section-heading"><h3>People</h3><span id="people-count">0</span></div>
        <div id="people-list" class="context-list"></div>
      </section>
      <section class="context-section">
        <div class="section-heading"><h3>HOME NOTES</h3><span id="memory-count">0</span></div>
        <div id="memory-list" class="context-list"></div>
      </section>
      <section class="context-section">
        <div class="section-heading"><h3>PANTRY</h3><span id="pantry-count">0</span></div>
        <form id="quick-pantry-form" class="quick-pantry-form">
          <input id="quick-pantry-name" placeholder="Add an item, such as milk" autocomplete="off" required />
          <input id="quick-pantry-qty" type="number" min="1" value="1" />
          <button type="submit" class="quick-add-btn">Add</button>
        </form>
        <div id="pantry-list" class="context-list"></div>
      </section>
      <section class="context-section">
        <div class="section-heading"><h3>KITCHEN</h3><span id="rules-count">0</span></div>
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
    </aside>
  </main>

  <dialog id="login-dialog" class="onboarding-dialog welcome-screen">
    <form id="login-form" class="settings-form onboarding-screen">
      <div class="dialog-heading">
        <div><p class="conversation-picker-label">WELCOME TO TABBY</p><h2>Run your home from one conversation.</h2><p>Groceries, meals, bills, notes, and house decisions stay in one place.</p></div>
        <button type="button" class="dialog-close" data-close-dialog="login-dialog">Close</button>
      </div>
      <div class="welcome-home-actions" aria-label="Set up a home">
        <button type="button" class="primary-button welcome-home-action create-home-action">Create a home</button>
        <button type="button" class="secondary-button welcome-home-action join-home-action">Join a home</button>
      </div>
      <p class="returning-user-copy">Returning to Tabby? Sign in below.</p>
      <div class="onboarding-section-heading"><span>PRIVATE SETUP</span><strong>Your profile</strong></div>
      <button type="button" id="fill-sam-demo" class="quick-demo-btn">Use Sam demo details</button>
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
        <section class="settings-card danger-zone">
          <p class="conversation-picker-label">DATA AND PRIVACY · DANGER ZONE</p>
          <h3>Delete your Tabby data</h3>
          <p>This permanently deletes pantry items, expenses, memories, conversations, and local household settings.</p>
          <button type="button" id="reset-tabby-db" class="secondary-button danger-button">Delete your Tabby data</button>
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
let currentSplit: SplitResult | null = null;
let syncingConversation = false;

const welcomeMessage: ConversationMessage = {
  id: 'welcome',
  role: 'assistant',
  agent: 'tabby',
  text: 'Run your home from one conversation. Tell me what needs handling, from a pantry check or dinner to a bill or Home note.',
};

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

function saveLocalConversation(id: string, messages: ConversationMessage[]) {
  if (!id) return;
  try {
    localStorage.setItem(`tabby_convo:${id}`, JSON.stringify(messages));
    localStorage.setItem('tabby_active_conversation_default', id);
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
    [...connection.db.member.iter()].some(member => member.identity.toHexString() === currentIdentity),
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

function encodeStoredMessage(message: Omit<ConversationMessage, 'id'>) {
  return JSON.stringify({ text: message.text, contentHtml: message.contentHtml });
}

function decodeStoredMessage(content: string): Pick<ConversationMessage, 'text' | 'contentHtml'> {
  try {
    const parsed = JSON.parse(content) as { text?: string; contentHtml?: string };
    if (parsed.text || parsed.contentHtml) return parsed;
  } catch {
    // Rows created before structured message storage are plain text.
  }
  return { text: content };
}

function persistConversationMessage(message: Omit<ConversationMessage, 'id'>) {
  if (!isConnected || !activeConversationId || syncingConversation || !currentIdentityHasMembership()) return;
  try {
    connection.reducers.appendConversationMessage({
      conversationId: activeConversationId,
      role: message.role,
      agent: message.agent,
      content: encodeStoredMessage(message),
    });
  } catch (err) {
    console.warn('Failed persisting message to SpacetimeDB:', err);
  }
}

function addMessage(message: Omit<ConversationMessage, 'id'>, persist = true) {
  const newMsg = { ...message, id: crypto.randomUUID() };
  conversation.push(newMsg);
  saveLocalConversation(activeConversationId, conversation);
  renderConversation();
  if (persist) persistConversationMessage(message);
}

function syncConversationFromDatabase() {
  if (!activeConversationId) return;
  const rows = [...connection.db.myConversationMessages.iter()]
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
      ...decodeStoredMessage(row.content),
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
  conversation = getLocalConversation(id);
  renderConversation();
  syncConversationFromDatabase();
}

function renderConversationPicker() {
  const picker = document.querySelector<HTMLSelectElement>('#conversation-picker')!;
  const rows = [...connection.db.myConversations.iter()]
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

  const rows = [...connection.db.myConversations.iter()];
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

function renderConversation() {
  const target = document.querySelector<HTMLElement>('#conversation')!;
  target.innerHTML = conversation.map(message => {
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
      <article class="message ${message.role} ${message.pending ? 'pending' : ''}">
        ${agentLabel}
        <div class="message-content">
          ${message.contentHtml ?? `<p>${escapeHtml(message.text ?? '')}</p>`}
        </div>
      </article>
    `;
  }).join('');
  bindMessageActions();
  requestAnimationFrame(() => target.scrollTo({ top: target.scrollHeight, behavior: 'smooth' }));
}

function getSharedContext(): SharedContextRecord[] {
  return [...connection.db.sharedMemory.iter()]
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
  const activeFlat = ResidenceManager.getActiveFlat();
  const members = selectFlatRoommates(
    [...connection.db.member.iter()].map(member => ({
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
    const profile = HouseholdConfigManager.getProfile(identity, displayName);
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
    const member = [...connection.db.member.iter()]
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

function getLocalPantry(): LocalPantryItem[] {
  try {
    const raw = localStorage.getItem('tabby_local_pantry');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

function saveLocalPantry(items: LocalPantryItem[]) {
  try {
    localStorage.setItem('tabby_local_pantry', JSON.stringify(items));
  } catch {}
}

function pantryData() {
  const dbRows = [...connection.db.pantryItem.iter()].map(item => ({
    id: item.id.toString(),
    name: item.name,
    quantity: item.quantity,
    unit: item.unit,
  }));

  if (dbRows.length > 0) {
    saveLocalPantry(dbRows);
    return dbRows;
  }

  return getLocalPantry();
}

function addOrUpdatePantryItem(name: string, quantity: number, unit: string) {
  const cleanName = name.trim().toLowerCase();
  if (!cleanName || quantity === 0) return;

  const cleanUnit = unit.trim() || 'items';
  const local = getLocalPantry();
  const existingIndex = local.findIndex(i => i.name.toLowerCase() === cleanName);

  if (existingIndex >= 0) {
    local[existingIndex].quantity = Math.max(0, local[existingIndex].quantity + quantity);
    local[existingIndex].unit = cleanUnit;
  } else if (quantity > 0) {
    local.push({ id: crypto.randomUUID(), name: cleanName, quantity, unit: cleanUnit });
  }
  const filtered = local.filter(i => i.quantity > 0);
  saveLocalPantry(filtered);

  if (isConnected) {
    try {
      connection.reducers.addPantryItem({ name: cleanName, quantity, unit: cleanUnit });
    } catch (err) {
      console.warn('SpacetimeDB addPantryItem notice:', err);
    }
  }

  renderContextPanel();
}

export interface LocalFlatRule {
  id: string;
  ruleType: 'implicit' | 'explicit';
  title: string;
  description: string;
}

function getLocalRules(): LocalFlatRule[] {
  try {
    const raw = localStorage.getItem('tabby_flat_rules');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [
    { id: '1', ruleType: 'explicit', title: 'Quiet hours after 11 PM', description: 'Keep common area volume low.' },
    { id: '2', ruleType: 'implicit', title: 'Restock milk when empty', description: 'Whoever finishes milk adds it to grocery list.' },
  ];
}

function saveLocalRules(rules: LocalFlatRule[]) {
  try {
    localStorage.setItem('tabby_flat_rules', JSON.stringify(rules));
  } catch {}
}

function flatRulesData(): LocalFlatRule[] {
  if (connection?.db?.flatRule) {
    try {
      const activeFlat = ResidenceManager.getActiveFlat();
      const activeFlatId = BigInt(activeFlat.flatId.match(/^\d+$/) ? activeFlat.flatId : '1');
      const dbRows = [...connection.db.flatRule.iter()]
        .filter(r => r.flatId === activeFlatId || !r.flatId || r.flatId === 0n)
        .map(r => ({
          id: r.id.toString(),
          ruleType: (r.ruleType === 'implicit' ? 'implicit' : 'explicit') as 'implicit' | 'explicit',
          title: r.title,
          description: r.description || '',
        }));
      if (dbRows.length > 0) {
        saveLocalRules(dbRows);
        return dbRows;
      }
    } catch (e) {
      console.warn('flatRulesData read notice:', e);
    }
  }
  return getLocalRules();
}

function addOrUpdateFlatRule(ruleType: 'implicit' | 'explicit', title: string, description = '') {
  const rules = getLocalRules();
  rules.push({ id: crypto.randomUUID(), ruleType, title, description });
  saveLocalRules(rules);
  if (isConnected) {
    try {
      connection.reducers.upsertFlatRule({
        id: 0n,
        ruleType,
        title,
        description,
      });
    } catch (e) {
      console.warn('upsertFlatRule notice:', e);
    }
  }
  renderContextPanel();
}

function deleteFlatRule(id: string) {
  const rules = getLocalRules().filter(r => r.id !== id);
  saveLocalRules(rules);
  if (isConnected) {
    try {
      connection.reducers.deleteFlatRule({ id: BigInt(id.match(/^\d+$/) ? id : '0') });
    } catch (e) {
      console.warn('deleteFlatRule notice:', e);
    }
  }
  renderContextPanel();
}

function clearAllTabbyData() {
  if (!confirm('Delete your Tabby data? This removes pantry items, expenses, memories, conversations, and local household settings.')) {
    return;
  }

  if (isConnected) {
    try {
      (connection.reducers as any).clearAllData?.({});
    } catch (err) {
      console.warn('clearAllData notice:', err);
    }
  }

  localStorage.removeItem('tabby_local_pantry');
  localStorage.removeItem('tabby_flat_rules');
  localStorage.removeItem('tabby_brain_private_v1');
  const allKeys = Object.keys(localStorage);
  for (const k of allKeys) {
    if (k.startsWith('tabby_convo:') || k.startsWith('tabby_active_conversation:')) {
      localStorage.removeItem(k);
    }
  }

  const newId = crypto.randomUUID();
  activeConversationId = newId;
  localStorage.setItem('tabby_active_conversation_default', newId);
  conversation = [welcomeMessage];
  saveLocalConversation(newId, conversation);

  document.querySelector<HTMLDialogElement>('#ai-dialog')?.close();
  renderConversation();
  renderAll();
  showToast('Your Tabby data was deleted.');
}

function renderContextPanel() {
  const roommates = getRoommates();
  const peoplePresentation = peopleListPresentation(isPeopleSynchronized, roommates.length);
  const memory = getSharedContext();
  const pantry = pantryData().filter(item => item.quantity > 0).sort((a, b) => a.name.localeCompare(b.name));
  const rules = flatRulesData();

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

  document.querySelector('#memory-list')!.innerHTML = memory.length
    ? memory.slice(0, 8).map(fact => `
      <div class="memory-row">
        <span class="memory-category">${escapeHtml(formatCategory(fact.category))}</span>
        <p><strong>${escapeHtml(fact.subjectName)}</strong> · ${escapeHtml(fact.value)}</p>
      </div>`).join('')
    : '<p class="empty-state">Nothing saved yet. Ask Tabby to remember a shared Home note.</p>';

  document.querySelector('#pantry-list')!.innerHTML = pantry.length
    ? pantry.map(item => `
      <div class="pantry-row">
        <span>${escapeHtml(item.name)}</span>
        <div class="pantry-actions">
          <strong>${item.quantity} ${escapeHtml(item.unit)}</strong>
          <button type="button" class="pantry-item-del" data-remove-pantry="${escapeHtml(item.name)}" title="Remove item">×</button>
        </div>
      </div>`).join('')
    : '<p class="empty-state">The kitchen is empty. Add an item here or ask Pantry to save what you bought.</p>';

  document.querySelector('#rules-list')!.innerHTML = rules.length
    ? rules.map(rule => `
      <div class="rule-row">
        <div class="rule-row-header">
          <span class="rule-badge ${rule.ruleType}">${rule.ruleType}</span>
          <button type="button" class="pantry-item-del" data-remove-rule="${escapeHtml(rule.id)}" title="Delete rule">×</button>
        </div>
        <div class="rule-title">${escapeHtml(rule.title)}</div>
        ${rule.description ? `<small style="color: var(--muted);">${escapeHtml(rule.description)}</small>` : ''}
      </div>`).join('')
    : '<p class="empty-state">No house agreements yet. Add an agreed or usual house rule above.</p>';

  document.querySelectorAll<HTMLButtonElement>('[data-remove-pantry]').forEach(btn => {
    btn.onclick = () => {
      const name = btn.dataset.removePantry || '';
      if (!name) return;
      const current = pantry.find(p => p.name.toLowerCase() === name.toLowerCase());
      if (current) {
        addOrUpdatePantryItem(name, -current.quantity, current.unit);
        showToast(`Removed ${name} from pantry.`);
      }
    };
  });

  document.querySelectorAll<HTMLButtonElement>('[data-remove-rule]').forEach(btn => {
    btn.onclick = () => {
      const id = btn.dataset.removeRule || '';
      if (id) {
        deleteFlatRule(id);
        showToast('Rule removed.');
      }
    };
  });
}

function publishSharedFacts(facts: MemoryFact[]) {
  if (!isConnected || !currentIdentity) return;
  const existing = getSharedContext();
  for (const fact of facts) {
    const duplicate = existing.some(record =>
      record.subjectIdentity === currentIdentity &&
      record.category === fact.category &&
      record.key === fact.key &&
      record.value.toLowerCase() === fact.value.toLowerCase()
    );
    if (!duplicate) {
      connection.reducers.upsertSharedMemory({
        category: fact.category,
        memoryKey: fact.key,
        value: fact.value,
        sourceMessageId: 0n,
      });
    }
  }
}

function renderShoppingPlan(plan: Awaited<ReturnType<typeof AgentShopping.generateShoppingPlan>>) {
  const items = plan.items.slice(0, 8);
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
    </div>`;
}

function renderCookingPlan(plan: Awaited<ReturnType<typeof AgentCooking.generateRecipes>>) {
  currentRecipes = new Map(plan.recipes.map(recipe => [recipe.id, recipe]));
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
              <button data-cook-recipe="${escapeHtml(recipe.id)}">Cook this</button>
            </article>`;
        }).join('')}
      </div>
    </div>`;
}

function renderSplit(split: SplitResult) {
  currentSplit = split;
  return `
    <div class="agent-result">
      <div class="result-heading"><h3>${escapeHtml(split.billTitle)}</h3><strong>${money(split.totalAmountPaise)}</strong></div>
      <div class="split-layout">
        <div>
          <h4>Receipt</h4>
          ${split.lineItems.map(item => `<div class="split-row"><span>${escapeHtml(item.name)}</span><strong>${money(item.pricePaise)}</strong></div>`).join('')}
        </div>
        <div>
          <h4>Fair split</h4>
          ${split.roommateShares.map(share => `
            <div class="share-row">
              <span><strong>${escapeHtml(share.displayName)}</strong><small>${share.itemCount} shared items${share.isExemptFromItems.length ? ` · ${share.isExemptFromItems.length} exemptions` : ''}</small></span>
              <strong>${money(share.amountPaise)}</strong>
            </div>`).join('')}
        </div>
      </div>
      <button class="result-primary" data-record-expense>Record household expense</button>
    </div>`;
}

async function routeMessage(text: string) {
  const personalAnswer = TabbyBrain.answerPersonalQuestion(text, currentName());
  if (personalAnswer) {
    setRoute('general', false);
    addMessage({ role: 'assistant', agent: 'general', text: personalAnswer });
    return;
  }

  setRoute('general', true);
  const analysis = await TabbyBrain.analyze(text, conversation, getSharedContext());
  TabbyBrain.savePrivateFacts(currentIdentity || 'local', analysis.privateFacts);
  publishSharedFacts(analysis.shareableFacts);
  setRoute(analysis.intent, true);

  try {
    if (analysis.intent === 'grocery') {
      const purchase = text.match(/\b(?:bought|added|got|purchased|have|store|stock)\s+(\d+(?:\.\d+)?)\s*([a-zA-Z]+)?\s+(?:of\s+)?(.+)/i);
      const pantryAddition = text.match(/\b(?:add|put|store|stock)\s+(.+?)\s+(?:to|in)\s+(?:the\s+)?pantry\b/i);
      if (purchase || pantryAddition) {
        const quantity = purchase ? Math.max(1, Math.round(Number(purchase[1]))) : 1;
        const unit = purchase?.[2] || 'items';
        const name = (purchase?.[3] || pantryAddition?.[1] || '').replace(/[.!?]+$/, '').trim();
        addOrUpdatePantryItem(name, quantity, unit);
        addMessage({ role: 'assistant', agent: 'grocery', text: `Added ${quantity} ${unit} of ${name} to the shared pantry.` });
      } else {
        const plan = await AgentShopping.generateShoppingPlan(pantryData(), getRoommates(), text);
        addMessage({ role: 'assistant', agent: 'grocery', contentHtml: renderShoppingPlan(plan) });
      }
    } else if (analysis.intent === 'billing') {
      if (!attachedReceipt && !/\d/.test(text)) {
        addMessage({ role: 'assistant', agent: 'billing', text: 'Paste one item per line, such as “Rice - 450”, or attach a receipt image. I will apply the household dietary rules to the split.' });
      } else {
        const split = await AgentBilling.parseAndSplitBill(
          { text, imageBase64: attachedReceipt, title: attachedReceiptName || 'Household expense' },
          getRoommates(),
        );
        addMessage({ role: 'assistant', agent: 'billing', contentHtml: renderSplit(split) });
      }
    } else if (analysis.intent === 'context' || analysis.shareableFacts.length > 0) {
      const answer = TabbyBrain.answerContextQuestion(text, getSharedContext());
      const responseText = analysis.shareableFacts.length > 0
        ? `Noted! I captured these insights in your household context: ${analysis.shareableFacts.map(f => `"${f.value}"`).join(', ')}.`
        : (answer || 'I added that preference to the shared household context. Other housemates can ask me about it when planning food or expenses.');
      addMessage({
        role: 'assistant',
        agent: 'context',
        text: responseText,
      });
    } else if (analysis.intent === 'chef') {
      const plan = await AgentCooking.generateRecipes(pantryData(), getRoommates(), text);
      addMessage({ role: 'assistant', agent: 'chef', contentHtml: renderCookingPlan(plan) });
    } else {
      if (!AIProvider.hasApiKey()) {
        addMessage({
          role: 'assistant',
          agent: 'general',
          text: 'OpenAI is not connected yet. Open Settings, add an API key, and I will answer general household questions through the backend.',
        });
        return;
      }
      const recentConversation = conversation.slice(-10)
        .map(message => `${message.role}: ${message.text || 'Structured household result'}`)
        .join('\n');
      const householdContext = getSharedContext().slice(0, 12)
        .map(memory => `${memory.subjectName}: ${memory.value}`)
        .join('; ');
      const verifiedName = currentName();
      const generated = await AIProvider.generateText(
        `Recent conversation:\n${recentConversation}\n\nCurrent request:\n${text}`,
        `You are Tabby, a concise household coordination assistant. Answer practical home questions. If an image is provided, analyze and describe its relevant contents. Do not claim an action happened unless it was performed. The current member's verified display name is ${verifiedName || 'not set because onboarding is incomplete'}. Never present a database identity or hexadecimal identifier as a person's name. Shared household context: ${householdContext || 'No shared memories yet.'}`,
        attachedReceipt,
      );
      addMessage({
        role: 'assistant',
        agent: 'general',
        text: generated || 'OpenAI could not complete that request. Check the saved model and API key in Settings, then try again.',
      });
    }
  } catch (error) {
    addMessage({
      role: 'assistant',
      agent: analysis.intent,
      text: error instanceof Error ? error.message : 'That request could not be completed. Try adding a little more detail.',
    });
  } finally {
    setRoute(analysis.intent, false);
    attachedReceipt = undefined;
    attachedReceiptName = '';
    (document.querySelector<HTMLInputElement>('#receipt-input')!).value = '';
    document.querySelector('#attachment-name')!.textContent = '';
    renderContextPanel();
  }
}

function bindMessageActions() {
  document.querySelectorAll<HTMLButtonElement>('[data-add-pantry]').forEach(button => {
    button.onclick = () => {
      const name = button.dataset.addPantry || '';
      const qty = Math.max(1, Math.round(Number(button.dataset.quantity)));
      const unit = button.dataset.unit || 'items';
      addOrUpdatePantryItem(name, qty, unit);
      button.textContent = 'Added';
      button.disabled = true;
      showToast(`Added ${qty} ${unit} of ${name} to the pantry.`);
    };
  });

  document.querySelectorAll<HTMLButtonElement>('[data-cook-recipe]').forEach(button => {
    button.onclick = () => {
      const recipe = currentRecipes.get(button.dataset.cookRecipe!);
      if (!recipe) return;
      const pantry = pantryData();
      let updated = 0;
      for (const ingredient of recipe.ingredients.filter(item => item.inPantry)) {
        const match = pantry.find(item => {
          const pantryName = item.name.toLowerCase();
          const ingredientName = ingredient.name.toLowerCase();
          return pantryName.includes(ingredientName) || ingredientName.includes(pantryName);
        });
        if (match && match.quantity > 0) {
          addOrUpdatePantryItem(match.name, -1, match.unit);
          updated += 1;
        }
      }
      showToast(updated ? `Started ${recipe.title}. Pantry quantities were adjusted.` : `Started ${recipe.title}. No tracked pantry quantities needed changing.`);
      button.textContent = 'Cooking';
      button.disabled = true;
    };
  });

  document.querySelectorAll<HTMLButtonElement>('[data-record-expense]').forEach(button => {
    button.onclick = () => {
      if (!currentSplit || !isConnected) return showToast('Connect to the shared home before recording an expense.', 'error');
      connection.reducers.recordExpense({ title: currentSplit.billTitle, amountPaise: currentSplit.totalAmountPaise });
      button.textContent = 'Recorded';
      button.disabled = true;
      showToast('The household expense was recorded.');
    };
  });
}

function renderHeaderAndRailBadges() {
  const currentUser = AuthManager.getCurrentUser();
  const activeFlat = ResidenceManager.getActiveFlat();
  const signedInName = currentUser.isLoggedIn ? currentUser.name.trim() : '';

  // Header badges
  const headerFlatText = document.querySelector<HTMLElement>('#header-flat-text');
  const headerUserText = document.querySelector<HTMLElement>('#header-user-text');
  if (headerFlatText) {
    headerFlatText.textContent = `${activeFlat.flatName} · ${activeFlat.flatNumber}`;
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
  if (railFlatName) railFlatName.textContent = activeFlat.flatName;
  if (railResidenceName) railResidenceName.textContent = `${activeFlat.flatNumber}, ${activeFlat.residenceName}`;
}

function renderAll() {
  renderContextPanel();
  renderHeaderAndRailBadges();
  const status = document.querySelector('#status-text')!;
  status.textContent = isDatabaseSynchronized
    ? 'Pantry checked just now'
    : isConnected
      ? 'Pantry is checking the home'
      : isConnecting
        ? 'Pantry is reconnecting'
        : 'Offline — local chat still works';
  document.querySelector('.status-dot')?.classList.toggle('offline', !isConnected);
}

function syncAiStatus() {
  const status = [...connection.db.myAiStatus.iter()][0];
  const directKey = AIProvider.getApiKey();
  const isBackendConfigured = Boolean(status?.configured);
  const isBackendVerified = Boolean(status?.verified);
  const modelName = status?.model || AIProvider.getModelName() || (import.meta.env.VITE_OPENAI_MODEL as string | undefined)?.trim() || 'gpt-5.6-sol';

  if (isConnected && directKey && !isBackendConfigured) {
    try {
      connection.reducers.setAiConfig({ apiKey: directKey, model: modelName });
    } catch (err) {
      console.warn('Auto-syncing AI config to backend notice:', err);
    }
  }

  AIProvider.setConfigured(isBackendConfigured, modelName);

  const hasAnyKey = AIProvider.hasApiKey();
  const isVerified = isBackendVerified || hasAnyKey;
  const isConfigured = isBackendConfigured || hasAnyKey;

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
    ResidenceManager.syncFromDb([...conn.db.residence.iter()], [...conn.db.flat.iter()]);
    renderAll();
  });

  conn.db.residence.onInsert(syncResidences);
  conn.db.residence.onUpdate(syncResidences);
  conn.db.flat.onInsert(syncResidences);
  conn.db.flat.onUpdate(syncResidences);
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
      currentIdentity = identity.toHexString();
      TabbyBrain.savePrivateFacts(currentIdentity, TabbyBrain.getPrivateFacts('local'));
      connectionAttemptInFlight = false;
      isConnecting = false;
      isConnected = true;
      isDatabaseSynchronized = false;
      isPeopleSynchronized = false;
      renderAll();

      const [peopleSubscription, householdSubscription] = createSubscriptionGroups(
        tables.member,
        [
          tables.residence,
          tables.flat,
          tables.flatRule,
          tables.pantryItem,
          tables.expense,
          tables.expenseSplit,
          tables.sharedMemory,
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
          try {
            ResidenceManager.syncFromDb(
              [...ctx.db.residence.iter()],
              [...ctx.db.flat.iter()],
            );
          } catch (error) {
            console.warn('Syncing residences from SpacetimeDB:', error);
          }

          if (isPeopleSynchronized) ensureConversation();
          syncAiStatus();
          renderAll();
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

AIProvider.configureBackend(request => connection.procedures.runAi({
  prompt: request.prompt,
  instructions: request.instructions,
  imageDataUrl: request.imageDataUrl,
  jsonMode: request.jsonMode,
}));

document.querySelector<HTMLFormElement>('#chat-form')!.addEventListener('submit', event => {
  event.preventDefault();
  const input = document.querySelector<HTMLTextAreaElement>('#chat-input')!;
  const text = input.value.trim();
  if (!text) return;
  addMessage({ role: 'user', agent: 'general', text });
  input.value = '';
  input.style.height = '';
  void routeMessage(text);
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
  const profile = HouseholdConfigManager.getProfile(currentIdentity || 'local', currentName());
  (document.querySelector<HTMLInputElement>('#profile-name')!).value = profile.displayName;
  (document.querySelector<HTMLInputElement>('#profile-habits')!).value = profile.cookingHabits.join(', ');
  document.querySelectorAll<HTMLInputElement>('input[name="diet"]').forEach(input => {
    input.checked = profile.dietaryTags.includes(input.value as DietaryTag);
  });
  openDialog('profile-dialog');
}
document.querySelector('#open-profile')!.addEventListener('click', () => {
  closeSettingsBoard();
  showProfileDialog();
});
document.querySelector('#mobile-profile')!.addEventListener('click', showProfileDialog);

document.querySelector<HTMLFormElement>('#profile-form')!.addEventListener('submit', event => {
  event.preventDefault();
  const identity = currentIdentity || 'local';
  const displayName = document.querySelector<HTMLInputElement>('#profile-name')!.value.trim();
  const dietaryTags = [...document.querySelectorAll<HTMLInputElement>('input[name="diet"]:checked')].map(input => input.value as DietaryTag);
  const cookingHabits = document.querySelector<HTMLInputElement>('#profile-habits')!.value.split(',').map(value => value.trim()).filter(Boolean);
  HouseholdConfigManager.saveProfile({ identityHex: identity, displayName, dietaryTags, cookingHabits, customSplitExclusions: [] });
  if (currentIdentityHasMembership()) {
    connection.reducers.setDisplayName({ displayName });
    publishSharedFacts(dietaryTags.map(diet => TabbyBrain.createSharedFact('diet', 'diet', diet.replace(/_/g, ' '))));
    cookingHabits.forEach(habit => publishSharedFacts([TabbyBrain.createSharedFact('routine', 'cooking habit', habit)]));
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
  AIProvider.setConfigured(true, model, apiKey);

  if (isConnected) {
    try {
      connection.reducers.setAiConfig({ apiKey, model });
    } catch (e) {
      console.warn('Failed restoring key to SpacetimeDB:', e);
    }
  }

  syncAiStatus();
  showToast(`Restored OpenAI connection (${model}).`);

  const ok = await AIProvider.testConnection(apiKey, model);
  if (ok) {
    showToast('OpenAI connection verified.');
  }
}

async function disconnectAi() {
  const currentKey = AIProvider.getApiKey();
  const currentModel = AIProvider.getModelName();
  if (currentKey) {
    AIProvider.saveUndoSnapshot(currentKey, currentModel);
  }

  if (isConnected) {
    try {
      connection.reducers.setAiConfig({ apiKey: '', model: '' });
    } catch (e) {
      console.warn('Failed clearing SpacetimeDB AI config:', e);
    }
  }

  AIProvider.setConfigured(false, currentModel, '');
  syncAiStatus();
  document.querySelector<HTMLDialogElement>('#ai-dialog')?.close();

  showToast('OpenAI key disconnected.', 'success', {
    label: 'Undo',
    onClick: undoAiChange,
  });
}

function showAiDialog() {
  const keyInput = document.querySelector<HTMLInputElement>('#ai-key')!;
  const modelInput = document.querySelector<HTMLInputElement>('#ai-model')!;
  const statusBadge = document.querySelector<HTMLElement>('#ai-status-indicator');
  const disconnectBtn = document.querySelector<HTMLButtonElement>('#disconnect-ai');

  const hasKey = AIProvider.hasApiKey();
  keyInput.value = '';
  keyInput.placeholder = hasKey ? '•••••••• (Enter a new key to replace)' : 'Enter a key to connect OpenAI (sk-...)';
  modelInput.value = AIProvider.getModelName() || (import.meta.env.VITE_OPENAI_MODEL as string | undefined)?.trim() || 'gpt-5.6-sol';

  if (statusBadge) {
    statusBadge.textContent = hasKey
      ? `Connected (${AIProvider.getModelName()})`
      : 'Not connected';
    statusBadge.className = `ai-status-badge ${hasKey ? 'connected' : 'disconnected'}`;
  }

  if (disconnectBtn) {
    disconnectBtn.hidden = !hasKey;
  }

  openDialog('ai-dialog');
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

  if (prevKey && (prevKey !== apiKey || prevModel !== model)) {
    AIProvider.saveUndoSnapshot(prevKey, prevModel);
  }

  AIProvider.setConfigured(true, model, apiKey);
  keyInput.value = '';
  document.querySelector<HTMLDialogElement>('#ai-dialog')?.close();

  if (isConnected) {
    try {
      connection.reducers.setAiConfig({ apiKey, model });
    } catch (e) {
      console.warn('SpacetimeDB setAiConfig notice:', e);
    }
  }

  document.querySelector('#open-ai-settings')!.textContent = 'Settings';
  document.querySelector('#mobile-ai-settings')!.textContent = 'Settings · Checking AI';
  showToast('AI connection saved. Testing now.');

  const verified = await AIProvider.testConnection(apiKey, model);
  syncAiStatus();

  if (verified) {
    showToast('OpenAI connected and verified successfully!', 'success', prevKey && prevKey !== apiKey ? {
      label: 'Undo',
      onClick: undoAiChange,
    } : undefined);
  } else {
    showToast('OpenAI key saved, but verification failed. Check model or quota.', 'error', prevKey && prevKey !== apiKey ? {
      label: 'Undo',
      onClick: undoAiChange,
    } : undefined);
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
let contextCloseTimer = 0;
const contextIsDrawer = () => window.matchMedia('(max-width: 1120px)').matches;

function setContextOpen(open: boolean) {
  window.clearTimeout(contextCloseTimer);
  if (!contextIsDrawer()) {
    contextPanel.hidden = false;
    contextPanel.inert = false;
    contextPanel.classList.remove('open');
    contextToggle.setAttribute('aria-expanded', 'false');
    return;
  }

  if (open) {
    contextPanel.hidden = false;
    contextPanel.inert = false;
    requestAnimationFrame(() => {
      contextPanel.classList.add('open');
      document.querySelector<HTMLButtonElement>('#context-close')?.focus();
    });
  } else {
    contextPanel.classList.remove('open');
    contextPanel.inert = true;
    contextCloseTimer = window.setTimeout(() => {
      if (!contextPanel.classList.contains('open')) contextPanel.hidden = true;
    }, 210);
    if (document.activeElement && contextPanel.contains(document.activeElement)) contextToggle.focus();
  }
  contextToggle.setAttribute('aria-expanded', String(open));
}
contextToggle.addEventListener('click', () => setContextOpen(!contextPanel.classList.contains('open')));
document.querySelector('#context-close')!.addEventListener('click', () => setContextOpen(false));
window.addEventListener('resize', () => setContextOpen(false));

document.querySelector<HTMLFormElement>('#quick-rule-form')?.addEventListener('submit', event => {
  event.preventDefault();
  const typeSelect = document.querySelector<HTMLSelectElement>('#quick-rule-type')!;
  const titleInput = document.querySelector<HTMLInputElement>('#quick-rule-title')!;
  const ruleType = (typeSelect.value === 'implicit' ? 'implicit' : 'explicit') as 'implicit' | 'explicit';
  const title = titleInput.value.trim();
  if (!title) return;
  addOrUpdateFlatRule(ruleType, title);
  titleInput.value = '';
  showToast(`Added an ${ruleType === 'explicit' ? 'agreed' : 'usual'} house rule.`);
});

document.querySelector('#reset-tabby-db')?.addEventListener('click', clearAllTabbyData);

document.querySelector<HTMLFormElement>('#quick-pantry-form')?.addEventListener('submit', event => {
  event.preventDefault();
  const nameInput = document.querySelector<HTMLInputElement>('#quick-pantry-name')!;
  const qtyInput = document.querySelector<HTMLInputElement>('#quick-pantry-qty')!;
  const name = nameInput.value.trim();
  const quantity = Math.max(1, parseInt(qtyInput.value, 10) || 1);
  if (!name) return;
  addOrUpdatePantryItem(name, quantity, 'items');
  nameInput.value = '';
  qtyInput.value = '1';
  showToast(`Added ${quantity} ${name} to the pantry.`);
});

// Login Modal Logic
function showLoginDialog() {
  const user = AuthManager.getCurrentUser();
  const nameInput = document.querySelector<HTMLInputElement>('#login-name')!;
  const phoneInput = document.querySelector<HTMLInputElement>('#login-phone')!;
  if (nameInput) nameInput.value = user.isLoggedIn ? user.name : '';
  if (phoneInput) phoneInput.value = user.isLoggedIn ? user.phone : '';
  openDialog('login-dialog');
}

function fillSamDemo() {
  const nameInput = document.querySelector<HTMLInputElement>('#login-name')!;
  const phoneInput = document.querySelector<HTMLInputElement>('#login-phone')!;
  if (nameInput) nameInput.value = 'Sam';
  if (phoneInput) phoneInput.value = '+91 98765 43210';
  showToast('Sam demo details are ready.');
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
document.querySelector('#fill-sam-demo')?.addEventListener('click', fillSamDemo);
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
  const flats = ResidenceManager.getFlats(selectedResId);
  const activeFlat = ResidenceManager.getActiveFlat();

  flatSelect.innerHTML = flats.map(f => `
    <option value="${escapeHtml(f.id)}" ${f.id === activeFlat.flatId ? 'selected' : ''}>${escapeHtml(f.flatNumber)} — ${escapeHtml(f.name)}</option>
  `).join('') + `<option value="__new__">Create a new flat or address</option>`;

  if (newFlatGroup) {
    newFlatGroup.hidden = flatSelect.value !== '__new__';
  }
}

function populateOnboardingDropdowns() {
  const residences = ResidenceManager.getResidences();
  const activeFlat = ResidenceManager.getActiveFlat();
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
  populateOnboardingDropdowns();
  if (mode === 'create') {
    const residence = document.querySelector<HTMLSelectElement>('#onboard-residence');
    if (residence) {
      residence.value = '__new__';
      updateOnboardFlatsDropdown();
    }
  }
  openDialog('onboard-dialog');
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

document.querySelector<HTMLFormElement>('#onboard-form')?.addEventListener('submit', event => {
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
    const resName = (document.querySelector<HTMLInputElement>('#new-res-name')?.value || '').trim() || 'New Residency';
    const resAddress = (document.querySelector<HTMLInputElement>('#new-res-address')?.value || '').trim() || 'Bengaluru';
    const newRes = ResidenceManager.addResidence(resName, resAddress);
    resId = newRes.id;
    newResidence = { name: resName, address: resAddress };
  }

  if (flatId === '__new__') {
    const flatNum = (document.querySelector<HTMLInputElement>('#new-flat-num')?.value || '').trim() || 'Flat 101';
    const flatName = (document.querySelector<HTMLInputElement>('#new-flat-name')?.value || '').trim() || 'Family Flat';
    const newFlat = ResidenceManager.addFlat(resId, flatName, flatNum);
    flatId = newFlat.id;
    if (isConnected) {
      try {
        if (newResidence) {
          connection.reducers.createHomeAndJoin({
            residenceName: newResidence.name,
            address: newResidence.address,
            flatName,
            flatNumber: flatNum,
            displayName,
          });
        } else {
          connection.reducers.createAndJoinFlat({
            residenceId: BigInt(resId.match(/^\d+$/) ? resId : '1'),
            flatName,
            flatNumber: flatNum,
            displayName,
          });
        }
      } catch (e) {}
    }
  } else {
    if (isConnected) {
      try {
        connection.reducers.joinFlat({
          flatId: BigInt(flatId.match(/^\d+$/) ? flatId : '1'),
          displayName,
        });
      } catch (e) {}
    }
  }

  // Update AuthManager and local active flat
  const currentUser = AuthManager.getCurrentUser();
  AuthManager.saveUser({
    ...currentUser,
    name: displayName,
    isLoggedIn: true,
    residenceId: resId,
    flatId,
  });

  const activeSelection = ResidenceManager.onboardMember(resId, flatId, displayName);
  document.querySelector<HTMLDialogElement>('#onboard-dialog')?.close();
  renderAll();
  showToast(`${activeSelection.flatName} is ready. Start with your first real task.`, 'success');
  document.querySelector<HTMLTextAreaElement>('#chat-input')?.focus();
});

renderConversation();
setContextOpen(false);
showFreshSessionOnboarding();
connectToDatabase();
syncAiStatus();
