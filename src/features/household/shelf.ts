import type { PantryViewItem } from './pantry.ts';
import { pantryShelfSummary } from './pantry.ts';
import type { ReminderView } from './reminders.ts';
import { escapeHouseholdHtml } from './html.ts';

export interface HomeShelfInput {
  homeName?: string;
  people: readonly { displayName: string }[];
  pantry: readonly PantryViewItem[];
  notes: readonly { title: string }[];
  agreements: readonly { title: string }[];
  reminders: readonly ReminderView[];
  online: boolean;
  mobile?: boolean;
}

export function renderHomeShelfSummary(input: HomeShelfInput): string {
  const pantry = pantryShelfSummary(input.pantry);
  const empty = input.pantry.length + input.notes.length + input.agreements.length + input.reminders.length === 0;
  return `<aside class="home-shelf-summary ${input.mobile ? 'home-shelf-mobile' : 'home-shelf-desktop'}" data-home-shelf-summary>
    <header><p class="eyebrow">HOME SHELF</p><h2>${escapeHouseholdHtml(input.homeName || 'Your home')}</h2>${input.online ? '' : '<p class="shelf-unavailable">Showing the last synchronized shelf. Shared actions are unavailable.</p>'}</header>
    ${empty ? '<div class="shelf-empty"><h3>Your shared home is empty</h3><p>Add a real pantry item, note, agreement, or reminder when you are ready.</p></div>' : `<div class="shelf-summary-grid">
      <section class="shelf-summary-card people-summary"><strong>${input.people.length}</strong><span>People</span></section>
      <section class="shelf-summary-card pantry-summary"><strong>${pantry.total}</strong><span>Pantry · ${pantry.low} low · ${pantry.useSoon} use soon</span></section>
      <section class="shelf-summary-card notes-summary"><strong>${input.notes.length}</strong><span>Home notes</span></section>
      <section class="shelf-summary-card agreements-summary"><strong>${input.agreements.length}</strong><span>Agreements</span></section>
    </div>`}
  </aside>`;
}
