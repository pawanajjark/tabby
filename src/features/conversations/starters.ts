export interface EmptyHomeState {
  synchronized: boolean;
  homeSelected: boolean;
  pantryCount: number;
  noteCount: number;
  agreementCount: number;
  billCount: number;
}

export interface StarterSuggestion {
  id: 'pantry' | 'note' | 'agreement' | 'bill';
  label: string;
  prompt: string;
}

const EMPTY_HOME_STARTERS: StarterSuggestion[] = [
  { id: 'pantry', label: 'Start the pantry', prompt: 'Add our first pantry items' },
  { id: 'note', label: 'Save a home note', prompt: 'Remember a useful note for our home' },
  { id: 'agreement', label: 'Add an agreement', prompt: 'Add our first house agreement' },
  { id: 'bill', label: 'Split a bill', prompt: 'Help me review and split a bill' },
];

/** Suggestions appear only after synchronized data proves the selected home is empty. */
export function emptyHomeStarterSuggestions(state: EmptyHomeState): StarterSuggestion[] {
  if (!state.synchronized || !state.homeSelected) return [];
  if (state.pantryCount + state.noteCount + state.agreementCount + state.billCount > 0) return [];
  return EMPTY_HOME_STARTERS.map(suggestion => ({ ...suggestion }));
}
