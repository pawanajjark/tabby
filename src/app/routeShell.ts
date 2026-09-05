import type { AppRoute } from './store';

export function routeNavigation(className: string) {
  const isMobile = className.includes('mobile-bottom-nav');
  return `<nav class="${className}" aria-label="Primary navigation">
    <button type="button" data-route="conversations">${isMobile ? 'Chat' : 'Conversations'}</button>
    <button type="button" data-route="pantry">Pantry</button>
    <button type="button" data-route="expenses">Expenses</button>
    ${isMobile
      ? '<button type="button" data-open-context aria-controls="context-panel">More</button>'
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
