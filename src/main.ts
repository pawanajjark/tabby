import { DbConnection, tables } from './module_bindings';
import './style.css';
import { AgentShopping, ShoppingPlan } from './services/agentShopping';
import { AgentCooking, CookingPlan } from './services/agentCooking';
import { AgentBilling, SplitResult } from './services/agentBilling';
import { HouseholdConfigManager, RoommateProfile, DietaryTag } from './services/householdConfig';
import { AIProvider } from './services/aiProvider';

const app = document.querySelector<HTMLDivElement>('#app')!;

app.innerHTML = `
  <section class="shell">
    <header>
      <div class="header-top">
        <div>
          <p class="eyebrow">SHARED HOME MEMORY · 3 AGENTS</p>
          <h1>tabby<span>.</span></h1>
          <p id="status"><span class="status-dot"></span> <span id="status-text">Connecting your home…</span></p>
        </div>
        <div class="header-actions">
          <button id="btn-openai-config" class="btn-secondary">
            ⚡ ${AIProvider.hasApiKey() ? 'OpenAI (' + AIProvider.getModelName() + ')' : 'Set OpenAI Key'}
          </button>
          <button id="btn-my-profile" class="btn-secondary">
            👤 <span id="my-name-label">My Profile</span>
          </button>
        </div>
      </div>
    </header>

    <nav>
      <button class="tab active" data-tab="shopping">Shopping <span class="agent-badge">Agent 1</span></button>
      <button class="tab" data-tab="cooking">Cooking <span class="agent-badge">Agent 2</span></button>
      <button class="tab" data-tab="billing">Billing <span class="agent-badge">Agent 3</span></button>
      <button class="tab" data-tab="roommates">Roommates & Rules</button>
    </nav>

    <!-- TAB 1: SHOPPING ASSISTANT -->
    <div id="pane-shopping" class="content-pane active">
      <section class="card-section">
        <div class="card-header">
          <div>
            <h2>Pantry Inventory</h2>
            <p>Live inventory synchronized across all roommates</p>
          </div>
          <button id="btn-open-add-pantry" class="btn-primary">+ Add Item</button>
        </div>
        <div id="pantry-list" class="list">
          <p class="empty">Loading pantry items…</p>
        </div>
      </section>

      <section class="card-section">
        <div class="card-header">
          <div>
            <h2>Agent 1: Smart Restock Plan</h2>
            <p id="shopping-plan-subtitle">Analyzes pantry stock, roommate diets & cooking habits</p>
          </div>
          <button id="btn-run-shopping-agent" class="btn-coral">⚡ Generate Plan</button>
        </div>
        <div id="shopping-plan-summary" style="color: var(--text-secondary); font-size: 0.88rem; margin-bottom: 14px;"></div>
        <div id="shopping-items-list" class="list">
          <p class="empty">Click "Generate Plan" to inspect pantry and calculate restock needs.</p>
        </div>
      </section>
    </div>

    <!-- TAB 2: COOKING ASSISTANT -->
    <div id="pane-cooking" class="content-pane">
      <section class="card-section">
        <div class="card-header">
          <div>
            <h2>Agent 2: Zero-Waste Cooking Assistant</h2>
            <p id="cooking-headline">Suggests tailored recipes using available pantry stock and dietary rules</p>
          </div>
          <button id="btn-run-cooking-agent" class="btn-coral">✨ What Can We Cook?</button>
        </div>
        <div id="recipes-list">
          <p class="empty">Click "What Can We Cook?" to generate recipes customized to your pantry!</p>
        </div>
      </section>
    </div>

    <!-- TAB 3: BILLING ASSISTANT -->
    <div id="pane-billing" class="content-pane">
      <section class="card-section">
        <div class="card-header">
          <div>
            <h2>Agent 3: Receipt Ingestion & Split</h2>
            <p>Upload bill photo / PDF or paste receipt text with dietary exemption rules</p>
          </div>
        </div>

        <div id="bill-dropzone" class="dropzone">
          <strong style="font-size: 1.1rem; display: block; margin-bottom: 4px;">📷 Drag & Drop Receipt Photo / PDF</strong>
          <span style="color: var(--text-muted); font-size: 0.82rem;">Or click here to browse files for LangChain OpenAI vision analysis</span>
          <input type="file" id="bill-file-input" accept="image/*,application/pdf" style="display: none;" />
        </div>

        <div style="display: flex; gap: 8px; margin-bottom: 14px; flex-wrap: wrap;">
          <button id="btn-sample-dinner" class="btn-secondary">🍗 Sample Dinner Bill (Meat + Veg + Drinks)</button>
          <button id="btn-sample-grocery" class="btn-secondary">🛒 Sample Grocery Bill</button>
        </div>

        <form id="bill-parse-form">
          <div style="margin-bottom: 12px;">
            <label style="font-size: 0.8rem; font-weight: 700; color: var(--text-secondary); display: block; margin-bottom: 4px;">Bill Title</label>
            <input id="bill-title-input" placeholder="e.g. Friday Night Dinner" required />
          </div>
          <div style="margin-bottom: 14px;">
            <label style="font-size: 0.8rem; font-weight: 700; color: var(--text-secondary); display: block; margin-bottom: 4px;">Receipt Items</label>
            <textarea id="bill-text-input" rows="5" placeholder="Chicken Butter Masala - 380&#10;Paneer Tikka - 260&#10;Garlic Naan (3) - 150&#10;Craft Beer - 300&#10;Taxes & Service - 110"></textarea>
          </div>
          <button type="submit" class="btn-primary" style="width: 100%;">
            ⚖️ Parse & Calculate Rule-Based Split
          </button>
        </form>

        <div id="bill-split-result" style="display: none;"></div>
      </section>

      <section class="card-section">
        <div class="card-header">
          <div>
            <h2>Household Expense Ledger</h2>
            <p>Live transaction records in SpacetimeDB</p>
          </div>
        </div>
        <div id="expense-ledger" class="list">
          <p class="empty">No expenses recorded yet.</p>
        </div>
      </section>
    </div>

    <!-- TAB 4: ROOMMATES & RULES -->
    <div id="pane-roommates" class="content-pane">
      <section class="card-section">
        <div class="card-header">
          <div>
            <h2>Roommate Profiles</h2>
            <p>Dietary constraints and cooking habits</p>
          </div>
        </div>
        <div id="roommates-display-list" class="list"></div>
      </section>

      <section class="card-section">
        <div class="card-header">
          <div>
            <h2>Split Configuration Rules</h2>
            <p>Rules enforced by Agent 3 when calculating item shares</p>
          </div>
        </div>
        <div id="rules-display-list" class="list"></div>
      </section>
    </div>
  </section>

  <!-- Floating Chat Toggle & Drawer -->
  <button id="chat-toggle" class="chat-toggle" aria-label="Open Tabby Chat">✦</button>
  <aside id="chat" class="chat" aria-hidden="true">
    <div class="chat-head">
      <div>
        <strong>Tabby</strong>
        <small>your flat’s shared memory & 3 agents</small>
      </div>
      <button id="chat-close">×</button>
    </div>
    <div id="messages" class="messages">
      <p class="hint">Try: “I bought 10 eggs”, “Electricity bill ₹2400”, or “What can we cook?”</p>
    </div>
    <form id="chat-form">
      <input id="chat-input" placeholder="Tell Tabby something…" autocomplete="off" />
      <button type="submit">Send</button>
    </form>
  </aside>

  <!-- MODALS -->
  <!-- OpenAI Key Modal -->
  <div id="openai-modal" class="modal-backdrop" hidden>
    <div class="modal-card">
      <p class="eyebrow">LANGCHAIN OPENAI CONFIGURATION</p>
      <h3>OpenAI Agent Settings</h3>
      <p>Configure your OpenAI API Key and Model for LangChain agent reasoning and multimodal receipt vision.</p>
      <div style="display: grid; gap: 10px;">
        <div>
          <label style="font-size: 0.78rem; font-weight: 700; color: var(--text-secondary);">OpenAI API Key</label>
          <input id="openai-key-input" type="password" placeholder="sk-..." />
        </div>
        <div>
          <label style="font-size: 0.78rem; font-weight: 700; color: var(--text-secondary);">Model Name</label>
          <input id="openai-model-input" placeholder="gpt-4o-mini or gpt-4o" value="gpt-4o-mini" />
        </div>
      </div>
      <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 8px;">
        <button id="btn-close-openai-modal" class="btn-secondary">Cancel</button>
        <button id="btn-save-openai-config" class="btn-primary">Save Settings</button>
      </div>
    </div>
  </div>

  <!-- Profile Edit Modal -->
  <div id="profile-dialog" class="modal-backdrop" hidden>
    <form id="profile-form" class="modal-card">
      <p class="eyebrow">ROOMMATE PROFILE</p>
      <h3>Personalize Tabby</h3>
      <p>Your dietary preferences and dishes guide the 3 agents.</p>
      <div>
        <label style="font-size: 0.78rem; font-weight: 700; color: var(--text-secondary); display: block; margin-bottom: 4px;">Display Name</label>
        <input id="profile-name-input" required />
      </div>
      <div>
        <label style="font-size: 0.78rem; font-weight: 700; color: var(--text-secondary); display: block; margin-bottom: 4px;">Dietary Restrictions</label>
        <input id="profile-diet-input" placeholder="vegetarian, vegan, lactose_intolerant, no_alcohol" />
      </div>
      <div>
        <label style="font-size: 0.78rem; font-weight: 700; color: var(--text-secondary); display: block; margin-bottom: 4px;">Frequent Dishes / Habits</label>
        <input id="profile-habits-input" placeholder="Dal Tadka, Pasta, Fried Rice" />
      </div>
      <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 8px;">
        <button type="button" id="btn-close-profile-modal" class="btn-secondary">Cancel</button>
        <button type="submit" class="btn-primary">Save Profile</button>
      </div>
    </form>
  </div>

  <!-- Add Pantry Modal -->
  <div id="pantry-dialog" class="modal-backdrop" hidden>
    <form id="pantry-form" class="modal-card">
      <p class="eyebrow">PANTRY RESTOCK</p>
      <h3>Add Pantry Item</h3>
      <div>
        <label style="font-size: 0.78rem; font-weight: 700; color: var(--text-secondary); display: block; margin-bottom: 4px;">Item Name</label>
        <input id="pantry-item-name" placeholder="e.g. Eggs, Rice, Milk, Pasta" required />
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
        <div>
          <label style="font-size: 0.78rem; font-weight: 700; color: var(--text-secondary); display: block; margin-bottom: 4px;">Quantity</label>
          <input type="number" id="pantry-item-qty" value="1" min="1" required />
        </div>
        <div>
          <label style="font-size: 0.78rem; font-weight: 700; color: var(--text-secondary); display: block; margin-bottom: 4px;">Unit</label>
          <input id="pantry-item-unit" value="items" required />
        </div>
      </div>
      <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 8px;">
        <button type="button" id="btn-close-pantry-modal" class="btn-secondary">Cancel</button>
        <button type="submit" class="btn-primary">Add Item</button>
      </div>
    </form>
  </div>
`;

// ==========================================
// SpacetimeDB & Application State
// ==========================================
const host = import.meta.env.VITE_SPACETIMEDB_URI ?? 'https://maincloud.spacetimedb.com';
const database = import.meta.env.VITE_SPACETIMEDB_DB ?? 'tabby';
const tokenKey = `${host}/${database}/auth_token`;

let currentIdentity = '';
let currentShoppingPlan: ShoppingPlan | null = null;
let currentCookingPlan: CookingPlan | null = null;
let currentSplitResult: SplitResult | null = null;
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
    statusText.textContent = 'Live · shared with your home';
    document.querySelector('.status-dot')?.classList.remove('offline');

    ctx.subscriptionBuilder()
      .onApplied(() => {
        renderAll();
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
    document.querySelector('.status-dot')?.classList.add('offline');
    console.warn('SpacetimeDB connection error:', error);
    renderAll();
  })
  .onDisconnect(() => {
    const statusText = document.querySelector<HTMLElement>('#status-text')!;
    statusText.textContent = 'Offline';
    document.querySelector('.status-dot')?.classList.add('offline');
  })
  .build();

connection.db.member.onInsert(renderAll);
connection.db.member.onUpdate(renderAll);
connection.db.pantryItem.onInsert(renderAll);
connection.db.pantryItem.onUpdate(renderAll);
connection.db.pantryItem.onDelete(renderAll);
connection.db.expense.onInsert(renderAll);
connection.db.chatMessage.onInsert(renderChat);

// ==========================================
// Rendering Helpers
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

  const myHex = currentIdentity || '0x_user_you';
  return [
    HouseholdConfigManager.getProfile(myHex, 'You'),
    HouseholdConfigManager.getProfile('0x_alex_veg', 'Alex (Vegetarian)'),
    HouseholdConfigManager.getProfile('0x_bob_omni', 'Bob (Omnivore)'),
  ];
}

function renderAll() {
  renderPantry();
  renderExpenses();
  renderRoommatesAndRules();
  renderChat();
  updateProfileLabel();
}

function updateProfileLabel() {
  const roommates = getAllRoommates();
  const me = roommates.find(r => r.identityHex === currentIdentity) || roommates[0];
  const label = document.querySelector<HTMLElement>('#my-name-label');
  if (label && me) {
    label.textContent = me.displayName;
  }
}

function renderPantry() {
  const container = document.querySelector<HTMLElement>('#pantry-list')!;
  const items = [...connection.db.pantryItem.iter()];

  if (items.length === 0) {
    container.innerHTML = `<p class="empty">The pantry is empty. Tell Tabby what you bought or click "+ Add Item".</p>`;
    return;
  }

  container.innerHTML = items.map(item => `
    <article>
      <div>
        <strong>${escapeHtml(item.name)}</strong>
        <small>${item.quantity} ${escapeHtml(item.unit)} in stock</small>
      </div>
      <div style="display: flex; align-items: center; gap: 6px;">
        <button class="btn-icon btn-pantry-dec" data-name="${escapeHtml(item.name)}" title="Decrease">-</button>
        <span style="font-family: var(--font-mono); min-width: 40px; text-align: center;">${item.quantity}</span>
        <button class="btn-icon btn-pantry-inc" data-name="${escapeHtml(item.name)}" data-unit="${escapeHtml(item.unit)}" title="Add">+</button>
      </div>
    </article>
  `).join('');

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
  const container = document.querySelector<HTMLElement>('#expense-ledger')!;
  const expenses = [...connection.db.expense.iter()].reverse();

  if (expenses.length === 0) {
    container.innerHTML = `<p class="empty">No expenses yet. Upload a bill or calculate a split with Agent 3.</p>`;
    return;
  }

  const members = [...connection.db.member.iter()];
  const getMemberName = (ident: { toHexString(): string }) => {
    return members.find(m => m.identity.toHexString() === ident.toHexString())?.displayName || 'Roommate';
  };

  container.innerHTML = expenses.map(expense => `
    <article>
      <div>
        <strong>${escapeHtml(expense.title)}</strong>
        <small>paid by ${escapeHtml(getMemberName(expense.paidBy))}</small>
      </div>
      <span style="font-family: var(--font-mono); font-size: 1.1rem; color: var(--accent-green);">${money(expense.amountPaise)}</span>
    </article>
  `).join('');
}

function renderRoommatesAndRules() {
  const roommates = getAllRoommates();
  const list = document.querySelector<HTMLElement>('#roommates-display-list')!;

  list.innerHTML = roommates.map(r => `
    <article style="align-items: flex-start; flex-direction: column; gap: 6px;">
      <div style="display: flex; justify-content: space-between; width: 100%; align-items: center;">
        <strong>👤 ${escapeHtml(r.displayName)} ${r.identityHex === currentIdentity ? '(You)' : ''}</strong>
        <div>
          ${r.dietaryTags.map(tag => `<span class="tag-pill tag-${tag.replace(/_/g, '-')}">${escapeHtml(tag)}</span>`).join(' ')}
        </div>
      </div>
      <small style="color: var(--text-secondary);">
        🍳 <strong>Habits:</strong> ${escapeHtml(r.cookingHabits.join(', ') || 'General cooking')}
      </small>
    </article>
  `).join('');

  const rulesList = document.querySelector<HTMLElement>('#rules-display-list')!;
  const rules = HouseholdConfigManager.getRules();

  rulesList.innerHTML = rules.map(rule => `
    <article>
      <div>
        <strong>${escapeHtml(rule.name)}</strong>
        <small>${escapeHtml(rule.description)}</small>
      </div>
      <label style="cursor: pointer; display: flex; align-items: center; gap: 6px;">
        <input type="checkbox" class="rule-checkbox" data-rule-id="${rule.id}" ${rule.enabled ? 'checked' : ''} style="width: auto;" />
        <span style="font-size: 0.8rem; font-weight: 600;">${rule.enabled ? 'Active' : 'Disabled'}</span>
      </label>
    </article>
  `).join('');

  rulesList.querySelectorAll<HTMLInputElement>('.rule-checkbox').forEach(input => {
    input.addEventListener('change', () => {
      const ruleId = input.getAttribute('data-rule-id')!;
      HouseholdConfigManager.toggleRule(ruleId);
      renderRoommatesAndRules();
    });
  });
}

function renderChat() {
  const container = document.querySelector<HTMLElement>('#messages')!;
  const history = [...connection.db.chatMessage.iter()];

  if (history.length > 0) {
    const members = [...connection.db.member.iter()];
    const getMemberName = (ident: { toHexString(): string }) => {
      return members.find(m => m.identity.toHexString() === ident.toHexString())?.displayName || 'Roommate';
    };

    container.innerHTML = history.map(msg => {
      if (msg.kind === 'system' || msg.kind === 'agent') {
        return `<p class="message system">🤖 ${escapeHtml(msg.body)}</p>`;
      }
      const isMe = msg.sender.toHexString() === currentIdentity;
      return `<p class="message ${isMe ? 'user' : 'system'}"><small>${escapeHtml(getMemberName(msg.sender))}</small>${escapeHtml(msg.body)}</p>`;
    }).join('');
    container.scrollTop = container.scrollHeight;
  }
}

// ==========================================
// Agent 1: Shopping Assistant
// ==========================================
async function refreshShoppingPlan() {
  const container = document.querySelector<HTMLElement>('#shopping-items-list')!;
  const summaryEl = document.querySelector<HTMLElement>('#shopping-plan-summary')!;

  container.innerHTML = `<p class="empty">⚡ Agent 1 is evaluating pantry inventory and roommate cooking habits…</p>`;

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
    <article>
      <div style="flex: 1;">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 3px;">
          <strong>${escapeHtml(item.itemName)}</strong>
          <span class="tag-pill tag-utility">${escapeHtml(item.category)}</span>
          <span class="agent-badge">${item.urgency}</span>
        </div>
        <small style="color: var(--text-secondary); margin-bottom: 2px;">${escapeHtml(item.reason)}</small>
        <small style="color: var(--text-muted); font-size: 0.72rem;">For dishes: ${escapeHtml(item.matchedMeals.join(', '))}</small>
      </div>
      <button class="btn-secondary btn-add-plan-item" data-name="${escapeHtml(item.itemName)}" data-qty="${item.suggestedQuantity}" data-unit="${escapeHtml(item.unit)}">
        + ${item.suggestedQuantity} ${escapeHtml(item.unit)}
      </button>
    </article>
  `).join('');

  container.querySelectorAll('.btn-add-plan-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const name = btn.getAttribute('data-name')!;
      const quantity = parseInt(btn.getAttribute('data-qty') || '1', 10);
      const unit = btn.getAttribute('data-unit') || 'items';
      connection.reducers.addPantryItem({ name, quantity, unit });
      btn.textContent = '✓ Added';
      (btn as HTMLButtonElement).disabled = true;
    });
  });
}

// ==========================================
// Agent 2: Cooking Assistant
// ==========================================
async function refreshCookingPlan() {
  const container = document.querySelector<HTMLElement>('#recipes-list')!;
  const headlineEl = document.querySelector<HTMLElement>('#cooking-headline')!;

  container.innerHTML = `<p class="empty">🍳 Agent 2 is crafting zero-waste recipes tailored to your pantry…</p>`;

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
    <div class="recipe-box">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; margin-bottom: 8px;">
        <div>
          <h3>${escapeHtml(recipe.title)}</h3>
          <p>${escapeHtml(recipe.description)}</p>
        </div>
        <button class="btn-primary btn-cook-recipe" data-recipe-id="${recipe.id}">
          👨‍🍳 Cook This Meal
        </button>
      </div>

      <div class="recipe-meta">
        <span>⏱️ ${recipe.prepTimeMinutes + recipe.cookTimeMinutes} mins total</span>
        <span>🍽️ ${recipe.servings} servings</span>
        <span>🔥 ${recipe.difficulty}</span>
        <span>👥 Safe for: ${recipe.compatibleRoommates.map(escapeHtml).join(', ')}</span>
      </div>

      <div class="chips-container">
        ${recipe.ingredients.map(ing => `
          <span class="chip ${ing.inPantry ? 'have' : 'missing'}">
            ${ing.inPantry ? '✓' : '✗'} ${ing.quantity} ${escapeHtml(ing.unit)} ${escapeHtml(ing.name)}
          </span>
        `).join('')}
      </div>

      <ol style="margin: 12px 0; padding-left: 20px; font-size: 0.86rem; color: var(--text-main); line-height: 1.5;">
        ${recipe.instructions.map(step => `<li style="margin-bottom: 4px;">${escapeHtml(step)}</li>`).join('')}
      </ol>

      <div style="font-size: 0.8rem; color: var(--accent-amber); background: #fffbeb; padding: 8px 12px; border-radius: 8px; border: 1px solid #fef3c7;">
        💡 <strong>Chef Tip:</strong> ${escapeHtml(recipe.tips)}
      </div>
    </div>
  `).join('');

  container.querySelectorAll('.btn-cook-recipe').forEach(btn => {
    btn.addEventListener('click', () => {
      const recipeId = btn.getAttribute('data-recipe-id')!;
      const recipe = currentCookingPlan?.recipes.find(r => r.id === recipeId);
      if (recipe) {
        recipe.ingredients.forEach(ing => {
          if (ing.inPantry) {
            connection.reducers.addPantryItem({
              name: ing.name,
              quantity: -Math.max(1, Math.min(ing.quantity, 1)),
              unit: ing.unit,
            });
          }
        });
        btn.textContent = '🍽️ Meal Cooked & Stock Updated';
        (btn as HTMLButtonElement).disabled = true;
      }
    });
  });
}

// ==========================================
// Agent 3: Smart Bill Splitting
// ==========================================
async function handleSplitBill(e: Event) {
  e.preventDefault();
  const titleInput = document.querySelector<HTMLInputElement>('#bill-title-input')!;
  const textInput = document.querySelector<HTMLTextAreaElement>('#bill-text-input')!;
  const resultBox = document.querySelector<HTMLElement>('#bill-split-result')!;

  const title = titleInput.value.trim() || 'Shared Bill';
  const text = textInput.value.trim();

  resultBox.style.display = 'block';
  resultBox.innerHTML = `<p class="empty">⚖️ Agent 3 is categorizing receipt lines and calculating roommate split exemptions…</p>`;

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
  const resultBox = document.querySelector<HTMLElement>('#bill-split-result')!;

  resultBox.innerHTML = `
    <div class="split-breakdown-card">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <div>
          <h3 style="font-family: var(--font-serif); font-size: 1.25rem; margin: 0;">📊 ${escapeHtml(res.billTitle)}</h3>
          <small style="color: var(--text-muted);">Total: ${money(res.totalAmountPaise)} (${res.lineItems.length} items analyzed)</small>
        </div>
        <button id="btn-save-split-db" class="btn-coral">💾 Record to SpacetimeDB</button>
      </div>

      <div style="background: white; border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 10px 14px; margin-bottom: 14px;">
        <strong style="font-size: 0.78rem; text-transform: uppercase; color: var(--text-eyebrow); display: block; margin-bottom: 6px;">
          Item Classification & Exemption Status
        </strong>
        ${res.lineItems.map(item => `
          <div class="split-line-item">
            <div>
              <strong>${escapeHtml(item.name)}</strong>
              ${item.excludedRoommates.length > 0 ? `<span class="exempt-label">🌱 ${item.excludedRoommates.length} roommate(s) exempt (diet rule)</span>` : ''}
            </div>
            <span class="tag-pill tag-${item.category.replace(/_/g, '-')}">${item.category}</span>
            <span style="font-family: var(--font-mono); font-weight: 600;">${money(item.pricePaise)}</span>
            <small style="color: var(--text-muted);">${item.assignedRoommates.length}-way</small>
          </div>
        `).join('')}
      </div>

      <strong style="font-size: 0.78rem; text-transform: uppercase; color: var(--text-eyebrow); display: block; margin-bottom: 6px;">
        Roommate Owed Balances
      </strong>
      <div style="background: white; border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 10px 14px;">
        ${res.roommateShares.map(share => `
          <div class="split-share-row">
            <div>
              <strong>${escapeHtml(share.displayName)}</strong>
              ${share.isExemptFromItems.length > 0
                ? `<span class="exempt-label">Exempt: ${escapeHtml(share.isExemptFromItems.join(', '))}</span>`
                : '<small style="color: var(--text-muted);">Full shared split</small>'
              }
            </div>
            <span style="font-family: var(--font-mono); font-size: 1.1rem; font-weight: 700; color: var(--text-main);">
              ${money(share.amountPaise)}
            </span>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  document.querySelector('#btn-save-split-db')?.addEventListener('click', () => {
    if (!currentSplitResult) return;
    connection.reducers.recordExpense({
      title: currentSplitResult.billTitle,
      amountPaise: currentSplitResult.totalAmountPaise,
    });
    const saveBtn = document.querySelector<HTMLButtonElement>('#btn-save-split-db')!;
    saveBtn.textContent = '✓ Recorded in SpacetimeDB!';
    saveBtn.disabled = true;
  });
}

// ==========================================
// User Interactions & Tab Navigation
// ==========================================
document.querySelectorAll<HTMLButtonElement>('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.content-pane').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    const tabName = btn.getAttribute('data-tab')!;
    document.querySelector(`#pane-${tabName}`)?.classList.add('active');
  });
});

document.querySelector('#btn-run-shopping-agent')?.addEventListener('click', refreshShoppingPlan);
document.querySelector('#btn-run-cooking-agent')?.addEventListener('click', refreshCookingPlan);
document.querySelector('#bill-parse-form')?.addEventListener('submit', handleSplitBill);

// Receipt Dropzone
const dropzone = document.querySelector<HTMLElement>('#bill-dropzone')!;
const fileInput = document.querySelector<HTMLInputElement>('#bill-file-input')!;

dropzone.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', () => {
  const file = fileInput.files?.[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = e => {
      lastUploadedImageBase64 = e.target?.result as string;
      dropzone.innerHTML = `
        <strong style="font-size: 1.1rem; display: block; color: var(--accent-green);">✅ ${escapeHtml(file.name)} Loaded</strong>
        <span style="color: var(--text-muted); font-size: 0.82rem;">Ready for LangChain OpenAI vision parsing</span>
      `;
      const titleInput = document.querySelector<HTMLInputElement>('#bill-title-input')!;
      if (!titleInput.value) titleInput.value = file.name.replace(/\.[^.]+$/, '');
    };
    reader.readAsDataURL(file);
  }
});

// Sample Bills
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

// Modals
// OpenAI Config Modal
const openaiModal = document.querySelector<HTMLElement>('#openai-modal')!;
document.querySelector('#btn-openai-config')?.addEventListener('click', () => {
  const keyInp = document.querySelector<HTMLInputElement>('#openai-key-input')!;
  const modelInp = document.querySelector<HTMLInputElement>('#openai-model-input')!;
  keyInp.value = AIProvider.getApiKey();
  modelInp.value = AIProvider.getModelName();
  openaiModal.hidden = false;
});

document.querySelector('#btn-close-openai-modal')?.addEventListener('click', () => {
  openaiModal.hidden = true;
});

document.querySelector('#btn-save-openai-config')?.addEventListener('click', () => {
  const keyInp = document.querySelector<HTMLInputElement>('#openai-key-input')!;
  const modelInp = document.querySelector<HTMLInputElement>('#openai-model-input')!;
  AIProvider.setConfig(keyInp.value, modelInp.value);
  openaiModal.hidden = true;
  const btn = document.querySelector<HTMLElement>('#btn-openai-config')!;
  btn.textContent = `⚡ ${AIProvider.hasApiKey() ? 'OpenAI (' + AIProvider.getModelName() + ')' : 'Set OpenAI Key'}`;
  refreshShoppingPlan();
  refreshCookingPlan();
});

// Profile Modal
const profileDialog = document.querySelector<HTMLElement>('#profile-dialog')!;
document.querySelector('#btn-my-profile')?.addEventListener('click', () => {
  const roommates = getAllRoommates();
  const me = roommates.find(r => r.identityHex === currentIdentity) || roommates[0];
  const nameInp = document.querySelector<HTMLInputElement>('#profile-name-input')!;
  const dietInp = document.querySelector<HTMLInputElement>('#profile-diet-input')!;
  const habitsInp = document.querySelector<HTMLInputElement>('#profile-habits-input')!;

  nameInp.value = me.displayName;
  dietInp.value = me.dietaryTags.join(', ');
  habitsInp.value = me.cookingHabits.join(', ');
  profileDialog.hidden = false;
});

document.querySelector('#btn-close-profile-modal')?.addEventListener('click', () => {
  profileDialog.hidden = true;
});

document.querySelector('#profile-form')?.addEventListener('submit', e => {
  e.preventDefault();
  const nameInp = document.querySelector<HTMLInputElement>('#profile-name-input')!;
  const dietInp = document.querySelector<HTMLInputElement>('#profile-diet-input')!;
  const habitsInp = document.querySelector<HTMLInputElement>('#profile-habits-input')!;

  const displayName = nameInp.value.trim() || 'Roommate';
  const dietaryTags = dietInp.value.split(',').map(s => s.trim().toLowerCase()).filter(Boolean) as DietaryTag[];
  const cookingHabits = habitsInp.value.split(',').map(s => s.trim()).filter(Boolean);

  const myHex = currentIdentity || '0x_user_you';
  HouseholdConfigManager.saveProfile({
    identityHex: myHex,
    displayName,
    dietaryTags: dietaryTags.length > 0 ? dietaryTags : ['vegetarian'],
    cookingHabits: cookingHabits.length > 0 ? cookingHabits : ['Dal Tadka', 'Pasta'],
    customSplitExclusions: dietaryTags.includes('vegetarian') ? ['non_veg'] : [],
  });

  connection.reducers.setDisplayName({ displayName });
  profileDialog.hidden = true;
  renderAll();
  refreshShoppingPlan();
  refreshCookingPlan();
});

// Add Pantry Modal
const pantryDialog = document.querySelector<HTMLElement>('#pantry-dialog')!;
document.querySelector('#btn-open-add-pantry')?.addEventListener('click', () => {
  pantryDialog.hidden = false;
});

document.querySelector('#btn-close-pantry-modal')?.addEventListener('click', () => {
  pantryDialog.hidden = true;
});

document.querySelector('#pantry-form')?.addEventListener('submit', e => {
  e.preventDefault();
  const nameInp = document.querySelector<HTMLInputElement>('#pantry-item-name')!;
  const qtyInp = document.querySelector<HTMLInputElement>('#pantry-item-qty')!;
  const unitInp = document.querySelector<HTMLInputElement>('#pantry-item-unit')!;

  const name = nameInp.value.trim();
  const quantity = parseInt(qtyInp.value, 10) || 1;
  const unit = unitInp.value.trim() || 'items';

  if (name) {
    connection.reducers.addPantryItem({ name, quantity, unit });
    nameInp.value = '';
    qtyInp.value = '1';
    pantryDialog.hidden = true;
  }
});

// Chat Drawer
const chat = document.querySelector<HTMLElement>('#chat')!;
const chatToggle = document.querySelector<HTMLElement>('#chat-toggle')!;
const chatClose = document.querySelector<HTMLElement>('#chat-close')!;

chatToggle.addEventListener('click', () => {
  chat.classList.toggle('open');
  chat.setAttribute('aria-hidden', (!chat.classList.contains('open')).toString());
});

chatClose.addEventListener('click', () => {
  chat.classList.remove('open');
  chat.setAttribute('aria-hidden', 'true');
});

document.querySelector('#chat-form')?.addEventListener('submit', e => {
  e.preventDefault();
  const input = document.querySelector<HTMLInputElement>('#chat-input')!;
  const body = input.value.trim();
  if (!body) return;

  connection.reducers.addChatMessage({ body, kind: 'user' });

  const pantryMatch = body.match(/(?:i )?(?:bought|brought|got|added)\s+(\d+)\s+(.+?)(?:\s+(?:of|in)\s+([a-z]+))?$/i);
  const billMatch = body.match(/(.+?)(?:\s+bill)?\s+(?:for\s+)?[₹$]\s*([\d,]+(?:\.\d{1,2})?)/i);

  if (pantryMatch) {
    const qty = parseInt(pantryMatch[1], 10);
    const item = pantryMatch[2].trim();
    const unit = pantryMatch[3] ?? 'items';
    connection.reducers.addPantryItem({ name: item, quantity: qty, unit });
    connection.reducers.addChatMessage({
      body: `🛒 Agent 1 (Shopping): Added ${qty} ${unit} of "${item}" to pantry inventory!`,
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
      body: `🍳 Agent 2 (Cooking): Checking pantry inventory & dietary configs... Switched recipes updated!`,
      kind: 'agent',
    });
    refreshCookingPlan();
  } else {
    connection.reducers.addChatMessage({
      body: `Noted! Try: “I bought 2kg rice”, “Electricity bill ₹1200”, or “What can we cook?”`,
      kind: 'system',
    });
  }

  input.value = '';
});
