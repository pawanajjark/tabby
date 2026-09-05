import {
  renderCompletionScreen,
  renderIdentityScreen,
  type IdentityFeatureState,
  type IdentityRoute,
} from '../features/identity';

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
      return `<div class="identity-fields">
        <label>Name<input name="displayName" autocomplete="name" value="${fieldValue(state.profile.displayName)}" required /></label>
        <label>Phone<input name="phone" autocomplete="tel" value="${fieldValue(state.profile.phone)}" /></label>
        <label>Email<input name="email" type="email" autocomplete="email" value="${fieldValue(state.profile.email)}" /></label>
        <label>Dietary preferences<input name="dietaryTags" value="${fieldValue(state.profile.dietaryTags.join(', '))}" placeholder="Comma-separated" /></label>
        <label>Meals you cook often<input name="cookingHabits" value="${fieldValue(state.profile.cookingHabits.join(', '))}" placeholder="Comma-separated" /></label>
      </div>`;
    case 'home-access':
      return `<div class="identity-choice-list">${state.homes.length ? state.homes.map(home => `<button type="button" data-identity-home="${home.id}" class="identity-choice${home.active ? ' is-current' : ''}"><strong>${escapeHtml(home.name)}</strong><span>${escapeHtml(`${home.label}, ${home.residenceName}`)}</span></button>`).join('') : '<p class="identity-empty">No synchronized homes are linked to this account yet.</p>'}</div>`;
    case 'create-home':
      return `<div class="identity-fields identity-home-fields">
        <label>Residence name<input name="residenceName" value="${fieldValue(state.createHome.residenceName)}" required /></label>
        <label>Area or building<input name="address" value="${fieldValue(state.createHome.address)}" required /></label>
        <label>Home name<input name="homeName" value="${fieldValue(state.createHome.homeName)}" required /></label>
        <label>Flat or address label<input name="homeLabel" value="${fieldValue(state.createHome.homeLabel)}" required /></label>
        <label>Your name in this home<input name="homeDisplayName" value="${fieldValue(state.createHome.displayName)}" required /></label>
      </div>`;
    case 'join-home': {
      const invitation = state.invitation;
      return `<div class="identity-fields">
        <label>Invitation<input name="invitation" inputmode="text" maxlength="6" autocomplete="off" value="${fieldValue(invitation.code)}" placeholder="ABC123" aria-describedby="invitation-help" /></label>
        <p id="invitation-help">Enter the six characters shared by a member of the home.</p>
        <button type="button" class="secondary-button" data-identity-action="lookup-invitation" ${invitation.kind === 'loading' ? 'disabled' : ''}>${invitation.kind === 'loading' ? 'Looking up home…' : 'Preview home'}</button>
        <label>Your name in this home<input name="joinDisplayName" value="${fieldValue(state.profile.displayName)}" required /></label>
      </div>`;
    }
    case 'bring-house-together':
      return `<div class="identity-fields">
        <label>Invitation expires<input name="inviteExpiry" type="date" /></label>
        <p class="identity-field-note">Tabby creates a private link for you to copy and share yourself.</p>
        <div class="identity-field-pair"><label>Quiet hours start<input name="quietHoursStart" type="time" value="${fieldValue(state.basics.quietHoursStart)}" /></label><label>Quiet hours end<input name="quietHoursEnd" type="time" value="${fieldValue(state.basics.quietHoursEnd)}" /></label></div>
        <label>Default bill split<select name="defaultBillingSplit"><option value="equal" ${state.basics.defaultBillingSplit === 'equal' ? 'selected' : ''}>Equal</option><option value="custom" ${state.basics.defaultBillingSplit === 'custom' ? 'selected' : ''}>Custom per bill</option></select></label>
        <label class="identity-checkbox"><input name="invitesEnabled" type="checkbox" ${state.basics.invitesEnabled ? 'checked' : ''} /> Allow members to create invitations</label>
      </div>`;
    case 'first-task':
      return `<div class="identity-fields"><label>Add a real pantry item<input name="firstTaskLabel" placeholder="What is already in your home?" /></label><button type="button" class="secondary-button" data-identity-action="add-first-item">Add item</button></div><div class="identity-choice-list">${state.firstTaskItems.map(item => `<label class="identity-choice"><input type="checkbox" data-first-item="${escapeHtml(item.id)}" ${item.selected ? 'checked' : ''} /><span>${escapeHtml(item.label)}</span></label>`).join('')}</div>`;
    case 'accounts':
      return `<div class="identity-choice-list">${state.accounts.length ? state.accounts.map(account => `<button type="button" data-identity-account="${escapeHtml(account.identity)}" class="identity-choice${account.active ? ' is-current' : ''}"><strong>${escapeHtml(account.displayName || 'Connected account')}</strong><span>${escapeHtml(account.detail)}</span></button>`).join('') : '<p class="identity-empty">No other saved accounts are available on this device.</p>'}</div><div class="identity-choice-list">${state.homes.map(home => `<button type="button" data-identity-home="${home.id}" class="identity-choice${home.active ? ' is-current' : ''}"><strong>${escapeHtml(home.name)}</strong><span>${escapeHtml(`${home.label}, ${home.residenceName}`)}</span></button>`).join('')}</div>`;
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
  const sections = screen.sections.map(section => {
    const body = section.id === 'recovery'
      ? 'Reconnect an account previously used on this device with its saved connection.'
      : section.id === 'invite'
        ? 'Copy a private invitation link and share it yourself.'
        : section.body;
    return `<section class="identity-section" data-section="${escapeHtml(section.id)}">${section.heading ? `<h2>${escapeHtml(section.heading)}</h2>` : ''}${body ? `<p>${escapeHtml(body)}</p>` : ''}${section.rows?.length ? `<div class="identity-summary-rows">${section.rows.map(row => `<div><strong>${escapeHtml(row.title)}</strong>${row.detail ? `<span>${escapeHtml(row.detail)}</span>` : ''}${row.status ? `<small>${escapeHtml(row.status)}</small>` : ''}</div>`).join('')}</div>` : ''}</section>`;
  }).join('');
  const status = screen.status ? `<p class="identity-request identity-${screen.status.kind}" role="status">${escapeHtml(screen.status.message)}</p>` : '';
  return `<div class="identity-screen" data-identity-route="${state.route}">
    <header class="identity-screen-header"><div>${screen.eyebrow ? `<p class="eyebrow">${escapeHtml(screen.eyebrow)}</p>` : ''}<h1>${escapeHtml(screen.title)}</h1>${screen.body ? `<p>${escapeHtml(screen.body)}</p>` : ''}</div>${screen.step ? `<span class="identity-step" aria-label="Onboarding progress">${screen.step.current} / ${screen.step.total}</span>` : ''}</header>
    ${status}<form id="identity-flow-form" class="identity-flow-form">${completion ? '' : routeFields(state)}${sections}<footer class="identity-actions">${!completion && state.route !== 'welcome' ? '<button type="button" class="quiet-button" data-identity-action="back">Back</button>' : ''}${actionButtons(state, completion, editingExistingHome)}</footer></form>
  </div>`;
}

export function identityBackRoute(route: IdentityRoute): IdentityRoute {
  if (route === 'profile' || route === 'home-access') return 'welcome';
  if (route === 'create-home' || route === 'join-home') return 'home-access';
  if (route === 'bring-house-together' || route === 'first-task') return 'home-access';
  if (route === 'delete-account' || route === 'ai-connection' || route === 'accounts') return 'settings';
  return 'welcome';
}
