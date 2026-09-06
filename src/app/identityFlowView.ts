import {
  homePreview,
  renderCompletionScreen,
  renderIdentityScreen,
  type IdentityFeatureState,
  type IdentityRoute,
} from '../features/identity/index.ts';

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[character]!);
}

function fieldValue(value: string): string {
  return escapeHtml(value);
}

function routeFields(state: IdentityFeatureState): string {
  switch (state.route) {
    case 'welcome':
      return '';
    case 'profile':
      return `<div class="identity-fields identity-field-card">
        <label><span class="identity-label-row"><span>Name</span><small>Required</small></span><input name="displayName" autocomplete="name" value="${fieldValue(state.profile.displayName)}" placeholder="Your name" required /></label>
        <label><span class="identity-label-row"><span>Phone number</span><small>Required</small></span><input name="phone" autocomplete="tel" inputmode="tel" value="${fieldValue(state.profile.phone)}" placeholder="+91 98765 43210" required /></label>
      </div><p class="identity-trust-note"><span aria-hidden="true">◇</span>Your conversations stay private. Only items you explicitly save appear in the Home shelf.</p>`;
    case 'home-access':
      return `<section class="identity-choice-section"><p class="identity-kicker">AVAILABLE HOMES</p><div class="identity-choice-list">${state.homes.length ? state.homes.map(home => `<button type="button" data-identity-home="${home.id}" class="identity-choice${home.active ? ' is-current' : ''}"><strong>${escapeHtml(home.name)}</strong><span>${escapeHtml(`${home.label}, ${home.residenceName}`)}</span><small>${home.active ? 'Current home' : 'Select to join'}</small></button>`).join('') : !state.homesSynchronized ? '<p class="identity-empty identity-loading-homes" role="status">Loading homes…</p>' : '<p class="identity-empty">No homes are available yet. Create the first one.</p>'}</div></section><div class="identity-path-actions"><button type="button" class="primary-button" data-identity-action="create-home">Create a home</button><button type="button" class="secondary-button" data-identity-action="join-home">Browse available homes</button></div>`;
    case 'create-home': {
      const preview = homePreview(state.createHome);
      return `<div class="identity-fields identity-field-card identity-home-fields">
        <label><span class="identity-label-row"><span>Home name</span><small>Required</small></span><input name="homeName" value="${fieldValue(state.createHome.homeName)}" placeholder="Sunshine Haven" required /></label>
        <label><span class="identity-label-row"><span>Flat or address label</span><small>Optional</small></span><input name="homeLabel" value="${fieldValue(state.createHome.homeLabel)}" placeholder="Flat 402, Palm Grove Residency" /></label>
      </div><section class="identity-home-preview" aria-label="Home switcher preview"><p class="identity-kicker">HOME SWITCHER PREVIEW</p><div><span class="identity-preview-wordmark">tabby</span><span><strong data-home-preview-name>${escapeHtml(preview?.title || 'Your home')}</strong><small data-home-preview-address>${escapeHtml(preview?.location || 'Address can be added later')}</small></span><span>Home shelf</span></div></section><p class="identity-trust-note"><span aria-hidden="true">◇</span>This home will appear in the available homes list.</p>`;
    }
    case 'join-home':
      return `<section class="identity-choice-section"><p class="identity-kicker">AVAILABLE HOMES</p><div class="identity-choice-list">${state.homes.length ? state.homes.map(home => {
        const selected = state.selectedHomeId === home.id;
        const memberLabel = home.memberCount === undefined ? '' : `${home.memberCount} member${home.memberCount === 1 ? '' : 's'}`;
        return `<button type="button" data-identity-home="${home.id}" aria-pressed="${selected}" class="identity-choice identity-home-choice${selected ? ' is-selected' : ''}${home.active ? ' is-current' : ''}"><span class="identity-choice-copy"><strong>${escapeHtml(home.name)}</strong><span>${escapeHtml(`${home.label}, ${home.residenceName}`)}</span></span><small><span>${escapeHtml(memberLabel || 'Membership syncing')}</span>${home.active ? '<span>Current</span>' : ''}${selected ? '<span class="identity-selected-label">Selected</span>' : ''}</small></button>`;
      }).join('') : !state.homesSynchronized ? '<p class="identity-empty identity-loading-homes" role="status">Loading homes…</p>' : '<p class="identity-empty">No homes are available yet. Go back and create one.</p>'}</div></section><p class="identity-trust-note"><span aria-hidden="true">◇</span>Joining shares Home shelf items with you. Private conversations remain separate.</p>`;
    case 'bring-house-together':
      return `<section class="identity-setup-block"><div class="identity-section-heading"><h2>Bring in housemates</h2></div><p>Ask them to open Join a home and choose this home from the available list.</p></section>
      <section class="identity-setup-block"><div class="identity-section-heading"><h2>Set the basics</h2><span>All optional</span></div><div class="identity-fields identity-compact-fields">
        <div class="identity-field-pair"><label>Quiet hours start<input name="quietHoursStart" type="time" value="${fieldValue(state.basics.quietHoursStart)}" /></label><label>Quiet hours end<input name="quietHoursEnd" type="time" value="${fieldValue(state.basics.quietHoursEnd)}" /></label></div>
        <label>Default bill split<select name="defaultBillingSplit"><option value="equal" ${state.basics.defaultBillingSplit === 'equal' ? 'selected' : ''}>Equal unless edited</option><option value="custom" ${state.basics.defaultBillingSplit === 'custom' ? 'selected' : ''}>Custom per bill</option></select></label>
      </div></section><p class="identity-footnote">You can change home basics later from the Home shelf.</p>`;
    case 'first-task':
      return `<p class="identity-ready-note">✓ Your home is ready. This is the first success.</p><div class="identity-first-task-grid"><div class="identity-fields"><label>Add a real pantry item<input name="firstTaskLabel" placeholder="What is already in your home?" /></label><button type="button" class="secondary-button" data-identity-action="add-first-item">Add item</button></div><div class="identity-choice-list identity-starter-list">${state.firstTaskItems.map(item => `<label class="identity-choice"><input type="checkbox" data-first-item="${escapeHtml(item.id)}" ${item.selected ? 'checked' : ''} /><span>${escapeHtml(item.label)}</span></label>`).join('')}</div></div>`;
    case 'accounts':
      return `<section class="identity-choice-section"><h2>Saved accounts</h2><div class="identity-choice-list">${state.accounts.length ? state.accounts.map(account => `<button type="button" data-identity-account="${escapeHtml(account.identity)}" class="identity-choice${account.active ? ' is-current' : ''}"><strong>${escapeHtml(account.displayName)}</strong><span>${escapeHtml(account.detail)}</span></button>`).join('') : '<p class="identity-empty">No other saved accounts are available on this device.</p>'}</div></section><section class="identity-choice-section"><h2>Homes for this account</h2><div class="identity-choice-list">${state.homes.map(home => `<button type="button" data-identity-home="${home.id}" class="identity-choice${home.active ? ' is-current' : ''}"><strong>${escapeHtml(home.name)}</strong><span>${escapeHtml(`${home.label}, ${home.residenceName}`)}</span></button>`).join('')}</div></section>`;
    case 'settings':
      return `<nav class="identity-settings-links" aria-label="Settings sections">
        <button type="button" data-identity-route="profile">Profile</button>
        <button type="button" data-identity-route="home-access">Homes and accounts</button>
        <button type="button" data-identity-route="ai-connection">AI connection</button>
      </nav>`;
    case 'delete-account':
      return `<div class="identity-fields"><label>Type DELETE<input name="deletionInput" autocomplete="off" value="${fieldValue(state.deletionInput)}" /></label></div>`;
    case 'ai-connection':
      return `<div class="identity-fields"><label>API key<input name="aiKey" type="password" autocomplete="off" /></label><label>Model<input name="aiModel" value="${fieldValue(state.ai.model)}" placeholder="Model name" /></label></div>`;
  }
}

function actionButtons(state: IdentityFeatureState, completion: boolean, editingExistingHome: boolean): string {
  const screen = completion ? renderCompletionScreen() : renderIdentityScreen(state);
  return screen.actions.map(action => `<button type="button" data-identity-action="${escapeHtml(action.id)}" class="${action.tone === 'primary' ? 'primary-button' : action.tone === 'danger' ? 'danger-button' : 'secondary-button'}" ${action.disabled || state.request === 'loading' ? 'disabled' : ''}>${escapeHtml(editingExistingHome && action.id === 'save-basics' ? 'Save home basics' : action.id === 'recover-account' ? 'Reconnect saved account' : action.label)}</button>`).join('');
}

export function renderIdentityFlow(state: IdentityFeatureState, completion = false, editingExistingHome = false): string {
  const screen = completion ? renderCompletionScreen() : renderIdentityScreen(state);
  const bespokeRoutes: IdentityRoute[] = ['profile', 'home-access', 'create-home', 'join-home', 'bring-house-together', 'first-task'];
  const sections = (bespokeRoutes.includes(state.route) ? [] : screen.sections).map(section => {
    const body = section.id === 'recovery'
      ? 'Reconnect an account previously used on this device with its saved connection.'
      : section.body;
    return `<section class="identity-section" data-section="${escapeHtml(section.id)}">${section.heading ? `<h2>${escapeHtml(section.heading)}</h2>` : ''}${body ? `<p>${escapeHtml(body)}</p>` : ''}${section.rows?.length ? `<div class="identity-summary-rows">${section.rows.map(row => `<div><strong>${escapeHtml(row.title)}</strong>${row.detail ? `<span>${escapeHtml(row.detail)}</span>` : ''}${row.status ? `<small>${escapeHtml(row.status)}</small>` : ''}</div>`).join('')}</div>` : ''}</section>`;
  }).join('');
  const status = screen.status ? `<p class="identity-request identity-${screen.status.kind}" role="status">${escapeHtml(screen.status.message)}</p>` : '';
  const isOnboarding = ['welcome', 'profile', 'home-access', 'create-home', 'join-home', 'bring-house-together', 'first-task'].includes(state.route);
  const progress = screen.step ? `<div class="identity-progress" aria-label="Step ${screen.step.current} of ${screen.step.total}"><div><strong>STEP ${screen.step.current} OF ${screen.step.total}</strong><span>${state.route === 'profile' ? 'About 90 seconds total' : state.route === 'bring-house-together' ? 'Invite and basics' : 'Create or join'}</span></div><span class="identity-progress-track"><i style="width:${Math.round(screen.step.current / screen.step.total * 100)}%"></i></span></div>` : '';
  const topBar = isOnboarding && state.route !== 'welcome' ? `<header class="identity-topbar"><span class="identity-topbar-wordmark">tabby</span><span>${state.route === 'profile' ? 'Private setup' : state.route === 'first-task' ? 'Home, handled.' : 'Setting up your home'}</span></header>` : '';
  const welcomeBrand = state.route === 'welcome' ? `<div class="identity-welcome-brand"><span>tabby</span><small>Home, handled.</small></div><hr />` : '';
  const body = state.route === 'welcome' ? 'Groceries, meals, bills, notes, and house decisions stay in one place.' : screen.body;
  return `<div class="identity-shell ${isOnboarding ? 'is-onboarding' : 'is-settings'}" data-identity-route="${state.route}">${topBar}<main class="identity-page"><div class="identity-screen">
    ${welcomeBrand}${progress}<header class="identity-screen-header"><div>${screen.eyebrow && state.route !== 'welcome' ? `<p class="eyebrow">${escapeHtml(screen.eyebrow)}</p>` : ''}<h1>${escapeHtml(screen.title)}</h1>${body ? `<p>${escapeHtml(body)}</p>` : ''}</div></header>
    ${status}<form id="identity-flow-form" class="identity-flow-form">${completion ? '' : routeFields(state)}${sections}<footer class="identity-actions">${!completion && state.route !== 'welcome' ? '<button type="button" class="secondary-button" data-identity-action="back">Back</button>' : ''}${actionButtons(state, completion, editingExistingHome)}</footer></form>
  </div></main></div>`;
}

export function identityBackRoute(route: IdentityRoute, entryRoute?: IdentityRoute): IdentityRoute {
  if (entryRoute === 'settings' && (route === 'profile' || route === 'home-access')) return 'settings';
  if (route === 'profile' || route === 'home-access') return 'welcome';
  if (route === 'create-home' || route === 'join-home') return 'home-access';
  if (route === 'bring-house-together' || route === 'first-task') return 'home-access';
  if (route === 'delete-account' || route === 'ai-connection' || route === 'accounts') return 'settings';
  return 'welcome';
}
