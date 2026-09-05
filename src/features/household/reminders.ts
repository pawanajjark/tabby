import type { Reminder } from '../../module_bindings/types.ts';
import type { HouseholdAction } from './actions.ts';
import { escapeHouseholdHtml } from './html.ts';

export type ReminderState = 'upcoming' | 'due' | 'completed';

export interface ReminderView {
  id: bigint;
  title: string;
  dueAtMicros: bigint;
  state: ReminderState;
}

export function reminderViews(rows: readonly Reminder[], nowMicros: bigint): ReminderView[] {
  return rows
    .map(row => ({
      id: row.id,
      title: row.title,
      dueAtMicros: row.dueAt.microsSinceUnixEpoch,
      state: row.completed ? 'completed' as const : row.dueAt.microsSinceUnixEpoch <= nowMicros ? 'due' as const : 'upcoming' as const,
    }))
    .sort((left, right) => left.dueAtMicros < right.dueAtMicros ? -1 : left.dueAtMicros > right.dueAtMicros ? 1 : 0);
}

export function createReminderAction(title: string, dueAtMicros: bigint): HouseholdAction {
  if (!title.trim()) throw new Error('Reminder title is required.');
  return { reducer: 'createReminder', payload: { title: title.trim(), dueAt: { microsSinceUnixEpoch: dueAtMicros } } };
}

export function completeReminderAction(id: bigint): HouseholdAction {
  return { reducer: 'completeReminder', payload: { id } };
}

export function renderReminderShelf(reminders: readonly ReminderView[], online: boolean): string {
  const content = reminders.length
    ? reminders.map(reminder => `<li class="reminder-${reminder.state}" data-reminder-id="${reminder.id}"><span>${escapeHouseholdHtml(reminder.title)}</span><button type="button" data-complete-reminder ${!online || reminder.state === 'completed' ? 'disabled' : ''}>Done</button></li>`).join('')
    : '<li class="reminder-empty">No reminders yet.</li>';
  return `<section class="shelf-reminders"><header><h3>Reminders</h3><span>${reminders.filter(row => row.state !== 'completed').length}</span></header><ul>${content}</ul></section>`;
}
