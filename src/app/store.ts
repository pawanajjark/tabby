export type AppRoute = 'conversations' | 'pantry' | 'home';
export type Connectivity = 'connecting' | 'online' | 'offline';

export interface AppState {
  route: AppRoute;
  connectivity: Connectivity;
  synchronized: boolean;
}

export class AppStore {
  private listeners = new Set<(state: Readonly<AppState>) => void>();
  private state: AppState;

  constructor(state: AppState) {
    this.state = state;
  }

  getState(): Readonly<AppState> {
    return this.state;
  }

  update(patch: Partial<AppState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach(listener => listener(this.state));
  }

  subscribe(listener: (state: Readonly<AppState>) => void) {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }
}
