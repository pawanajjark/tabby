export type IdentityRoute =
  | 'welcome'
  | 'profile'
  | 'home-access'
  | 'create-home'
  | 'join-home'
  | 'bring-house-together'
  | 'first-task'
  | 'accounts'
  | 'settings'
  | 'delete-account'
  | 'ai-connection';

export type RequestState = 'idle' | 'loading' | 'success' | 'error';

export interface ProfileDraft {
  displayName: string;
  phone: string;
  email: string;
  dietaryTags: string[];
  cookingHabits: string[];
}

export interface CreateHomeDraft {
  residenceName: string;
  address: string;
  homeName: string;
  homeLabel: string;
  displayName: string;
}

export interface HomePreview {
  title: string;
  location: string;
  memberLabel: string;
  privacyNote: string;
}

export interface InvitationPreview {
  code: string;
  homeId: bigint;
  homeName: string;
  homeLabel: string;
  residenceName: string;
  invitedByName: string;
  memberCount: number;
}

export type InvitationLookupState =
  | { kind: 'empty'; code: string }
  | { kind: 'loading'; code: string }
  | { kind: 'invalid'; code: string; message: string }
  | { kind: 'valid'; code: string; preview: InvitationPreview }
  | { kind: 'error'; code: string; message: string };

export interface InvitationDraft {
  code: string;
  recipient: string;
  expiresAt: Date;
}

export interface HomeBasicsDraft {
  quietHoursStart: string;
  quietHoursEnd: string;
  defaultBillingSplit: string;
  invitesEnabled: boolean;
}

export interface HomeChoice {
  id: bigint;
  name: string;
  label: string;
  residenceName: string;
  memberCount?: number;
  active: boolean;
}

export interface AccountChoice {
  identity: string;
  displayName: string;
  detail: string;
  active: boolean;
}

export type AiConnectionState =
  | { kind: 'disconnected'; model: string }
  | { kind: 'checking'; model: string }
  | { kind: 'connected'; model: string }
  | { kind: 'error'; model: string; message: string };

export interface FirstTaskItem {
  id: string;
  label: string;
  selected: boolean;
}

export interface IdentityFeatureState {
  route: IdentityRoute;
  request: RequestState;
  message?: string;
  profile: ProfileDraft;
  createHome: CreateHomeDraft;
  invitation: InvitationLookupState;
  basics: HomeBasicsDraft;
  homes: HomeChoice[];
  selectedHomeId?: bigint;
  homesSynchronized: boolean;
  accounts: AccountChoice[];
  firstTaskItems: FirstTaskItem[];
  deletionInput: string;
  ai: AiConnectionState;
}

export const EMPTY_PROFILE: ProfileDraft = {
  displayName: '', phone: '', email: '', dietaryTags: [], cookingHabits: [],
};

export const EMPTY_HOME: CreateHomeDraft = {
  residenceName: '', address: '', homeName: '', homeLabel: '', displayName: '',
};

export function normalizeCreateHomeDraft(draft: CreateHomeDraft): CreateHomeDraft {
  const homeName = draft.homeName.trim();
  const homeLabel = draft.homeLabel.trim();
  return {
    residenceName: draft.residenceName.trim() || homeName,
    address: draft.address.trim() || homeLabel || 'Address not added',
    homeName,
    homeLabel: homeLabel || 'Home',
    displayName: draft.displayName.trim(),
  };
}

export const DEFAULT_BASICS: HomeBasicsDraft = {
  quietHoursStart: '', quietHoursEnd: '', defaultBillingSplit: 'equal', invitesEnabled: true,
};

export function createIdentityState(route: IdentityRoute = 'welcome'): IdentityFeatureState {
  return {
    route,
    request: 'idle',
    profile: { ...EMPTY_PROFILE },
    createHome: { ...EMPTY_HOME },
    invitation: { kind: 'empty', code: '' },
    basics: { ...DEFAULT_BASICS },
    homes: [],
    homesSynchronized: false,
    accounts: [],
    firstTaskItems: [],
    deletionInput: '',
    ai: { kind: 'disconnected', model: '' },
  };
}

export function homePreview(draft: CreateHomeDraft): HomePreview | null {
  const normalized = normalizeCreateHomeDraft(draft);
  if (!normalized.homeName || !normalized.displayName) return null;
  return {
    title: normalized.homeName,
    location: draft.homeLabel.trim() || 'Address can be added later',
    memberLabel: `${normalized.displayName} will be the first member`,
    privacyNote: 'Only invited members can see shared home details. Private conversations stay private.',
  };
}

export function normalizeInvitationCode(value: string): string {
  return value.replace(/[^a-z0-9]/gi, '').toUpperCase().slice(0, 6);
}

export function isCompleteInvitationCode(value: string): boolean {
  return /^[A-Z0-9]{6}$/.test(normalizeInvitationCode(value));
}

export function canDeleteAccount(input: string): boolean {
  return input === 'DELETE';
}

export function selectedFirstTaskItems(items: FirstTaskItem[]): FirstTaskItem[] {
  return items.filter(item => item.selected);
}

export function updateIdentityTextField(
  state: IdentityFeatureState,
  name: string,
  value: string,
): IdentityFeatureState {
  const clean = value.trim();
  if (state.route === 'profile') {
    if (name === 'displayName' || name === 'phone' || name === 'email') {
      return { ...state, profile: { ...state.profile, [name]: clean } };
    }
    if (name === 'dietaryTags' || name === 'cookingHabits') {
      return {
        ...state,
        profile: {
          ...state.profile,
          [name]: value.split(',').map(item => item.trim()).filter(Boolean),
        },
      };
    }
  }
  if (state.route === 'create-home') {
    const field = name === 'homeDisplayName' ? 'displayName' : name;
    if (field === 'residenceName' || field === 'address' || field === 'homeName' || field === 'homeLabel' || field === 'displayName') {
      return { ...state, createHome: { ...state.createHome, [field]: clean } };
    }
  }
  return state;
}
