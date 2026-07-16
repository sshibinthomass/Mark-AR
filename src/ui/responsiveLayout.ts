const MOBILE_QUERY = '(max-width: 760px)';

export function applyResponsiveLayout(root: HTMLElement, mobile: boolean): void {
  arrange(root, '.landing-inner', mobile
    ? ['landing-copy', 'mode-picker', 'landing-flow', 'landing-preview']
    : ['landing-copy', 'landing-flow', 'landing-preview', 'mode-picker']);
  arrange(root, '.scanner-panel', mobile
    ? ['scanner-controls', 'scanner-stage']
    : ['scanner-stage', 'scanner-controls']);
  arrange(root, '.target-workspace', mobile
    ? ['target-inspector', 'target-preview']
    : ['target-preview', 'target-inspector']);
  arrange(root, '.auth-layout', mobile
    ? ['auth-controls', 'auth-access']
    : ['auth-access', 'auth-controls']);
  root.dataset.layoutViewport = mobile ? 'mobile' : 'desktop';
}

export function setupResponsiveLayout(
  root: HTMLElement,
  mediaQuery = window.matchMedia(MOBILE_QUERY),
): { dispose(): void } {
  const update = () => applyResponsiveLayout(root, mediaQuery.matches);
  mediaQuery.addEventListener('change', update);
  update();
  return {
    dispose(): void {
      mediaQuery.removeEventListener('change', update);
    },
  };
}

function arrange(root: HTMLElement, containerSelector: string, roles: string[]): void {
  const container = root.querySelector<HTMLElement>(containerSelector);
  if (!container) {
    return;
  }

  for (const role of roles) {
    const node = root.querySelector<HTMLElement>(`[data-layout-role="${role}"]`);
    if (node) {
      container.append(node);
    }
  }
}
