import { DbConnection, tables } from './module_bindings';
import './style.css';
import { AgentShopping, ShoppingPlan } from './services/agentShopping';
import { AgentCooking, CookingPlan } from './services/agentCooking';
import { AgentBilling, SplitResult, ItemCategory } from './services/agentBilling';
import { HouseholdConfigManager, RoommateProfile, DietaryTag } from './services/householdConfig';
import { AIProvider } from './services/aiProvider';

const app = document.querySelector<HTMLDivElement>('#app')!;

app.innerHTML = `
  <header class="app-header">
    <div class="brand-wrapper">
      <div class="brand-logo">🐱</div>
      <div class="brand-info">
        <h1>tabby<span>.ai</span></h1>
        <div id="status-badge" class="status-badge">
          <span class="status-dot"></span>
          <span id="status-text">Connecting to household…</span>
        </div>
      </div>
    </div>
    <div class="header-actions">
      <button id="btn-api-key" class="btn-secondary" title="Configure Gemini AI">
        ✨ ${AIProvider.hasApiKey() ? 'AI Active (Gemini)' : 'Set Gemini Key (Optional)'}
      </button>
      <button id="btn-profile" class="btn-secondary">
        👤 <span id="my-name-display">My Profile</span>
      </button>
    </div>
  </header>

  <nav class="nav-tabs" role="tablist">
    <button class="tab-btn active" data-tab="shopping">
      🛒 Shopping Assistant <span class="agent-badge">Agent 1</span>
    </button>
    <button class="tab-btn" data-tab="cooking">
      🍳 Cooking Assistant <span class="agent-badge">Agent 2</span>
    </button>
    <button class="tab-btn" data-tab="billing">
      🧾 Smart Billing <span class="agent-badge">Agent 3</span>
    </button>
    <button class="tab-btn" data-tab="roommates">
      ⚙️ Roommates & Rules
    </button>
  </nav>

  <!-- TAB 1: SHOPPING ASSISTANT -->
  <section id="tab-shopping" class="tab-pane active">
    <div class="grid-layout grid-layout-3">
      <!-- Pantry Stock -->
      <div class="card">
        <div class="card-header">
          <div>
            <h2 class="card-title">📦 Pantry Inventory</h2>
            <p class="card-subtitle">Realtime synchronized across all roommates</p>
          </div>
          <button id="btn-add-pantry-modal" class="btn-primary">+ Add Item</button>
        </div>
        <div id="pantry-items-container" class="pantry-grid">
          <p class="card-subtitle">Loading pantry items…</p>
        </div>
      </div>

      <!-- Agent 1 Shopping Recommendations -->
      <div class="card">
        <div class="card-header">
          <div>
            <h2 class="card-title">🛒 Agent 1: Restock & Shopping Plan</h2>
            <p id="shopping-plan-subtitle" class="card-subtitle">
              Calculated from pantry levels, roommate diets & cooking habits
            </p>
          </div>
          <button id="btn-refresh-shopping" class="btn-emerald">⚡ Generate AI Plan</button>
        </div>
        <div id="shopping-plan-summary" style="margin-bottom: 16px; font-size: 0.88rem; color: #cbd5e1;"></div>
        <div id="shopping-recommendations-list">
          <p class="card-subtitle">Click "Generate AI Plan" to scan current pantry and roommate habits.</p>
        </div>
      </div>
    </div>
  </section>

  <!-- TAB 2: COOKING ASSISTANT -->
  <section id="tab-cooking" class="tab-pane">
    <div class="card" style="margin-bottom: 24px;">
      <div class="card-header">
        <div>
          <h2 class="card-title">🍳 Agent 2: Zero-Waste Cooking Assistant</h2>
          <p id="cooking-headline" class="card-subtitle">
            Crafts meals tailored to available pantry items and roommate dietary rules
          </p>
        </div>
        <button id="btn-refresh-recipes" class="btn-emerald">✨ Find What We Can Cook</button>
      </div>
      <div id="recipes-container">
        <p class="card-subtitle">Scanning pantry items to suggest recipes…</p>
      </div>
    </div>
  </section>

  <!-- TAB 3: SMART BILLING ASSISTANT -->
  <section id="tab-billing" class="tab-pane">
    <div class="grid-layout grid-layout-2">
      <!-- Bill Ingestion Card -->
      <div class="card">
        <div class="card-header">
          <div>
            <h2 class="card-title">🧾 Agent 3: Smart Bill Ingestion</h2>
            <p class="card-subtitle">Upload receipt photo/PDF or paste itemized bill text</p>
          </div>
        </div>

        <div id="receipt-dropzone" class="receipt-dropzone">
          <p style="font-size: 1.5rem; margin-bottom: 4px;">📷</p>
          <strong>Upload Bill Photo or PDF</strong>
          <p class="card-subtitle" style="margin-top: 4px;">Drag & drop image / PDF, or click to browse</p>
          <input type="file" id="bill-file-input" accept="image/*,application/pdf" style="display: none;" />
        </div>

        <div style="display: flex; gap: 8px; margin-bottom: 14px;">
          <button id="btn-sample-grocery" class="btn-secondary" style="font-size: 0.78rem;">📝 Sample Mixed Grocery</button>
          <button id="btn-sample-dinner" class="btn-secondary" style="font-size: 0.78rem;">🍗 Sample Dinner Bill (Veg+Meat)</button>
        </div>

        <form id="bill-form">
          <div style="margin-bottom: 12px;">
            <label style="font-size: 0.8rem; color: var(--text-secondary); display: block; margin-bottom: 4px;">Bill Title</label>
            <input id="bill-title-input" placeholder="e.g. Swiggy Instamart Grocery" required />
          </div>
          <div style="margin-bottom: 12px;">
            <label style="font-size: 0.8rem; color: var(--text-secondary); display: block; margin-bottom: 4px;">Bill Content (Receipt lines)</label>
            <textarea id="bill-text-input" rows="6" placeholder="Butter Chicken - 380&#10;Paneer Tikka - 260&#10;Garlic Naan (3) - 150&#10;Electricity / Wifi - 600&#10;Delivery & GST - 80"></textarea>
          </div>
          <button type="submit" id="btn-split-bill" class="btn-primary" style="width: 100%; justify-content: center;">
            ⚖️ Parse & Calculate Rule-Based Split
          </button>
        </form>

        <div id="split-result-box" style="margin-top: 20px; display: none;"></div>
      </div>

      <!-- Expense Ledger & Balances -->
      <div class="card">
        <div class="card-header">
          <div>
            <h2 class="card-title">💰 Household Expense Ledger</h2>
            <p class="card-subtitle">Recorded in SpacetimeDB with rule-based breakdowns</p>
          </div>
        </div>
        <div id="expense-ledger-list">
          <p class="card-subtitle">Loading expenses…</p>
        </div>
      </div>
    </div>
  </section>

  <!-- TAB 4: ROOMMATES & RULES -->
  <section id="tab-roommates" class="tab-pane">
    <div class="grid-layout grid-layout-2">
      <!-- Roommate Profiles -->
      <div class="card">
        <div class="card-header">
          <div>
            <h2 class="card-title">👥 Household Roommates</h2>
            <p class="card-subtitle">Dietary restrictions, allergies, and cooking habits</p>
          </div>
        </div>
        <div id="roommates-list"></div>
      </div>

      <!-- Config & Exemption Rules -->
      <div class="card">
        <div class="card-header">
          <div>
            <h2 class="card-title">⚖️ Split Configuration Rules</h2>
            <p class="card-subtitle">Agent 3 automatically enforces these rules when splitting bills</p>
          </div>
        </div>
        <div id="rules-config-list"></div>
      </div>
    </div>
  </section>

  <!-- Floating Chat Assistant -->
  <button id="chat-fab" class="chat-fab" aria-label="Chat with Tabby Agents">✨</button>
  <aside id="chat-drawer" class="chat-drawer" aria-hidden="true">
    <div class="chat-drawer-header">
      <div>
        <strong style="display: block; font-size: 0.95rem;">Tabby Agent Hub</strong>
        <small style="color: var(--text-muted);">Shopping, Cooking & Billing Assistant</small>
      </div>
      <button id="chat-close-btn" class="btn-icon">✕</button>
    </div>
    <div id="chat-messages" class="chat-drawer-messages">
      <div class="chat-bubble agent">
        👋 Hey! I'm Tabby. I coordinate your household's 3 agents:
        <br/><br/>
        1. 🛒 <strong>Shopping</strong>: Track pantry & restock staples.
        <br/>
        2. 🍳 <strong>Cooking</strong>: Safe recipes tailored to pantry & diets.
        <br/>
        3. 🧾 <strong>Billing</strong>: Split bills with vegetarian & custom rules!
      </div>
    </div>
    <form id="chat-drawer-form" class="chat-drawer-footer">
      <input id="chat-drawer-input" placeholder="Ask Tabby or tell me what you bought…" autocomplete="off" />
      <button type="submit" class="btn-primary">Send</button>
    </form>
  </aside>

  <!-- MODALS -->
  <!-- API Key Modal -->
  <div id="api-modal" class="modal-overlay" hidden>
    <div class="modal-dialog">
      <h3 style="margin-bottom: 8px;">✨ Gemini AI Integration</h3>
      <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 16px;">
        Tabby includes built-in heuristic agents out of the box. You can optionally connect Google Gemini 1.5 for multimodal vision receipt parsing and custom recipe creativity.
      </p>
      <input id="gemini-key-input" type="password" placeholder="AIzaSy..." style="margin-bottom: 14px;" />
      <div style="display: flex; justify-content: flex-end; gap: 8px;">
        <button id="btn-cancel-api-modal" class="btn-secondary">Cancel</button>
        <button id="btn-save-api-key" class="btn-primary">Save Key</button>
      </div>
    </div>
  </div>

  <!-- Profile Edit Modal -->
  <div id="profile-modal" class="modal-overlay" hidden>
    <div class="modal-dialog">
      <h3 style="margin-bottom: 8px;">👤 Edit Roommate Profile</h3>
      <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 14px;">
        Tabby's 3 agents use your dietary restrictions and cooking habits to personalize meals, shopping, and bill exemptions.
      </p>
      <form id="profile-form">
        <div style="margin-bottom: 12px;">
          <label style="font-size: 0.8rem; color: var(--text-secondary); display: block; margin-bottom: 4px;">Display Name</label>
          <input id="profile-name-input" required />
        </div>
        <div style="margin-bottom: 12px;">
          <label style="font-size: 0.8rem; color: var(--text-secondary); display: block; margin-bottom: 4px;">Dietary Restrictions (comma-separated)</label>
          <input id="profile-diets-input" placeholder="e.g. vegetarian, vegan, lactose_intolerant, no_alcohol" />
          <small style="font-size: 0.72rem; color: var(--text-muted);">Options: vegetarian, vegan, eggetarian, non_veg, lactose_intolerant, no_alcohol, gluten_free</small>
        </div>
        <div style="margin-bottom: 16px;">
          <label style="font-size: 0.8rem; color: var(--text-secondary); display: block; margin-bottom: 4px;">Favorite Dishes / What You Cook Usually</label>
          <input id="profile-habits-input" placeholder="e.g. Dal Tadka, Pasta, Fried Rice, Chicken Curry" />
        </div>
        <div style="display: flex; justify-content: flex-end; gap: 8px;">
          <button type="button" id="btn-cancel-profile-modal" class="btn-secondary">Cancel</button>
          <button type="submit" class="btn-primary">Save Profile</button>
        </div>
      </form>
    </div>
  </div>

  <!-- Add Pantry Item Modal -->
  <div id="add-pantry-modal" class="modal-overlay" hidden>
    <div class="modal-dialog">
      <h3 style="margin-bottom: 12px;">📦 Add / Restock Pantry Item</h3>
      <form id="add-pantry-form">
        <div style="margin-bottom: 12px;">
          <label style="font-size: 0.8rem; color: var(--text-secondary); display: block; margin-bottom: 4px;">Item Name</label>
          <input id="pantry-name-input" placeholder="e.g. Rice, Milk, Eggs, Pasta, Tomatoes" required />
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 16px;">
          <div>
            <label style="font-size: 0.8rem; color: var(--text-secondary); display: block; margin-bottom: 4px;">Quantity</label>
            <input type="number" id="pantry-qty-input" value="1" min="1" required />
          </div>
          <div>
            <label style="font-size: 0.8rem; color: var(--text-secondary); display: block; margin-bottom: 4px;">Unit</label>
            <input id="pantry-unit-input" placeholder="kg / litres / pack / items" value="items" required />
          </div>
        </div>
        <div style="display: flex; justify-content: flex-end; gap: 8px;">
          <button type="button" id="btn-cancel-pantry-modal" class="btn-secondary">Cancel</button>
          <button type="submit" class="btn-emerald">Add to Pantry</button>
        </div>
      </form>
    </div>
  </div>
`;

// ==========================================
// SpacetimeDB & State Initialization
// ==========================================
const host = import.meta.env.VITE_SPACETIMEDB_URI ?? 'https://maincloud.spacetimedb.com';
const database = import.meta.env.VITE_SPACETIMEDB_DB ?? 'tabby';
const tokenKey = `${host}/${database}/auth_token`;

let currentIdentity = '';
let currentShoppingPlan: ShoppingPlan | null = null;
let currentCookingPlan: CookingPlan | null = null;
let lastUploadedImageBase64: string | undefined = undefined;

function money(paise: bigint) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(paise) / 100);
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  })[character]!);
}

const connection = DbConnection.builder()
  .withUri(host)
  .withDatabaseName(database)
  .withToken(localStorage.getItem(tokenKey) ?? undefined)
  .onConnect((ctx, identity, token) => {
    localStorage.setItem(tokenKey, token);
    currentIdentity = identity.toHexString();
    const statusText = document.querySelector<HTMLElement>('#status-text')!;
    statusText.textContent = 'Live · synced with home';
    document.querySelector<HTMLElement>('#status-badge')?.classList.remove('offline');
    
    ctx.subscriptionBuilder()
      .onApplied(() => {
        renderAll();
        // Trigger initial AI plans
        refreshShoppingPlan();
        refreshCookingPlan();
      })
      .subscribe([
        tables.member,
        tables.pantryItem,
        tables.expense,
        tables.expenseSplit,
        tables.chatMessage,
      ]);
  })
  .onConnectError((_ctx, error) => {
    const statusText = document.querySelector<HTMLElement>('#status-text')!;
    statusText.textContent = 'Offline (Local demo active)';
    document.querySelector<HTMLElement>('#status-badge')?.classList.add('offline');
    console.warn('SpacetimeDB connection error:', error);
    renderAll();
  })
  .onDisconnect(() => {
    const statusText = document.querySelector<HTMLElement>('#status-text')!;
    statusText.textContent = 'Disconnected';
    document.querySelector<HTMLElement>('#status-badge')?.classList.add('offline');
  })
  .build();

// Bind reactive table updates
connection.db.member.onInsert(renderAll);
connection.db.member.onUpdate(renderAll);
connection.db.pantryItem.onInsert(renderAll);
connection.db.pantryItem.onUpdate(renderAll);
connection.db.pantryItem.onDelete(renderAll);
connection.db.expense.onInsert(renderAll);
connection.db.chatMessage.onInsert(renderChat);

// ==========================================
// Core Render Functions
// ==========================================
function getAllRoommates(): RoommateProfile[] {
  const dbMembers = [...connection.db.member.iter()];
  
  if (dbMembers.length > 0) {
    return dbMembers.map(m => {
      const hex = m.identity.toHexString();
      const profile = HouseholdConfigManager.getProfile(hex, m.displayName);
      profile.displayName = m.displayName;
      return profile;
    });
  }

  // Fallback demo roommates if offline/empty
  const myHex = currentIdentity || '0x_demo_user';
  return [
    HouseholdConfigManager.getProfile(myHex, 'You'),
    HouseholdConfigManager.getProfile('0x_alex_veg', 'Alex (Vegetarian)'),
    HouseholdConfigManager.getProfile('0x_bob_meat', 'Bob (Omnivore)'),
  ];
}

function renderAll() {
  renderPantry();
  renderExpenses();
  renderRoommatesAndRules();
  renderChat();
  updateMyProfileDisplay();
}

function updateMyProfileDisplay() {
  const roommates = getAllRoommates();
  const me = roommates.find(r => r.identityHex === currentIdentity) || roommates[0];
  const nameEl = document.querySelector<HTMLElement>('#my-name-display');
  if (nameEl && me) {
    nameEl.textContent = me.displayName;
  }
}

function renderPantry() {
  const container = document.querySelector<HTMLElement>('#pantry-items-container')!;
  const items = [...connection.db.pantryItem.iter()];

  if (items.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; padding: 24px; text-align: center; color: var(--text-muted); background: rgba(255,255,255,0.02); border-radius: var(--radius-md);">
        🌾 Pantry is empty. Click "+ Add Item" or ask Agent 1 to populate staples!
      </div>`;
    return;
  }

  container.innerHTML = items.map(item => `
    <div class="pantry-card">
      <div class="pantry-info">
        <strong>${escapeHtml(item.name)}</strong>
        <small>${escapeHtml(item.unit)}</small>
      </div>
      <div class="pantry-actions">
        <span class="qty-badge">${item.quantity} ${escapeHtml(item.unit)}</span>
        <div class="qty-controls">
          <button class="btn-icon btn-pantry-dec" data-name="${escapeHtml(item.name)}" title="Decrease stock">-</button>
          <button class="btn-icon btn-pantry-inc" data-name="${escapeHtml(item.name)}" data-unit="${escapeHtml(item.unit)}" title="Add stock">+</button>
        </div>
      </div>
    </div>
  `).join('');

  // Attach pantry increment / decrement events
  container.querySelectorAll('.btn-pantry-inc').forEach(btn => {
    btn.addEventListener('click', () => {
      const name = btn.getAttribute('data-name')!;
      const unit = btn.getAttribute('data-unit') || 'items';
      connection.reducers.addPantryItem({ name, quantity: 1, unit });
    });
  });

  container.querySelectorAll('.btn-pantry-dec').forEach(btn => {
    btn.addEventListener('click', () => {
      const name = btn.getAttribute('data-name')!;
      connection.reducers.addPantryItem({ name, quantity: -1, unit: 'items' });
    });
  });
}

function renderExpenses() {
  const container = document.querySelector<HTMLElement>('#expense-ledger-list')!;
  const expenses = [...connection.db.expense.iter()].reverse();

  if (expenses.length === 0) {
    container.innerHTML = `
      <div style="padding: 24px; text-align: center; color: var(--text-muted); background: rgba(255,255,255,0.02); border-radius: var(--radius-md);">
        📑 No expenses recorded yet. Upload a receipt or use Agent 3 to calculate a split!
      </div>`;
    return;
  }

  const members = [...connection.db.member.iter()];
  const getMemberName = (ident: { toHexString(): string }) => {
    return members.find(m => m.identity.toHexString() === ident.toHexString())?.displayName || 'Roommate';
  };

  container.innerHTML = expenses.map(expense => `
    <div class="rec-card" style="align-items: flex-start; flex-direction: column; gap: 8px;">
      <div style="display: flex; justify-content: space-between; width: 100%; align-items: center;">
        <div>
          <strong style="font-size: 1rem;">${escapeHtml(expense.title)}</strong>
          <span class="card-subtitle" style="display: block;">Paid by ${escapeHtml(getMemberName(expense.paidBy))}</span>
        </div>
        <span style="font-family: var(--font-mono); font-size: 1.1rem; font-weight: 700; color: var(--accent-emerald);">
          ${money(expense.amountPaise)}
        </span>
      </div>
    </div>
  `).join('');
}

function renderRoommatesAndRules() {
  const roommates = getAllRoommates();
  const list = document.querySelector<HTMLElement>('#roommates-list')!;

  list.innerHTML = roommates.map(r => `
    <div class="rec-card" style="flex-direction: column; align-items: flex-start; gap: 8px;">
      <div style="display: flex; justify-content: space-between; width: 100%; align-items: center;">
        <strong>👤 ${escapeHtml(r.displayName)} ${r.identityHex === currentIdentity ? '(You)' : ''}</strong>
        <div>
          ${r.dietaryTags.map(tag => `<span class="tag-pill tag-${tag.replace(/_/g, '-')}">${escapeHtml(tag)}</span>`).join(' ')}
        </div>
      </div>
      <div style="font-size: 0.8rem; color: var(--text-secondary);">
        🍳 <strong>Usually cooks:</strong> ${escapeHtml(r.cookingHabits.join(', ') || 'General home cooking')}
      </div>
    </div>
  `).join('');

  const rulesList = document.querySelector<HTMLElement>('#rules-config-list')!;
  const rules = HouseholdConfigManager.getRules();

  rulesList.innerHTML = rules.map(rule => `
    <div class="rule-toggle-card">
      <div>
        <strong style="font-size: 0.95rem; display: block;">${escapeHtml(rule.name)}</strong>
        <p class="card-subtitle" style="margin-top: 2px;">${escapeHtml(rule.description)}</p>
      </div>
      <label class="switch">
        <input type="checkbox" class="rule-toggle-checkbox" data-rule-id="${rule.id}" ${rule.enabled ? 'checked' : ''} />
        <span class="slider"></span>
      </label>
    </div>
  `).join('');

  rulesList.querySelectorAll<HTMLInputElement>('.rule-toggle-checkbox').forEach(input => {
    input.addEventListener('change', () => {
      const ruleId = input.getAttribute('data-rule-id')!;
      HouseholdConfigManager.toggleRule(ruleId);
      renderRoommatesAndRules();
    });
  });
}

function renderChat() {
  const container = document.querySelector<HTMLElement>('#chat-messages')!;
  const history = [...connection.db.chatMessage.iter()];

  if (history.length > 0) {
    const members = [...connection.db.member.iter()];
    const getMemberName = (ident: { toHexString(): string }) => {
      return members.find(m => m.identity.toHexString() === ident.toHexString())?.displayName || 'Roommate';
    };

    container.innerHTML = history.map(msg => {
      if (msg.kind === 'system' || msg.kind === 'agent') {
        return `<div class="chat-bubble agent">🤖 ${escapeHtml(msg.body)}</div>`;
      }
      const isMe = msg.sender.toHexString() === currentIdentity;
      return `<div class="chat-bubble ${isMe ? 'user' : 'agent'}"><small style="display: block; font-size: 0.7rem; opacity: 0.7;">${escapeHtml(getMemberName(msg.sender))}</small>${escapeHtml(msg.body)}</div>`;
    }).join('');
    container.scrollTop = container.scrollHeight;
  }
}

// ==========================================
// Agent 1: Shopping Plan Generator
// ==========================================
async function refreshShoppingPlan() {
  const container = document.querySelector<HTMLElement>('#shopping-recommendations-list')!;
  const summaryEl = document.querySelector<HTMLElement>('#shopping-plan-summary')!;
  
  container.innerHTML = `<p class="card-subtitle">⚡ Agent 1 is analyzing pantry stock and roommate preferences…</p>`;
  
  const pantryItems = [...connection.db.pantryItem.iter()].map(p => ({
    id: p.id,
    name: p.name,
    quantity: p.quantity,
    unit: p.unit,
  }));
  const roommates = getAllRoommates();

  currentShoppingPlan = await AgentShopping.generateShoppingPlan(pantryItems, roommates);
  
  summaryEl.textContent = `💡 ${currentShoppingPlan.summary}`;

  container.innerHTML = currentShoppingPlan.items.map(item => `
    <div class="rec-card urgency-${item.urgency}">
      <div style="flex: 1;">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
          <strong style="text-transform: capitalize; font-size: 0.95rem;">${escapeHtml(item.itemName)}</strong>
          <span class="tag-pill tag-utility">${escapeHtml(item.category)}</span>
          <span class="agent-badge" style="background: rgba(255,255,255,0.1);">${item.urgency}</span>
        </div>
        <p style="font-size: 0.8rem; color: #cbd5e1; margin-bottom: 4px;">${escapeHtml(item.reason)}</p>
        <small style="color: var(--text-muted); font-size: 0.72rem;">Matched meals: ${escapeHtml(item.matchedMeals.join(', '))}</small>
      </div>
      <button class="btn-secondary btn-add-suggested" data-name="${escapeHtml(item.itemName)}" data-qty="${item.suggestedQuantity}" data-unit="${escapeHtml(item.unit)}">
        + ${item.suggestedQuantity} ${escapeHtml(item.unit)}
      </button>
    </div>
  `).join('');

  container.querySelectorAll('.btn-add-suggested').forEach(btn => {
    btn.addEventListener('click', () => {
      const name = btn.getAttribute('data-name')!;
      const quantity = parseInt(btn.getAttribute('data-qty') || '1', 10);
      const unit = btn.getAttribute('data-unit') || 'items';
      connection.reducers.addPantryItem({ name, quantity, unit });
      btn.textContent = '✓ Added!';
      (btn as HTMLButtonElement).disabled = true;
    });
  });
}

// ==========================================
// Agent 2: Cooking Assistant & Recipes
// ==========================================
async function refreshCookingPlan() {
  const container = document.querySelector<HTMLElement>('#recipes-container')!;
  const headlineEl = document.querySelector<HTMLElement>('#cooking-headline')!;
  
  container.innerHTML = `<p class="card-subtitle">🍳 Agent 2 is crafting customized recipes from your pantry items…</p>`;

  const pantryItems = [...connection.db.pantryItem.iter()].map(p => ({
    id: p.id,
    name: p.name,
    quantity: p.quantity,
    unit: p.unit,
  }));
  const roommates = getAllRoommates();

  currentCookingPlan = await AgentCooking.generateRecipes(pantryItems, roommates);
  
  headlineEl.textContent = currentCookingPlan.headline;

  container.innerHTML = currentCookingPlan.recipes.map(recipe => `
    <article class="recipe-card">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 10px;">
        <div>
          <h3 style="font-size: 1.15rem; font-weight: 700; color: #ffffff;">${escapeHtml(recipe.title)}</h3>
          <p style="font-size: 0.85rem; color: #cbd5e1; margin-top: 4px;">${escapeHtml(recipe.description)}</p>
        </div>
        <button class="btn-emerald btn-cook-recipe" data-recipe-id="${recipe.id}">
          👨‍🍳 Cook This Meal
        </button>
      </div>

      <div class="recipe-meta">
        <span>⏱️ Prep: ${recipe.prepTimeMinutes}m | Cook: ${recipe.cookTimeMinutes}m</span>
        <span>🍽️ Servings: ${recipe.servings}</span>
        <span>🔥 Difficulty: ${recipe.difficulty}</span>
        <span>👥 Safe for: ${recipe.compatibleRoommates.map(escapeHtml).join(', ')}</span>
      </div>

      <div class="ingredients-chips">
        ${recipe.ingredients.map(ing => `
          <span class="ing-chip ${ing.inPantry ? 'in-pantry' : 'missing'}">
            ${ing.inPantry ? '✓' : '✗'} ${ing.quantity} ${escapeHtml(ing.unit)} ${escapeHtml(ing.name)}
          </span>
        `).join('')}
      </div>

      <ol class="instructions-list">
        ${recipe.instructions.map(step => `<li>${escapeHtml(step)}</li>`).join('')}
      </ol>

      <div style="font-size: 0.78rem; color: var(--accent-amber); background: rgba(245, 158, 11, 0.08); padding: 8px 12px; border-radius: var(--radius-sm); border: 1px solid rgba(245, 158, 11, 0.2);">
        💡 <strong>Chef Tip:</strong> ${escapeHtml(recipe.tips)}
      </div>
    </article>
  `).join('');

  container.querySelectorAll('.btn-cook-recipe').forEach(btn => {
    btn.addEventListener('click', () => {
      const recipeId = btn.getAttribute('data-recipe-id')!;
      const recipe = currentCookingPlan?.recipes.find(r => r.id === recipeId);
      if (recipe) {
        // Decrement pantry quantities
        recipe.ingredients.forEach(ing => {
          if (ing.inPantry) {
            connection.reducers.addPantryItem({
              name: ing.name,
              quantity: -Math.max(1, Math.min(ing.quantity, 1)),
              unit: ing.unit,
            });
          }
        });
        btn.textContent = '🍽️ Bon Appétit! Pantry Updated';
        (btn as HTMLButtonElement).disabled = true;
      }
    });
  });
}

// ==========================================
// Agent 3: Smart Bill Parsing & Rule Splits
// ==========================================
let currentSplitResult: SplitResult | null = null;

async function handleSplitBill(e: Event) {
  e.preventDefault();
  const titleInput = document.querySelector<HTMLInputElement>('#bill-title-input')!;
  const textInput = document.querySelector<HTMLTextAreaElement>('#bill-text-input')!;
  const resultBox = document.querySelector<HTMLElement>('#split-result-box')!;

  const title = titleInput.value.trim() || 'Shared Bill';
  const text = textInput.value.trim();

  resultBox.style.display = 'block';
  resultBox.innerHTML = `<p class="card-subtitle">⚖️ Agent 3 is analyzing items and applying roommate exemption rules…</p>`;

  const roommates = getAllRoommates();
  const rules = HouseholdConfigManager.getRules();

  currentSplitResult = await AgentBilling.parseAndSplitBill(
    { text, imageBase64: lastUploadedImageBase64, title },
    roommates,
    rules
  );

  renderSplitResult(currentSplitResult);
}

function renderSplitResult(res: SplitResult) {
  const resultBox = document.querySelector<HTMLElement>('#split-result-box')!;
  
  resultBox.innerHTML = `
    <div class="split-summary-card">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
        <div>
          <h3 style="font-size: 1.1rem; font-weight: 700;">📊 ${escapeHtml(res.billTitle)}</h3>
          <p class="card-subtitle">Total Bill: ${money(res.totalAmountPaise)} (${res.lineItems.length} line items)</p>
        </div>
        <button id="btn-commit-split" class="btn-emerald">💾 Save & Record to SpacetimeDB</button>
      </div>

      <!-- Itemized breakdown with categories -->
      <div style="margin-bottom: 16px; background: rgba(0,0,0,0.2); border-radius: var(--radius-sm); padding: 8px;">
        <strong style="font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-secondary); display: block; margin-bottom: 8px;">
          Line Items & Category Tagging
        </strong>
        ${res.lineItems.map(item => `
          <div class="line-item-row">
            <div>
              <strong>${escapeHtml(item.name)}</strong>
              ${item.excludedRoommates.length > 0 ? `<small class="exempt-note">🚫 ${item.excludedRoommates.length} roommate(s) exempt by diet rule</small>` : ''}
            </div>
            <span class="tag-pill tag-${item.category.replace(/_/g, '-')}">${item.category}</span>
            <span style="font-family: var(--font-mono); font-weight: 600;">${money(item.pricePaise)}</span>
            <small style="color: var(--text-muted);">${item.assignedRoommates.length}-way split</small>
          </div>
        `).join('')}
      </div>

      <!-- Per-Roommate Shares -->
      <strong style="font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-secondary); display: block; margin-bottom: 8px;">
        Calculated Fair Roommate Owed Shares
      </strong>
      <div>
        ${res.roommateShares.map(share => `
          <div class="roommate-split-row">
            <div>
              <strong>${escapeHtml(share.displayName)}</strong>
              ${share.isExemptFromItems.length > 0 
                ? `<span class="exempt-note">🌱 Exempt from ${share.isExemptFromItems.length} items (${escapeHtml(share.isExemptFromItems.join(', '))})</span>` 
                : '<small style="color: var(--text-muted);">Standard shared split</small>'
              }
            </div>
            <div style="text-align: right;">
              <span style="font-family: var(--font-mono); font-size: 1.1rem; font-weight: 700; color: #ffffff;">
                ${money(share.amountPaise)}
              </span>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  document.querySelector('#btn-commit-split')?.addEventListener('click', () => {
    if (!currentSplitResult) return;
    connection.reducers.recordExpense({
      title: currentSplitResult.billTitle,
      amountPaise: currentSplitResult.totalAmountPaise,
    });
    const commitBtn = document.querySelector<HTMLButtonElement>('#btn-commit-split')!;
    commitBtn.textContent = '✓ Recorded in SpacetimeDB!';
    commitBtn.disabled = true;
  });
}

// ==========================================
// Event Listeners & Modals
// ==========================================

// Navigation Tabs
document.querySelectorAll<HTMLButtonElement>('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    const tabName = btn.getAttribute('data-tab')!;
    document.querySelector(`#tab-${tabName}`)?.classList.add('active');
  });
});

// Refresh Buttons
document.querySelector('#btn-refresh-shopping')?.addEventListener('click', refreshShoppingPlan);
document.querySelector('#btn-refresh-recipes')?.addEventListener('click', refreshCookingPlan);
document.querySelector('#bill-form')?.addEventListener('submit', handleSplitBill);

// Sample Receipt Buttons
document.querySelector('#btn-sample-dinner')?.addEventListener('click', () => {
  const titleInput = document.querySelector<HTMLInputElement>('#bill-title-input')!;
  const textInput = document.querySelector<HTMLTextAreaElement>('#bill-text-input')!;
  titleInput.value = 'Friday Night Dinner (Biryani & Paneer)';
  textInput.value = `Chicken Biryani (2) - 560
Paneer Butter Masala - 280
Garlic Naan (4) - 160
Craft Beer - 320
GST & Service Charge - 120`;
});

document.querySelector('#btn-sample-grocery')?.addEventListener('click', () => {
  const titleInput = document.querySelector<HTMLInputElement>('#bill-title-input')!;
  const textInput = document.querySelector<HTMLTextAreaElement>('#bill-text-input')!;
  titleInput.value = 'Weekly Supermarket Restock';
  textInput.value = `Basmati Rice 5kg - 450
Fresh Milk 2L - 130
Eggs 12-pack - 95
Dishwashing Soap & Detergent - 220
Assorted Veggies (Onions, Tomatoes) - 180`;
});

// Dropzone & File Upload
const dropzone = document.querySelector<HTMLElement>('#receipt-dropzone')!;
const fileInput = document.querySelector<HTMLInputElement>('#bill-file-input')!;

dropzone.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', () => {
  const file = fileInput.files?.[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = e => {
      lastUploadedImageBase64 = e.target?.result as string;
      dropzone.innerHTML = `
        <p style="font-size: 1.5rem; margin-bottom: 4px;">✅</p>
        <strong>${escapeHtml(file.name)} loaded</strong>
        <p class="card-subtitle" style="margin-top: 4px;">Ready for Agent 3 AI bill analysis</p>
      `;
      const titleInput = document.querySelector<HTMLInputElement>('#bill-title-input')!;
      if (!titleInput.value) titleInput.value = file.name.replace(/\.[^.]+$/, '');
    };
    reader.readAsDataURL(file);
  }
});

// Profile Modal
const profileModal = document.querySelector<HTMLElement>('#profile-modal')!;
document.querySelector('#btn-profile')?.addEventListener('click', () => {
  const roommates = getAllRoommates();
  const me = roommates.find(r => r.identityHex === currentIdentity) || roommates[0];
  const nameInp = document.querySelector<HTMLInputElement>('#profile-name-input')!;
  const dietsInp = document.querySelector<HTMLInputElement>('#profile-diets-input')!;
  const habitsInp = document.querySelector<HTMLInputElement>('#profile-habits-input')!;
  
  nameInp.value = me.displayName;
  dietsInp.value = me.dietaryTags.join(', ');
  habitsInp.value = me.cookingHabits.join(', ');
  profileModal.hidden = false;
});

document.querySelector('#btn-cancel-profile-modal')?.addEventListener('click', () => {
  profileModal.hidden = true;
});

document.querySelector('#profile-form')?.addEventListener('submit', e => {
  e.preventDefault();
  const nameInp = document.querySelector<HTMLInputElement>('#profile-name-input')!;
  const dietsInp = document.querySelector<HTMLInputElement>('#profile-diets-input')!;
  const habitsInp = document.querySelector<HTMLInputElement>('#profile-habits-input')!;

  const displayName = nameInp.value.trim() || 'Roommate';
  const dietaryTags = dietsInp.value.split(',').map(s => s.trim().toLowerCase()).filter(Boolean) as DietaryTag[];
  const cookingHabits = habitsInp.value.split(',').map(s => s.trim()).filter(Boolean);

  const myHex = currentIdentity || '0x_demo_user';
  HouseholdConfigManager.saveProfile({
    identityHex: myHex,
    displayName,
    dietaryTags: dietaryTags.length > 0 ? dietaryTags : ['vegetarian'],
    cookingHabits: cookingHabits.length > 0 ? cookingHabits : ['Dal Tadka', 'Pasta'],
    customSplitExclusions: dietaryTags.includes('vegetarian') ? ['non_veg'] : [],
  });

  connection.reducers.setDisplayName({ displayName });
  profileModal.hidden = true;
  renderAll();
  refreshShoppingPlan();
  refreshCookingPlan();
});

// API Key Modal
const apiModal = document.querySelector<HTMLElement>('#api-modal')!;
document.querySelector('#btn-api-key')?.addEventListener('click', () => {
  const keyInp = document.querySelector<HTMLInputElement>('#gemini-key-input')!;
  keyInp.value = AIProvider.getApiKey();
  apiModal.hidden = false;
});

document.querySelector('#btn-cancel-api-modal')?.addEventListener('click', () => {
  apiModal.hidden = true;
});

document.querySelector('#btn-save-api-key')?.addEventListener('click', () => {
  const keyInp = document.querySelector<HTMLInputElement>('#gemini-key-input')!;
  AIProvider.setApiKey(keyInp.value);
  apiModal.hidden = true;
  const btn = document.querySelector<HTMLElement>('#btn-api-key')!;
  btn.textContent = `✨ ${AIProvider.hasApiKey() ? 'AI Active (Gemini)' : 'Set Gemini Key (Optional)'}`;
  refreshShoppingPlan();
  refreshCookingPlan();
});

// Add Pantry Item Modal
const addPantryModal = document.querySelector<HTMLElement>('#add-pantry-modal')!;
document.querySelector('#btn-add-pantry-modal')?.addEventListener('click', () => {
  addPantryModal.hidden = false;
});

document.querySelector('#btn-cancel-pantry-modal')?.addEventListener('click', () => {
  addPantryModal.hidden = true;
});

document.querySelector('#add-pantry-form')?.addEventListener('submit', e => {
  e.preventDefault();
  const nameInp = document.querySelector<HTMLInputElement>('#pantry-name-input')!;
  const qtyInp = document.querySelector<HTMLInputElement>('#pantry-qty-input')!;
  const unitInp = document.querySelector<HTMLInputElement>('#pantry-unit-input')!;

  const name = nameInp.value.trim();
  const quantity = parseInt(qtyInp.value, 10) || 1;
  const unit = unitInp.value.trim() || 'items';

  if (name) {
    connection.reducers.addPantryItem({ name, quantity, unit });
    nameInp.value = '';
    qtyInp.value = '1';
    addPantryModal.hidden = true;
  }
});

// Floating Chat Assistant Drawer
const chatFab = document.querySelector<HTMLElement>('#chat-fab')!;
const chatDrawer = document.querySelector<HTMLElement>('#chat-drawer')!;
const chatCloseBtn = document.querySelector<HTMLElement>('#chat-close-btn')!;

chatFab.addEventListener('click', () => chatDrawer.classList.toggle('open'));
chatCloseBtn.addEventListener('click', () => chatDrawer.classList.remove('open'));

document.querySelector('#chat-drawer-form')?.addEventListener('submit', e => {
  e.preventDefault();
  const input = document.querySelector<HTMLInputElement>('#chat-drawer-input')!;
  const body = input.value.trim();
  if (!body) return;

  connection.reducers.addChatMessage({ body, kind: 'user' });

  // Intelligent agent command router
  const pantryMatch = body.match(/(?:i )?(?:bought|brought|got|added)\s+(\d+)\s+(.+?)(?:\s+(?:of|in)\s+([a-z]+))?$/i);
  const billMatch = body.match(/(.+?)(?:\s+bill)?\s+(?:for\s+)?[₹$]\s*([\d,]+(?:\.\d{1,2})?)/i);

  if (pantryMatch) {
    const qty = parseInt(pantryMatch[1], 10);
    const item = pantryMatch[2].trim();
    const unit = pantryMatch[3] ?? 'items';
    connection.reducers.addPantryItem({ name: item, quantity: qty, unit });
    connection.reducers.addChatMessage({
      body: `🛒 Agent 1 (Shopping): Added ${qty} ${unit} of "${item}" to the household pantry!`,
      kind: 'agent',
    });
  } else if (billMatch) {
    const title = billMatch[1].trim();
    const paise = BigInt(Math.round(parseFloat(billMatch[2].replace(/,/g, '')) * 100));
    connection.reducers.recordExpense({ title, amountPaise: paise });
    connection.reducers.addChatMessage({
      body: `🧾 Agent 3 (Billing): Recorded "${title}" for ${money(paise)} and applied split rules!`,
      kind: 'agent',
    });
  } else if (/cook|recipe|hungry|dinner|lunch|breakfast/i.test(body)) {
    connection.reducers.addChatMessage({
      body: `🍳 Agent 2 (Cooking): Checking your pantry inventory & dietary configs... Check out the Cooking tab for tailored recipes!`,
      kind: 'agent',
    });
    refreshCookingPlan();
  } else {
    connection.reducers.addChatMessage({
      body: `I've noted that! Try asking: "I bought 2kg rice", "Electricity bill ₹1200", or "What can we cook tonight?"`,
      kind: 'system',
    });
  }

  input.value = '';
});
