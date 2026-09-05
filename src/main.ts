import './style.css';
import { DbConnection, tables } from './module_bindings';
import { AgentShopping } from './services/agentShopping';
import { AgentCooking, type Recipe } from './services/agentCooking';
import { AgentBilling, type SplitResult } from './services/agentBilling';
import { AIProvider } from './services/aiProvider';
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
  <main class="app-frame">
    <aside class="command-rail" aria-label="Tabby controls">
      <div class="brand-block">
        <div class="wordmark">tabby</div>
        <p>One conversation for a well-run home.</p>
      </div>

      <div class="routing-guide">
        <p class="rail-label">How it works</p>
        <ol>
          <li><span>01</span>Ask naturally</li>
          <li><span>02</span>Tabby routes the work</li>
          <li><span>03</span>Get the result here</li>
        </ol>
      </div>

      <div class="rail-actions">
        <label class="conversation-picker-label" for="conversation-picker">Conversation</label>
        <select id="conversation-picker" aria-label="Choose conversation"></select>
        <button class="quiet-button" id="new-conversation">New conversation</button>
        <button class="quiet-button" id="open-profile">Household profile</button>
        <button class="quiet-button" id="open-ai-settings">AI settings</button>
      </div>
    </aside>

    <section class="conversation-shell">
      <header class="conversation-header">
        <div>
          <h1>Home conversation</h1>
          <p class="connection-status"><span class="status-dot offline"></span><span id="status-text">Connecting to your home</span></p>
        </div>
        <div class="header-actions">
          <div class="route-status idle" id="route-status" aria-live="polite">
            <span class="route-signal"></span>
            <span id="route-label">Ready</span>
          </div>
          <button class="context-toggle" id="context-toggle" aria-expanded="false" aria-controls="context-panel"><span class="context-long">House context</span><span class="context-short">Context</span></button>
        </div>
      </header>

      <div class="conversation" id="conversation" aria-live="polite"></div>

      <div class="composer-zone">
        <form class="composer" id="chat-form">
          <label class="sr-only" for="chat-input">Message Tabby</label>
          <textarea id="chat-input" rows="1" maxlength="3000" placeholder="Ask about groceries, dinner, a bill, or your household..." required></textarea>
          <div class="composer-footer">
            <div class="attachment-group">
              <label class="attachment-button" for="receipt-input">Attach receipt</label>
              <input id="receipt-input" type="file" accept="image/png,image/jpeg,image/webp" />
              <span id="attachment-name"></span>
            </div>
            <button class="send-button" type="submit">Send</button>
          </div>
        </form>
        <p class="privacy-note">Personal chat is not shared with roommates. Only explicit household preferences enter shared context.</p>
      </div>
    </section>

    <aside class="context-panel" id="context-panel" aria-label="House context">
      <div class="context-header">
        <div>
          <h2>House context</h2>
          <p>Useful facts, not private conversations.</p>
        </div>
        <button class="context-close" id="context-close" aria-label="Close house context">Close</button>
      </div>
      <div class="mobile-context-actions">
        <button id="mobile-new-conversation">New chat</button>
        <button id="mobile-profile">Profile</button>
        <button id="mobile-ai-settings">AI settings</button>
      </div>
      <section class="context-section">
        <div class="section-heading"><h3>People</h3><span id="people-count">0</span></div>
        <div id="people-list" class="context-list"></div>
      </section>
      <section class="context-section">
        <div class="section-heading"><h3>Shared memory</h3><span id="memory-count">0</span></div>
        <div id="memory-list" class="context-list"></div>
      </section>
      <section class="context-section">
        <div class="section-heading"><h3>Pantry now</h3><span id="pantry-count">0</span></div>
        <div id="pantry-list" class="context-list"></div>
      </section>
    </aside>
  </main>

  <dialog id="profile-dialog">
    <form id="profile-form" class="settings-form">
      <div class="dialog-heading">
        <div><h2>Household profile</h2><p>This helps every agent make safer, more relevant choices.</p></div>
        <button type="button" class="dialog-close" data-close-dialog="profile-dialog">Close</button>
      </div>
      <label>Display name<input id="profile-name" autocomplete="name" required /></label>
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
      <div class="dialog-actions">
        <button type="button" class="secondary-button" data-close-dialog="profile-dialog">Cancel</button>
        <button type="submit" class="primary-button">Save profile</button>
      </div>
    </form>
  </dialog>

  <dialog id="ai-dialog">
    <form id="ai-form" class="settings-form">
      <div class="dialog-heading">
        <div><h2>AI settings</h2><p>Connect OpenAI to enable smart grocery planning, recipe recommendations, and vision receipt parsing.</p></div>
        <button type="button" class="dialog-close" data-close-dialog="ai-dialog">Close</button>
      </div>
      <div id="ai-status-indicator" class="ai-status-badge"></div>
      <label>OpenAI API key<input id="ai-key" type="password" autocomplete="off" placeholder="Enter a key to connect OpenAI" /></label>
      <label>Model<input id="ai-model" autocomplete="off" placeholder="gpt-4o-mini" /></label>
      <div class="dialog-actions">
        <button type="button" id="disconnect-ai" class="secondary-button danger-button" style="margin-right: auto;" hidden>Disconnect</button>
        <button type="button" class="secondary-button" data-close-dialog="ai-dialog">Cancel</button>
        <button type="submit" class="primary-button">Save settings</button>
      </div>
    </form>
  </dialog>

  <div id="toast-region" class="toast-region" aria-live="polite"></div>
`;

const host = import.meta.env.VITE_SPACETIMEDB_URI ?? 'https://maincloud.spacetimedb.com';
const database = import.meta.env.VITE_SPACETIMEDB_DB ?? 'tabby';
const tokenKey = `${host}/${database}/auth_token`;

let currentIdentity = '';
let isConnected = false;
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
  text: 'Tell me what needs handling at home. I can plan groceries, find a meal from your pantry, split a bill, or answer a question from the household context.',
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
    grocery: 'Grocery',
    chef: 'Chef',
    billing: 'Billing',
    context: 'Context',
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
  if (!isConnected || !activeConversationId || syncingConversation) return;
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
      connection.reducers.createConversation({ conversationId: id, title: 'Home conversation' });
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
    const agentLabel = message.role === 'assistant'
      ? `<span class="message-agent ${message.agent}">${message.agent === 'tabby' || message.agent === 'general' ? 'Tabby' : message.agent === 'context' ? 'House context' : formatCategory(message.agent)}</span>`
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
  const members = [...connection.db.member.iter()];
  if (members.length === 0 && currentIdentity) {
    return [HouseholdConfigManager.getProfile(currentIdentity, 'You')];
  }
  return members.map(member => {
    const identity = member.identity.toHexString();
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
    return profile;
  });
}

function currentName() {
  return getRoommates().find(roommate => roommate.identityHex === currentIdentity)?.displayName || 'You';
}

function pantryData() {
  return [...connection.db.pantryItem.iter()].map(item => ({
    id: item.id,
    name: item.name,
    quantity: item.quantity,
    unit: item.unit,
  }));
}

function renderContextPanel() {
  const roommates = getRoommates();
  const memory = getSharedContext();
  const pantry = pantryData().filter(item => item.quantity > 0).sort((a, b) => a.name.localeCompare(b.name));

  document.querySelector('#people-count')!.textContent = String(roommates.length);
  document.querySelector('#memory-count')!.textContent = String(memory.length);
  document.querySelector('#pantry-count')!.textContent = String(pantry.length);

  document.querySelector('#people-list')!.innerHTML = roommates.length
    ? roommates.map(roommate => `
      <div class="person-row">
        <span class="avatar">${escapeHtml(roommate.displayName.slice(0, 1).toUpperCase())}</span>
        <span><strong>${escapeHtml(roommate.displayName)}</strong><small>${roommate.identityHex === currentIdentity ? 'You' : 'Housemate'}</small></span>
      </div>`).join('')
    : '<p class="empty-state">People will appear when the home connects.</p>';

  document.querySelector('#memory-list')!.innerHTML = memory.length
    ? memory.slice(0, 8).map(fact => `
      <div class="memory-row">
        <span class="memory-category">${escapeHtml(formatCategory(fact.category))}</span>
        <p><strong>${escapeHtml(fact.subjectName)}</strong> · ${escapeHtml(fact.value)}</p>
      </div>`).join('')
    : '<p class="empty-state">No shared preferences yet. State a food preference in chat to add one.</p>';

  document.querySelector('#pantry-list')!.innerHTML = pantry.length
    ? pantry.slice(0, 10).map(item => `
      <div class="pantry-row"><span>${escapeHtml(item.name)}</span><strong>${item.quantity} ${escapeHtml(item.unit)}</strong></div>`).join('')
    : '<p class="empty-state">The pantry is empty. Tell Grocery what you bought.</p>';
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
                ${recipe.tips ? `<p><strong>Chef note:</strong> ${escapeHtml(recipe.tips)}</p>` : ''}
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
  setRoute('general', true);
  const analysis = await TabbyBrain.analyze(text);
  TabbyBrain.savePrivateFacts(currentIdentity || 'local', analysis.privateFacts);
  publishSharedFacts(analysis.shareableFacts);
  setRoute(analysis.intent, true);

  try {
    if (analysis.intent === 'grocery') {
      const purchase = text.match(/\b(?:bought|added|got)\s+(\d+(?:\.\d+)?)\s*([a-zA-Z]+)?\s+(?:of\s+)?(.+)/i);
      const pantryAddition = text.match(/\b(?:add|put)\s+(.+?)\s+(?:to|in)\s+(?:the\s+)?pantry\b/i);
      if ((purchase || pantryAddition) && isConnected) {
        const quantity = purchase ? Math.max(1, Math.round(Number(purchase[1]))) : 1;
        const unit = purchase?.[2] || 'items';
        const name = (purchase?.[3] || pantryAddition?.[1] || '').replace(/[.!?]+$/, '').trim();
        connection.reducers.addPantryItem({ name, quantity, unit });
        addMessage({ role: 'assistant', agent: 'grocery', text: `Added ${quantity} ${unit} of ${name} to the shared pantry.` });
      } else {
        const plan = await AgentShopping.generateShoppingPlan(pantryData(), getRoommates(), text);
        addMessage({ role: 'assistant', agent: 'grocery', contentHtml: renderShoppingPlan(plan) });
      }
    } else if (analysis.intent === 'chef') {
      const plan = await AgentCooking.generateRecipes(pantryData(), getRoommates(), text);
      addMessage({ role: 'assistant', agent: 'chef', contentHtml: renderCookingPlan(plan) });
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
    } else if (analysis.intent === 'context') {
      const answer = TabbyBrain.answerContextQuestion(text, getSharedContext());
      addMessage({
        role: 'assistant',
        agent: 'context',
        text: answer || (analysis.shareableFacts.length && isConnected
          ? 'I added that preference to the shared household context. Other housemates can ask me about it when planning food or expenses.'
          : analysis.shareableFacts.length
            ? 'I saved that preference privately. It will need a live home connection before it can be shared with your housemates.'
          : 'I do not have a relevant shared fact yet. I only share preferences that someone states explicitly.'),
      });
    } else if (analysis.shareableFacts.length) {
      addMessage({
        role: 'assistant',
        agent: 'context',
        text: isConnected
          ? 'I saved that as a household-safe preference so the other agents and your housemates can account for it.'
          : 'I saved that preference privately. Connect to the shared home before it can be available to housemates.',
      });
    } else {
      if (!AIProvider.hasApiKey()) {
        addMessage({
          role: 'assistant',
          agent: 'general',
          text: 'OpenAI is not connected yet. Open AI settings, add an API key, and I will answer general household questions through the backend.',
        });
        return;
      }
      const recentConversation = conversation.slice(-10)
        .map(message => `${message.role}: ${message.text || 'Structured household result'}`)
        .join('\n');
      const householdContext = getSharedContext().slice(0, 12)
        .map(memory => `${memory.subjectName}: ${memory.value}`)
        .join('; ');
      const generated = await AIProvider.generateText(
        `Recent conversation:\n${recentConversation}\n\nCurrent request:\n${text}`,
        `You are Tabby, a concise household coordination assistant. Answer practical home questions. Do not claim an action happened unless it was performed. Shared household context: ${householdContext || 'No shared memories yet.'}`,
      );
      addMessage({
        role: 'assistant',
        agent: 'general',
        text: generated || 'OpenAI could not complete that request. Check the saved model and API key in AI settings, then try again.',
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
      if (!isConnected) return showToast('Connect to the shared home before updating the pantry.', 'error');
      connection.reducers.addPantryItem({
        name: button.dataset.addPantry!,
        quantity: Math.max(1, Math.round(Number(button.dataset.quantity))),
        unit: button.dataset.unit || 'items',
      });
      button.textContent = 'Added';
      button.disabled = true;
    };
  });

  document.querySelectorAll<HTMLButtonElement>('[data-cook-recipe]').forEach(button => {
    button.onclick = () => {
      if (!isConnected) return showToast('Connect to the shared home before updating the pantry.', 'error');
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
          connection.reducers.addPantryItem({ name: match.name, quantity: -1, unit: match.unit });
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

function renderAll() {
  renderContextPanel();
  const status = document.querySelector('#status-text')!;
  status.textContent = isConnected ? 'Live with your household' : 'Offline — local chat still works';
  document.querySelector('.status-dot')?.classList.toggle('offline', !isConnected);
}

function syncAiStatus() {
  const status = [...connection.db.myAiStatus.iter()][0];
  const directKey = AIProvider.getApiKey();
  const isBackendConfigured = Boolean(status?.configured);
  const isBackendVerified = Boolean(status?.verified);
  const modelName = status?.model || AIProvider.getModelName() || 'gpt-4o-mini';

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

  const label = isVerified
    ? 'AI settings · Connected'
    : isConfigured
      ? 'AI settings · Needs verification'
      : 'AI settings · Not connected';
  document.querySelector('#open-ai-settings')!.textContent = label;
  document.querySelector('#mobile-ai-settings')!.textContent = isVerified
    ? 'AI connected'
    : isConfigured
      ? 'Verify AI connection'
      : 'AI settings';
}

const connection = DbConnection.builder()
  .withUri(host)
  .withDatabaseName(database)
  .withToken(localStorage.getItem(tokenKey) ?? undefined)
  .onConnect((ctx, identity, token) => {
    localStorage.setItem(tokenKey, token);
    currentIdentity = identity.toHexString();
    TabbyBrain.savePrivateFacts(currentIdentity, TabbyBrain.getPrivateFacts('local'));
    isConnected = true;
    ctx.subscriptionBuilder()
      .onApplied(() => {
        ensureConversation();
        syncAiStatus();
        renderAll();
      })
      .subscribe([
        tables.member,
        tables.pantryItem,
        tables.expense,
        tables.expenseSplit,
        tables.sharedMemory,
        tables.myConversations,
        tables.myConversationMessages,
        tables.myAiStatus,
      ]);
  })
  .onConnectError((_ctx, error) => {
    isConnected = false;
    console.warn('SpacetimeDB connection error:', error);
    renderAll();
  })
  .onDisconnect(() => {
    isConnected = false;
    renderAll();
  })
  .build();

AIProvider.configureBackend(request => connection.procedures.runAi({
  prompt: request.prompt,
  instructions: request.instructions,
  imageDataUrl: request.imageDataUrl,
  jsonMode: request.jsonMode,
}));

connection.db.member.onInsert(renderAll);
connection.db.member.onUpdate(renderAll);
connection.db.pantryItem.onInsert(renderAll);
connection.db.pantryItem.onUpdate(renderAll);
connection.db.pantryItem.onDelete(renderAll);
connection.db.sharedMemory.onInsert(renderAll);
connection.db.sharedMemory.onUpdate(renderAll);
connection.db.myAiStatus.onInsert(syncAiStatus);
connection.db.myAiStatus.onUpdate(syncAiStatus);
connection.db.myAiStatus.onDelete(syncAiStatus);
connection.db.myConversations.onInsert(() => {
  renderConversationPicker();
  if (!activeConversationId) ensureConversation();
});
connection.db.myConversations.onUpdate(renderConversationPicker);
connection.db.myConversationMessages.onInsert(syncConversationFromDatabase);

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

function showProfileDialog() {
  const profile = HouseholdConfigManager.getProfile(currentIdentity || 'local', currentName());
  (document.querySelector<HTMLInputElement>('#profile-name')!).value = profile.displayName;
  (document.querySelector<HTMLInputElement>('#profile-habits')!).value = profile.cookingHabits.join(', ');
  document.querySelectorAll<HTMLInputElement>('input[name="diet"]').forEach(input => {
    input.checked = profile.dietaryTags.includes(input.value as DietaryTag);
  });
  openDialog('profile-dialog');
}
document.querySelector('#open-profile')!.addEventListener('click', showProfileDialog);
document.querySelector('#mobile-profile')!.addEventListener('click', showProfileDialog);

document.querySelector<HTMLFormElement>('#profile-form')!.addEventListener('submit', event => {
  event.preventDefault();
  const identity = currentIdentity || 'local';
  const displayName = document.querySelector<HTMLInputElement>('#profile-name')!.value.trim();
  const dietaryTags = [...document.querySelectorAll<HTMLInputElement>('input[name="diet"]:checked')].map(input => input.value as DietaryTag);
  const cookingHabits = document.querySelector<HTMLInputElement>('#profile-habits')!.value.split(',').map(value => value.trim()).filter(Boolean);
  HouseholdConfigManager.saveProfile({ identityHex: identity, displayName, dietaryTags, cookingHabits, customSplitExclusions: [] });
  if (isConnected) {
    connection.reducers.setDisplayName({ displayName });
    publishSharedFacts(dietaryTags.map(diet => TabbyBrain.createSharedFact('diet', 'diet', diet.replace(/_/g, ' '))));
    cookingHabits.forEach(habit => publishSharedFacts([TabbyBrain.createSharedFact('routine', 'cooking habit', habit)]));
  }
  document.querySelector<HTMLDialogElement>('#profile-dialog')!.close();
  renderContextPanel();
  showToast('Household profile updated.');
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
  modelInput.value = AIProvider.getModelName() || 'gpt-4o-mini';

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
  const model = modelInput.value.trim() || 'gpt-4o-mini';

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

  document.querySelector('#open-ai-settings')!.textContent = 'AI settings · Checking connection';
  document.querySelector('#mobile-ai-settings')!.textContent = 'Checking AI connection';
  showToast('AI settings saved. Testing connection...');

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
  if (isConnected) {
    try {
      connection.reducers.createConversation({ conversationId: id, title: 'Home conversation' });
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

renderConversation();
renderAll();
syncAiStatus();
setContextOpen(false);
