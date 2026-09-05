import { COMPLETION_STEP, IDENTITY_STEPS, type IdentityStepMetadata } from './flow.ts';
import { canDeleteAccount, homePreview, selectedFirstTaskItems, type IdentityFeatureState, type IdentityRoute } from './model.ts';

export interface ScreenAction {
  id: string;
  label: string;
  tone: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
}

export interface ScreenSection {
  id: string;
  heading?: string;
  body?: string;
  rows?: Array<{ title: string; detail?: string; status?: string }>;
}

export interface IdentityScreen {
  route: IdentityRoute;
  title: string;
  eyebrow?: string;
  body?: string;
  step?: IdentityStepMetadata['mobileStep'];
  status?: { kind: 'loading' | 'success' | 'error'; message: string };
  sections: ScreenSection[];
  actions: ScreenAction[];
}

function requestStatus(state: IdentityFeatureState): IdentityScreen['status'] {
  if (state.request === 'idle') return undefined;
  return { kind: state.request, message: state.message || (state.request === 'loading' ? 'Working…' : '') };
}

export function renderIdentityScreen(state: IdentityFeatureState): IdentityScreen {
  const metadata = IDENTITY_STEPS[state.route];
  const base: IdentityScreen = {
    route: state.route,
    title: metadata.title,
    step: metadata.mobileStep,
    status: requestStatus(state),
    sections: [],
    actions: [],
  };

  switch (state.route) {
    case 'welcome':
      return { ...base, eyebrow: 'WELCOME TO TABBY', body: 'Groceries, meals, bills, notes, and house decisions stay in one calm conversation.', actions: [
        { id: 'create-home', label: 'Create a home', tone: 'primary' },
        { id: 'join-home', label: 'Choose an existing home', tone: 'secondary' },
      ] };
    case 'profile':
      return { ...base, body: 'Add the details housemates should recognize. Private conversation content is never part of this profile.', sections: [
        { id: 'identity', heading: 'Private account details', body: 'Name, phone, and email stay attached to the connected account.' },
        { id: 'preferences', heading: 'Household preferences', body: 'Dietary choices and cooking habits help with shared planning.' },
      ], actions: [{ id: 'save-profile', label: 'Continue', tone: 'primary' }] };
    case 'home-access':
      return { ...base, body: 'Choose an existing home or create a new one.', actions: [
        { id: 'create-home', label: 'Create a home', tone: 'primary' },
      ] };
    case 'create-home': {
      const preview = homePreview(state.createHome);
      return { ...base, body: 'Name the place in a way everyone will recognize.', sections: [
        { id: 'storage', heading: 'Original household storage', body: 'This home uses the existing residence, flat, and member tables.' },
        ...(preview ? [{ id: 'preview', heading: 'Preview', rows: [{ title: preview.title, detail: `${preview.location}. ${preview.memberLabel}` }] }] : []),
      ], actions: [{ id: 'confirm-create-home', label: 'Create home', tone: 'primary', disabled: !preview }] };
    }
    case 'join-home': {
      const invitation = state.invitation;
      const sections: ScreenSection[] = [{ id: 'invitation-entry', heading: 'Six-character invitation', body: 'Enter the invitation exactly as it was shared.' }];
      if (invitation.kind === 'loading') sections.push({ id: 'lookup', body: 'Looking up this home…' });
      if (invitation.kind === 'invalid' || invitation.kind === 'error') sections.push({ id: 'lookup-error', body: invitation.message });
      if (invitation.kind === 'valid') sections.push({ id: 'preview', heading: invitation.preview.homeName, rows: [
        { title: invitation.preview.residenceName, detail: invitation.preview.homeLabel },
        { title: `Invited by ${invitation.preview.invitedByName}`, detail: `${invitation.preview.memberCount} current members` },
      ] });
      return { ...base, sections, actions: [{ id: 'confirm-join', label: 'Join this home', tone: 'primary', disabled: invitation.kind !== 'valid' }] };
    }
    case 'bring-house-together':
      return { ...base, body: 'Invite housemates now, then set the shared defaults everyone will see.', sections: [
        { id: 'invite', heading: 'Invitation link', body: 'Copy a private invitation or address it to an email or phone number.' },
        { id: 'basics', heading: 'Household basics', rows: [
          { title: 'Quiet hours', detail: state.basics.quietHoursStart && state.basics.quietHoursEnd ? `${state.basics.quietHoursStart} to ${state.basics.quietHoursEnd}` : 'Not set' },
          { title: 'Default bill split', detail: state.basics.defaultBillingSplit },
          { title: 'Invitations', detail: state.basics.invitesEnabled ? 'Enabled' : 'Paused' },
        ] },
      ], actions: [
        { id: 'copy-invitation', label: 'Copy invitation', tone: 'secondary' },
        { id: 'save-basics', label: 'Save and continue', tone: 'primary' },
      ] };
    case 'first-task': {
      const selected = selectedFirstTaskItems(state.firstTaskItems);
      return { ...base, body: 'Choose real pantry items already in your home. Nothing is preselected or invented.', sections: [
        { id: 'starter-items', rows: state.firstTaskItems.map(item => ({ title: item.label, status: item.selected ? 'Selected' : undefined })) },
      ], actions: [{ id: 'save-first-items', label: `Save ${selected.length} item${selected.length === 1 ? '' : 's'}`, tone: 'primary', disabled: selected.length === 0 }] };
    }
    case 'accounts':
      return { ...base, body: 'Switching waits for the selected connection before the account becomes active.', sections: [
        { id: 'recovery', heading: 'Cannot access an account?', body: 'Start account recovery with your configured identity provider, then reconnect Tabby.' },
      ], actions: [
        { id: 'sign-out', label: 'Sign out', tone: 'secondary' },
        { id: 'recover-account', label: 'Recover account', tone: 'secondary' },
      ] };
    case 'settings':
      return { ...base, sections: [
        { id: 'profile', heading: 'Profile and account', body: 'Edit account details, switch accounts, or sign out.' },
        { id: 'home', heading: 'Home', body: 'Choose your current home.' },
        { id: 'ai', heading: 'AI connection', body: 'Optional. Core household tools work without it.' },
      ], actions: [] };
    case 'delete-account':
      return { ...base, body: 'This permanently removes data owned by this account. Type DELETE to continue.', sections: [
        { id: 'delete-confirmation', heading: 'Type DELETE', body: 'This action cannot be undone.' },
      ], actions: [{ id: 'confirm-delete', label: 'Delete account', tone: 'danger', disabled: !canDeleteAccount(state.deletionInput) }] };
    case 'ai-connection': {
      const copy = {
        disconnected: ['Not connected', 'Connect an optional AI provider. Core tools remain available.'],
        checking: ['Checking connection', 'Tabby is waiting for the provider response.'],
        connected: ['Connected', `Using ${state.ai.model || 'the selected model'}.`],
        error: ['Connection failed', state.ai.kind === 'error' ? state.ai.message : 'Try again.'],
      } as const;
      const [heading, body] = copy[state.ai.kind];
      return { ...base, sections: [{ id: 'ai-status', heading, body }], actions: state.ai.kind === 'connected'
        ? [{ id: 'disconnect-ai', label: 'Disconnect', tone: 'secondary' }]
        : [{ id: 'connect-ai', label: state.ai.kind === 'checking' ? 'Checking' : 'Connect', tone: 'primary', disabled: state.ai.kind === 'checking' }],
      };
    }
  }
}

export function renderCompletionScreen(): IdentityScreen {
  return {
    route: 'first-task',
    title: COMPLETION_STEP.title,
    step: COMPLETION_STEP.mobileStep,
    body: 'Your home is ready. Start a conversation whenever something needs handling.',
    sections: [],
    actions: [{ id: 'open-conversation', label: 'Start a conversation', tone: 'primary' }],
  };
}
