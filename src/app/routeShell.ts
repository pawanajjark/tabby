import type { AppRoute } from './store';

export function routeNavigation(className: string) {
  const isMobile = className.includes('mobile-bottom-nav');
  const icon = (name: 'chat' | 'pantry' | 'expenses' | 'more') => ({
    chat: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 18.5 3.5 21v-5A8 8 0 1 1 7 19.1" /></svg>',
    pantry: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 9h14l-1 11H6L5 9Zm2-4h10l2 4H5l2-4Z" /></svg>',
    expenses: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Zm3 5h6m-6 4h6" /></svg>',
    more: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.25" /><circle cx="12" cy="12" r="1.25" /><circle cx="19" cy="12" r="1.25" /></svg>',
  })[name];
  const label = (name: 'chat' | 'pantry' | 'expenses' | 'more', text: string) => isMobile
    ? `${icon(name)}<span>${text}</span>`
    : text;
  return `<nav class="${className}" aria-label="Primary navigation">
    <button type="button" data-route="conversations">${label('chat', isMobile ? 'Chat' : 'Conversations')}</button>
    <button type="button" data-route="pantry">${label('pantry', 'Pantry')}</button>
    <button type="button" data-route="expenses">${label('expenses', 'Expenses')}</button>
    ${isMobile
      ? `<button type="button" data-open-context aria-controls="context-panel">${label('more', 'More')}</button>`
      : '<button type="button" data-route="home">Home shelf</button>'}
  </nav>`;
}

export function installRouteNavigation(onRoute: (route: AppRoute) => void) {
  document.querySelectorAll<HTMLButtonElement>('[data-route]').forEach(button => {
    button.addEventListener('click', () => onRoute(button.dataset.route as AppRoute));
  });
}

export function reflectRoute(route: AppRoute) {
  document.querySelectorAll<HTMLButtonElement>('[data-route]').forEach(button => {
    const active = button.dataset.route === route;
    button.classList.toggle('active', active);
    if (active) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
  document.querySelectorAll<HTMLElement>('[data-route-view]').forEach(view => {
    view.hidden = view.dataset.routeView !== route;
  });
}
