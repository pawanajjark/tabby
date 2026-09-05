import type { IdentityRoute } from './model.ts';

export interface IdentityStepMetadata {
  route: IdentityRoute;
  title: string;
  shortTitle: string;
  mobileStep?: { current: number; total: number };
  back?: IdentityRoute;
  next?: IdentityRoute;
}

export const IDENTITY_STEPS: Record<IdentityRoute, IdentityStepMetadata> = {
  welcome: { route: 'welcome', title: 'Run your home from one conversation', shortTitle: 'Welcome', mobileStep: { current: 1, total: 6 }, next: 'profile' },
  profile: { route: 'profile', title: 'Your profile', shortTitle: 'Profile', mobileStep: { current: 2, total: 6 }, back: 'welcome', next: 'home-access' },
  'home-access': { route: 'home-access', title: 'Choose or create a home', shortTitle: 'Home', mobileStep: { current: 3, total: 6 }, back: 'profile' },
  'create-home': { route: 'create-home', title: 'Create your home', shortTitle: 'Create', mobileStep: { current: 3, total: 6 }, back: 'home-access', next: 'bring-house-together' },
  'join-home': { route: 'join-home', title: 'Join a home', shortTitle: 'Join', mobileStep: { current: 3, total: 6 }, back: 'home-access', next: 'first-task' },
  'bring-house-together': { route: 'bring-house-together', title: 'Bring the house together', shortTitle: 'Invite', mobileStep: { current: 4, total: 6 }, back: 'create-home', next: 'first-task' },
  'first-task': { route: 'first-task', title: 'Start with one real task', shortTitle: 'First task', mobileStep: { current: 5, total: 6 }, back: 'bring-house-together' },
  accounts: { route: 'accounts', title: 'Accounts and homes', shortTitle: 'Accounts' },
  settings: { route: 'settings', title: 'Settings', shortTitle: 'Settings' },
  'delete-account': { route: 'delete-account', title: 'Delete your Tabby account', shortTitle: 'Delete', back: 'settings' },
  'ai-connection': { route: 'ai-connection', title: 'AI connection', shortTitle: 'AI', back: 'settings' },
};

export const COMPLETION_STEP: IdentityStepMetadata = {
  route: 'first-task', title: 'Your home is ready', shortTitle: 'Ready', mobileStep: { current: 6, total: 6 },
};
