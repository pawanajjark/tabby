import type { HouseholdAction } from './actions.ts';
import { escapeHouseholdHtml } from './html.ts';

export interface StarterPantryChoice {
  key: string;
  label: string;
  quantity: number;
  unit: string;
  selected: boolean;
}

export function createStarterPantry(choices: readonly Omit<StarterPantryChoice, 'selected'>[]): StarterPantryChoice[] {
  return choices.map(choice => ({ ...choice, selected: false }));
}

export function toggleStarterChoice(choices: readonly StarterPantryChoice[], key: string): StarterPantryChoice[] {
  return choices.map(choice => choice.key === key ? { ...choice, selected: !choice.selected } : choice);
}

export function starterPantryActions(choices: readonly StarterPantryChoice[], online: boolean): HouseholdAction[] {
  if (!online) return [];
  return choices.filter(choice => choice.selected).map(choice => ({
    reducer: 'addPantryItem',
    payload: { name: choice.label, quantity: choice.quantity, unit: choice.unit },
  }));
}

export function renderStarterPantry(choices: readonly StarterPantryChoice[], online: boolean): string {
  const selected = choices.filter(choice => choice.selected).length;
  return `<section class="starter-pantry" data-first-task>
    <header><p class="eyebrow">YOUR FIRST REAL TASK</p><h2>Start your pantry</h2><p>Select only what is actually in your home.</p></header>
    <div class="starter-pantry-choices">${choices.map(choice => `<button type="button" class="starter-choice ${choice.selected ? 'selected' : ''}" data-starter-key="${escapeHouseholdHtml(choice.key)}" aria-pressed="${choice.selected}">${escapeHouseholdHtml(choice.label)}</button>`).join('')}</div>
    <button type="button" data-save-starter ${!online || selected === 0 ? 'disabled' : ''}>Save ${selected} item${selected === 1 ? '' : 's'}</button>
  </section>`;
}
