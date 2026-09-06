import { isEditableKeyboardTarget } from '../app/targetEditorKeyboard';

const DOCK_TOGGLE_SELECTOR = '[data-studio-dock-toggle]';
const HUD_TOGGLE_SELECTOR = '[data-studio-hud-toggle]';
const DOCK_SHORTCUT_KEY = '`';

export type StudioShellController = {
  setDockExpanded(expanded: boolean): void;
  isDockExpanded(): boolean;
  setHudExpanded(hud: string, expanded: boolean): void;
  isHudExpanded(hud: string): boolean;
  dispose(): void;
};

export function setupStudioShell(root: ParentNode = document): StudioShellController {
  const page = root.querySelector<HTMLElement>('.target-page');
  const dockToggle = root.querySelector<HTMLButtonElement>(DOCK_TOGGLE_SELECTOR);
  const hudToggles = [...root.querySelectorAll<HTMLButtonElement>(HUD_TOGGLE_SELECTOR)];
  const view = (page ?? dockToggle)?.ownerDocument.defaultView;

  const applyDockExpanded = (expanded: boolean, announceResize: boolean): void => {
    if (page) {
      page.dataset.studioDock = expanded ? 'expanded' : 'collapsed';
    }
    if (dockToggle) {
      dockToggle.setAttribute('aria-expanded', String(expanded));
      const label = expanded ? 'Hide the inspector' : 'Show the inspector';
      dockToggle.setAttribute('aria-label', label);
      dockToggle.title = `${label} (\`)`;
    }
    if (announceResize) {
      // The dock resizes the preview stage without resizing the window, so the 3D
      // renderer is told to re-measure the container it draws into.
      view?.dispatchEvent(new Event('resize'));
    }
  };

  const isDockExpanded = (): boolean => page?.dataset.studioDock !== 'collapsed';

  const hudPanel = (hud: string): HTMLElement | null => (
    root.querySelector<HTMLElement>(`[data-studio-hud-panel="${hud}"]`)
  );

  const setHudExpanded = (hud: string, expanded: boolean): void => {
    const panel = hudPanel(hud);
    if (panel) {
      panel.dataset.studioHud = expanded ? 'expanded' : 'collapsed';
    }
    for (const toggle of hudToggles) {
      if (toggle.dataset.studioHudToggle === hud) {
        toggle.setAttribute('aria-expanded', String(expanded));
      }
    }
  };

  const isHudExpanded = (hud: string): boolean => hudPanel(hud)?.dataset.studioHud === 'expanded';

  const onDockToggle = (): void => applyDockExpanded(!isDockExpanded(), true);

  const onHudToggle = (event: Event): void => {
    const toggle = event.currentTarget as HTMLButtonElement;
    const hud = toggle.dataset.studioHudToggle;
    if (hud) {
      setHudExpanded(hud, !isHudExpanded(hud));
    }
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== DOCK_SHORTCUT_KEY || event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }
    if (page?.hidden !== false || isEditableKeyboardTarget(event.target)) {
      return;
    }
    event.preventDefault();
    onDockToggle();
  };

  dockToggle?.addEventListener('click', onDockToggle);
  for (const toggle of hudToggles) {
    toggle.addEventListener('click', onHudToggle);
    setHudExpanded(toggle.dataset.studioHudToggle ?? '', false);
  }
  applyDockExpanded(true, false);
  view?.addEventListener('keydown', onKeyDown);

  return {
    setDockExpanded: (expanded) => applyDockExpanded(expanded, true),
    isDockExpanded,
    setHudExpanded,
    isHudExpanded,
    dispose(): void {
      dockToggle?.removeEventListener('click', onDockToggle);
      for (const toggle of hudToggles) {
        toggle.removeEventListener('click', onHudToggle);
      }
      view?.removeEventListener('keydown', onKeyDown);
    },
  };
}
