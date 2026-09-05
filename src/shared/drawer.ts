export interface DrawerController {
  setOpen(open: boolean): void;
  isOpen(): boolean;
  destroy(): void;
}

export function installDrawerController(options: {
  panel: HTMLElement;
  toggle: HTMLButtonElement;
  close: HTMLButtonElement;
  scrim: HTMLElement;
  isDrawer: () => boolean;
}): DrawerController {
  const { panel, toggle, close, scrim, isDrawer } = options;
  let open = false;
  let returnFocus: HTMLElement | null = null;

  const setOpen = (next: boolean) => {
    if (!isDrawer()) {
      open = false;
      panel.hidden = false;
      panel.inert = false;
      scrim.hidden = true;
      panel.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
      return;
    }

    open = next;
    toggle.setAttribute('aria-expanded', String(next));
    panel.hidden = !next;
    panel.inert = !next;
    scrim.hidden = !next;
    panel.classList.toggle('open', next);
    document.body.classList.toggle('drawer-open', next);

    if (next) {
      returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : toggle;
      close.focus();
    } else if (returnFocus?.isConnected) {
      returnFocus.focus();
    }
  };

  const onToggle = () => setOpen(!open);
  const onClose = () => setOpen(false);
  const onKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && open) {
      event.preventDefault();
      setOpen(false);
    }
  };
  const onResize = () => setOpen(false);

  toggle.addEventListener('click', onToggle);
  close.addEventListener('click', onClose);
  scrim.addEventListener('click', onClose);
  document.addEventListener('keydown', onKeydown);
  window.addEventListener('resize', onResize);

  return {
    setOpen,
    isOpen: () => open,
    destroy() {
      toggle.removeEventListener('click', onToggle);
      close.removeEventListener('click', onClose);
      scrim.removeEventListener('click', onClose);
      document.removeEventListener('keydown', onKeydown);
      window.removeEventListener('resize', onResize);
    },
  };
}
