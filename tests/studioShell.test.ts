import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setupStudioShell, type StudioShellController } from '../src/ui/studioShell';

// Controllers listen on the shared window, so each test disposes its own.
const mounted: StudioShellController[] = [];

function mount(root: ParentNode): StudioShellController {
  const controller = setupStudioShell(root);
  mounted.push(controller);
  return controller;
}

describe('studio shell controller', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    mounted.splice(0).forEach((controller) => controller.dispose());
  });

  it('starts with the dock open and the camera sliders hidden', () => {
    const root = renderFixture();

    mount(root);

    expect(page(root).dataset.studioDock).toBe('expanded');
    expect(dockToggle(root).getAttribute('aria-expanded')).toBe('true');
    expect(dockToggle(root).getAttribute('aria-label')).toBe('Hide the inspector');
    expect(hudPanel(root).dataset.studioHud).toBe('collapsed');
    expect(hudToggle(root).getAttribute('aria-expanded')).toBe('false');
  });

  it('collapses and restores the dock from the toggle', () => {
    const root = renderFixture();
    const controller = mount(root);

    dockToggle(root).click();

    expect(controller.isDockExpanded()).toBe(false);
    expect(page(root).dataset.studioDock).toBe('collapsed');
    expect(dockToggle(root).getAttribute('aria-expanded')).toBe('false');
    expect(dockToggle(root).getAttribute('aria-label')).toBe('Show the inspector');

    dockToggle(root).click();

    expect(controller.isDockExpanded()).toBe(true);
    expect(page(root).dataset.studioDock).toBe('expanded');
  });

  it('opens the camera sliders only when the disclosure is used', () => {
    const root = renderFixture();
    const controller = mount(root);

    hudToggle(root).click();

    expect(controller.isHudExpanded('camera')).toBe(true);
    expect(hudPanel(root).dataset.studioHud).toBe('expanded');
    expect(hudToggle(root).getAttribute('aria-expanded')).toBe('true');

    hudToggle(root).click();

    expect(controller.isHudExpanded('camera')).toBe(false);
    expect(hudPanel(root).dataset.studioHud).toBe('collapsed');
  });

  it('toggles the dock with the backtick shortcut', () => {
    const root = renderFixture();
    const controller = mount(root);

    pressBacktick(document.body);
    expect(controller.isDockExpanded()).toBe(false);

    pressBacktick(document.body);
    expect(controller.isDockExpanded()).toBe(true);
  });

  it('ignores the shortcut while typing and while the studio route is hidden', () => {
    const root = renderFixture();
    const controller = mount(root);

    pressBacktick(root.querySelector<HTMLInputElement>('#target-label')!);
    expect(controller.isDockExpanded()).toBe(true);

    page(root).hidden = true;
    pressBacktick(document.body);
    expect(controller.isDockExpanded()).toBe(true);
  });

  it('announces a resize so the 3D preview re-measures its container', () => {
    const root = renderFixture();
    const controller = mount(root);
    const resizes: Event[] = [];
    const listener = (event: Event): void => {
      resizes.push(event);
    };
    window.addEventListener('resize', listener);

    dockToggle(root).click();
    dockToggle(root).click();
    pressBacktick(document.body);
    controller.setDockExpanded(true);

    window.removeEventListener('resize', listener);
    expect(resizes).toHaveLength(4);
  });

  it('stops responding after dispose', () => {
    const root = renderFixture();
    const controller = mount(root);

    controller.dispose();
    dockToggle(root).click();
    pressBacktick(document.body);

    expect(page(root).dataset.studioDock).toBe('expanded');
  });

  it('does nothing when the studio markup is absent', () => {
    const root = document.createElement('div');
    document.body.append(root);

    const controller = mount(root);

    expect(controller.isDockExpanded()).toBe(true);
    expect(() => controller.dispose()).not.toThrow();
  });
});

function page(root: ParentNode): HTMLElement {
  return root.querySelector<HTMLElement>('.target-page')!;
}

function dockToggle(root: ParentNode): HTMLButtonElement {
  return root.querySelector<HTMLButtonElement>('[data-studio-dock-toggle]')!;
}

function hudToggle(root: ParentNode): HTMLButtonElement {
  return root.querySelector<HTMLButtonElement>('[data-studio-hud-toggle="camera"]')!;
}

function hudPanel(root: ParentNode): HTMLElement {
  return root.querySelector<HTMLElement>('[data-studio-hud-panel="camera"]')!;
}

function pressBacktick(target: HTMLElement): void {
  target.dispatchEvent(new KeyboardEvent('keydown', { key: '`', bubbles: true, cancelable: true }));
}

function renderFixture(): HTMLElement {
  const root = document.createElement('div');
  root.innerHTML = `
    <section class="page target-page">
      <div class="target-preview-shell">
        <div class="target-camera-view-controls" data-studio-hud-panel="camera" data-studio-hud="collapsed">
          <button type="button" data-studio-hud-toggle="camera" aria-expanded="false"></button>
          <div class="target-camera-view-grid"></div>
        </div>
        <button type="button" data-studio-dock-toggle aria-expanded="true" aria-label="Hide the inspector"></button>
      </div>
      <section class="target-inspector-card">
        <input id="target-label" type="text" />
      </section>
    </section>
  `;
  document.body.append(root);
  return root;
}
