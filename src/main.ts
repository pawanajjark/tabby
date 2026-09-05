import { DbConnection, tables } from './module_bindings';
import './style.css';

const app = document.querySelector<HTMLDivElement>('#app')!;

app.innerHTML = `
  <section class="shell">
    <header><p class="eyebrow">SHARED HOME MEMORY</p><h1>tabby<span>.</span></h1><p id="status">Connecting your home…</p></header>
    <nav><button class="tab active" data-tab="pantry">Pantry</button><button class="tab" data-tab="expenses">Expenses</button></nav>
    <section id="content" class="content"><p class="empty">Your shared home is loading.</p></section>
  </section>
  <button id="chat-toggle" class="chat-toggle" aria-label="Open Tabby chat">✦</button>
  <aside id="chat" class="chat" aria-hidden="true">
    <div class="chat-head"><div><strong>Tabby</strong><small>your flat’s shared memory</small></div><button id="chat-close">×</button></div>
    <div id="messages" class="messages"><p class="hint">Try: “I bought 10 eggs” or “Electricity bill ₹2400”</p></div>
    <form id="chat-form"><input id="chat-input" placeholder="Tell Tabby something…" autocomplete="off" /><button>Send</button></form>
  </aside>
  <section id="name-dialog" class="name-dialog" aria-modal="true" role="dialog" aria-labelledby="name-title" hidden>
    <form id="name-form" class="name-card">
      <p class="eyebrow">WELCOME HOME</p><h2 id="name-title">What should Tabby call you?</h2>
      <p>Your name lets your roommates see who added an item, paid a bill, or sent a message.</p>
      <input id="name-input" maxlength="40" placeholder="Your first name" autocomplete="name" required />
      <button>Continue</button>
    </form>
  </section>
`;

const host = import.meta.env.VITE_SPACETIMEDB_URI ?? 'https://maincloud.spacetimedb.com';
const database = import.meta.env.VITE_SPACETIMEDB_DB ?? 'tabby';
const tokenKey = `${host}/${database}/auth_token`;
const status = document.querySelector<HTMLParagraphElement>('#status')!;
const content = document.querySelector<HTMLElement>('#content')!;
const chat = document.querySelector<HTMLElement>('#chat')!;
const messages = document.querySelector<HTMLElement>('#messages')!;
const nameDialog = document.querySelector<HTMLElement>('#name-dialog')!;
const nameInput = document.querySelector<HTMLInputElement>('#name-input')!;
let selectedTab: 'pantry' | 'expenses' = 'pantry';
let currentIdentity = '';

function money(paise: bigint) { return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(paise) / 100); }
function escapeHtml(value: string) { return value.replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]!); }
function nameFor(identity: { toHexString(): string }) {
  const member = [...connection.db.member.iter()].find(row => row.identity.toHexString() === identity.toHexString());
  return member?.displayName || 'Roommate';
}
function showNamePromptIfNeeded() {
  const me = [...connection.db.member.iter()].find(member => member.identity.toHexString() === currentIdentity);
  const needsName = !me || me.displayName === 'Roommate';
  nameDialog.hidden = !needsName;
  if (needsName) nameInput.focus();
}
function render() {
  if (selectedTab === 'pantry') {
    const items = [...connection.db.pantryItem.iter()];
    content.innerHTML = items.length ? `<div class="list">${items.map(item => `<article><div><strong>${escapeHtml(item.name)}</strong><small>updated by ${escapeHtml(nameFor(item.updatedBy))}</small></div><span>${item.quantity} ${escapeHtml(item.unit)}</span></article>`).join('')}</div>` : '<p class="empty">The pantry is empty. Tell Tabby what you bought.</p>';
  } else {
    const expenses = [...connection.db.expense.iter()];
    content.innerHTML = expenses.length ? `<div class="list">${expenses.map(expense => `<article><div><strong>${escapeHtml(expense.title)}</strong><small>paid by ${escapeHtml(nameFor(expense.paidBy))}</small></div><span>${money(expense.amountPaise)}</span></article>`).join('')}</div>` : '<p class="empty">No expenses yet. Upload a bill or tell Tabby about one.</p>';
  }
  const history = [...connection.db.chatMessage.iter()];
  messages.innerHTML = history.length ? history.map(message => message.kind === 'system'
    ? `<p class="message system">${escapeHtml(message.body)}</p>`
    : `<p class="message user"><small>${escapeHtml(nameFor(message.sender))}</small>${escapeHtml(message.body)}</p>`).join('') : '<p class="hint">Try: “I bought 10 eggs” or “Electricity bill ₹2400”</p>';
  messages.scrollTop = messages.scrollHeight;
  showNamePromptIfNeeded();
}

const connection = DbConnection.builder()
  .withUri(host).withDatabaseName(database).withToken(localStorage.getItem(tokenKey) ?? undefined)
  .onConnect((ctx, identity, token) => {
    localStorage.setItem(tokenKey, token);
    currentIdentity = identity.toHexString();
    status.textContent = 'Live · shared with your home';
    ctx.subscriptionBuilder().onApplied(render).subscribe([tables.member, tables.pantryItem, tables.expense, tables.expenseSplit, tables.chatMessage]);
  })
  .onConnectError((_ctx, error) => { status.textContent = 'Could not connect to Tabby'; console.error(error); })
  .onDisconnect(() => { status.textContent = 'Offline'; })
  .build();

connection.db.member.onInsert(render); connection.db.member.onUpdate(render); connection.db.pantryItem.onInsert(render); connection.db.pantryItem.onUpdate(render); connection.db.expense.onInsert(render); connection.db.chatMessage.onInsert(render);

function parseMessage(message: string) {
  const pantry = message.match(/(?:i )?(?:bought|brought|got)\s+(\d+)\s+(.+?)(?:\s+(?:of|in)\s+([a-z]+))?$/i);
  const bill = message.match(/(.+?)(?:\s+bill)?\s+(?:for\s+)?[₹$]\s*([\d,]+(?:\.\d{1,2})?)/i);
  if (pantry) return { type: 'pantry' as const, quantity: Number(pantry[1]), name: pantry[2], unit: pantry[3] ?? 'items' };
  if (bill) return { type: 'expense' as const, title: bill[1].trim(), amountPaise: BigInt(Math.round(Number(bill[2].replaceAll(',', '')) * 100)) };
  return { type: 'unknown' as const };
}

document.querySelectorAll<HTMLButtonElement>('.tab').forEach(button => button.addEventListener('click', () => {
  selectedTab = button.dataset.tab as typeof selectedTab;
  document.querySelectorAll('.tab').forEach(tab => tab.classList.toggle('active', tab === button)); render();
}));
document.querySelector('#chat-toggle')!.addEventListener('click', () => { chat.classList.add('open'); chat.setAttribute('aria-hidden', 'false'); });
document.querySelector('#chat-close')!.addEventListener('click', () => { chat.classList.remove('open'); chat.setAttribute('aria-hidden', 'true'); });
document.querySelector<HTMLFormElement>('#name-form')!.addEventListener('submit', event => {
  event.preventDefault();
  const displayName = nameInput.value.trim();
  if (!displayName) return;
  connection.reducers.setDisplayName({ displayName });
  nameDialog.hidden = true;
});
document.querySelector<HTMLFormElement>('#chat-form')!.addEventListener('submit', event => {
  event.preventDefault(); const input = document.querySelector<HTMLInputElement>('#chat-input')!; const body = input.value.trim(); if (!body) return;
  connection.reducers.addChatMessage({ body, kind: 'user' });
  const action = parseMessage(body);
  if (action.type === 'pantry') connection.reducers.addPantryItem({ name: action.name, quantity: action.quantity, unit: action.unit });
  if (action.type === 'expense') connection.reducers.recordExpense({ title: action.title, amountPaise: action.amountPaise });
  if (action.type === 'unknown') connection.reducers.addChatMessage({ body: 'I saved your message, but I only understand pantry purchases and bills for now.', kind: 'system' });
  input.value = '';
});
