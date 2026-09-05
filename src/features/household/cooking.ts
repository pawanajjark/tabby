import type { AcknowledgementState, HouseholdAction } from './actions.ts';
import { escapeHouseholdHtml } from './html.ts';

export interface CookingPantryChange {
  name: string;
  quantityUsed: number;
  unit: string;
}

export interface CookingConfirmation {
  recipeName: string;
  changes: CookingPantryChange[];
  status: 'review' | 'submitting' | 'confirmed' | 'rejected';
  acknowledgements: Record<string, AcknowledgementState>;
}

export function createCookingConfirmation(recipeName: string, changes: readonly CookingPantryChange[]): CookingConfirmation {
  if (!recipeName.trim() || changes.length === 0) throw new Error('Cooking confirmation needs a recipe and pantry changes.');
  if (changes.some(change => !change.name.trim() || change.quantityUsed <= 0)) {
    throw new Error('Cooking quantities must be positive.');
  }
  return { recipeName: recipeName.trim(), changes: [...changes], status: 'review', acknowledgements: {} };
}

export function confirmCookingActions(model: CookingConfirmation, online: boolean): HouseholdAction[] {
  if (!online) return [];
  return model.changes.map(change => ({
    reducer: 'addPantryItem',
    payload: { name: change.name, quantity: -change.quantityUsed, unit: change.unit },
  }));
}

export function cookingAcknowledged(model: CookingConfirmation, itemName: string): CookingConfirmation {
  const acknowledgements = { ...model.acknowledgements, [itemName]: { status: 'acknowledged' } as const };
  const complete = model.changes.every(change => acknowledgements[change.name]?.status === 'acknowledged');
  return { ...model, acknowledgements, status: complete ? 'confirmed' : 'submitting' };
}

export function renderCookingConfirmation(model: CookingConfirmation, online: boolean): string {
  return `<section class="cooking-confirmation status-${model.status}" data-cooking-confirmation>
    <header><p class="eyebrow">CONFIRM PANTRY CHANGES</p><h2>${escapeHouseholdHtml(model.recipeName)}</h2></header>
    <ul>${model.changes.map(change => `<li>${escapeHouseholdHtml(change.name)} <strong>−${change.quantityUsed} ${escapeHouseholdHtml(change.unit)}</strong></li>`).join('')}</ul>
    ${online ? '' : '<p role="status">Reconnect before updating the shared pantry.</p>'}
    <button type="button" data-confirm-cooking ${!online || model.status !== 'review' ? 'disabled' : ''}>Confirm and update pantry</button>
  </section>`;
}
