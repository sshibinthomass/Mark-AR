import { describe, expect, it } from 'vitest';
import { renderAppShell } from '../src/ui/appShell';

describe('renderAppShell', () => {
  it('renders the target-focused workflow', () => {
    const container = document.createElement('div');
    container.innerHTML = renderAppShell();
    const html = container.innerHTML;

    expect(
      [...container.querySelectorAll<HTMLAnchorElement>('.route-tabs a')].map((link) => ({
        route: link.dataset.routeLink,
        href: link.getAttribute('href'),
        text: link.textContent?.trim(),
        hasIcon: Boolean(link.querySelector('.route-icon')),
      })),
    ).toEqual([
      { route: 'home', href: '#/', text: 'Home', hasIcon: true },
      { route: 'scan', href: '#/scan', text: 'Scan', hasIcon: true },
      { route: 'targets', href: '#/account', text: 'Targets', hasIcon: true },
      { route: 'account', href: '#/account', text: 'Sign in', hasIcon: true },
    ]);
    expect(
      [...container.querySelectorAll<HTMLElement>('[data-page-heading]')].map((heading) => ({
        id: heading.id,
        text: heading.textContent?.trim(),
        tabIndex: heading.tabIndex,
      })),
    ).toEqual([
      { id: 'home-page-title', text: 'Marker AR studio', tabIndex: -1 },
      { id: 'scan-page-title', text: 'Scan target', tabIndex: -1 },
      { id: 'targets-page-title', text: 'Image targets', tabIndex: -1 },
      { id: 'account-page-title', text: 'Account', tabIndex: -1 },
    ]);
    expect(
      [...container.querySelectorAll<HTMLAnchorElement>('.page-home-link')].map((link) => ({
        href: link.getAttribute('href'),
        text: link.textContent?.trim(),
      })),
    ).toEqual([
      { href: '#/', text: 'Home' },
      { href: '#/', text: 'Home' },
      { href: '#/', text: 'Home' },
    ]);
    expect(
      [...container.querySelectorAll<HTMLElement>('.mode-card strong')].map((title) => title.textContent?.trim()),
    ).toEqual(['Scan target', 'Image targets', 'Account']);
    expect(
      [...container.querySelectorAll<HTMLElement>('[data-page]')].map((page) => page.dataset.page),
    ).toEqual(['home', 'scan', 'targets', 'account']);
    expect(layoutOrder(container, '.landing-inner')).toEqual([
      'landing-copy',
      'landing-flow',
      'landing-preview',
      'mode-picker',
    ]);
    expect(layoutOrder(container, '.scanner-panel')).toEqual([
      'scanner-stage',
      'scanner-controls',
    ]);
    expect(layoutOrder(container, '.target-workspace')).toEqual([
      'target-preview',
      'target-inspector',
    ]);
    expect(layoutOrder(container, '.auth-layout')).toEqual([
      'auth-access',
      'auth-controls',
    ]);
    expect(container.querySelector('[data-page="targets"]')).toBeTruthy();
    const protectedLinks = [...container.querySelectorAll<HTMLAnchorElement>('[data-auth-protected]')];
    expect(protectedLinks).toHaveLength(2);
    expect(protectedLinks.every((link) => link.dataset.unlockedHref === '#/targets')).toBe(true);
    expect(protectedLinks.every((link) => link.getAttribute('href') === '#/account')).toBe(true);
    expect(protectedLinks.every((link) => link.getAttribute('aria-disabled') === 'true')).toBe(true);
    expect(container.querySelector('[data-auth-account-label]')?.textContent).toBe('Sign in');
    expect(container.querySelector('[data-auth-access-label]')?.textContent).toBe('Locked');
    expect(container.querySelector('[data-auth-panel="signed-out"]')?.hasAttribute('hidden')).toBe(false);
    expect(container.querySelector('[data-auth-panel="checking"]')?.hasAttribute('hidden')).toBe(true);
    expect(container.querySelector('[data-auth-panel="signed-in"]')?.hasAttribute('hidden')).toBe(true);
    expect(container.querySelector('#worker-login-form')?.closest('[data-auth-panel="signed-out"]')).toBeTruthy();
    expect(container.querySelector('[data-auth-form-mode]')?.getAttribute('data-auth-form-mode')).toBe('login');
    expect(container.querySelectorAll('[data-auth-mode]')).toHaveLength(2);
    expect(container.querySelector('.auth-mode-switch')?.getAttribute('role')).toBe('group');
    expect(container.querySelector('[data-auth-mode="login"]')?.getAttribute('aria-pressed')).toBe('true');
    expect(container.querySelector('[data-auth-mode="signup"]')?.getAttribute('aria-pressed')).toBe('false');
    expect((container.querySelector('[data-auth-mode="login"]') as HTMLButtonElement).tabIndex).toBe(0);
    expect((container.querySelector('[data-auth-mode="signup"]') as HTMLButtonElement).tabIndex).toBe(0);
    expect(container.querySelector('[data-auth-name-field]')?.hasAttribute('hidden')).toBe(true);
    expect((container.querySelector('#worker-name') as HTMLInputElement).disabled).toBe(true);
    expect((container.querySelector('#worker-password') as HTMLInputElement).minLength).toBe(8);
    expect(container.querySelector('[data-auth-submit-label]')?.textContent).toBe('Sign in');
    expect(container.querySelector('#worker-logout')?.closest('[data-auth-panel="signed-in"]')).toBeTruthy();
    expect(container.querySelector('#worker-logout')?.closest('#worker-login-form')).toBeNull();
    expect(container.querySelector('[data-auth-email]')).toBeTruthy();
    expect(container.querySelector('[data-auth-open-targets]')?.getAttribute('href')).toBe('#/targets');
    expect(html).toContain('id="ar-stage"');
    expect(html).toContain('id="start-ar"');
    const scannerPanel = container.querySelector('.scanner-panel');
    const scannerStageStack = container.querySelector('.scanner-stage-stack');
    const scannerControls = container.querySelector('.scanner-controls');
    const markerStage = container.querySelector('#ar-stage');
    const floorStage = container.querySelector('#floor-ar-stage');
    const floorOverlay = container.querySelector('#floor-ar-overlay');
    const floorBack = container.querySelector<HTMLButtonElement>('#floor-ar-back');
    expect(container.querySelectorAll('#floor-ar-stage')).toHaveLength(1);
    expect(container.querySelectorAll('#floor-ar-overlay')).toHaveLength(1);
    expect(scannerStageStack?.parentElement).toBe(scannerPanel);
    expect(scannerControls?.parentElement).toBe(scannerPanel);
    expect(markerStage?.parentElement).toBe(scannerStageStack);
    expect(floorStage?.parentElement).toBe(scannerStageStack);
    expect(floorOverlay?.parentElement).toBe(scannerStageStack);
    expect([...(scannerStageStack?.children ?? [])]).toEqual([markerStage, floorStage, floorOverlay]);
    expect(floorOverlay?.firstElementChild).toBe(floorBack);
    expect(scannerStageStack?.contains(scannerControls)).toBe(false);
    expect(floorOverlay?.closest('#ar-stage')).toBeNull();
    expect(floorStage?.hasAttribute('hidden')).toBe(true);
    expect(floorOverlay?.hasAttribute('hidden')).toBe(true);
    expect(floorBack).toMatchObject({
      hidden: true,
      textContent: 'Back to image scan',
    });
    expect(container.querySelector('#floor-ar-toggle')?.textContent?.trim()).toBe('Place on floor');
    expect(container.querySelector('#floor-ar-toggle')?.hasAttribute('hidden')).toBe(true);
    expect(container.querySelector('#start-ar')?.closest('.scanner-actions')).toBeTruthy();
    expect(container.querySelector('#floor-ar-toggle')?.closest('.scanner-actions')).toBeTruthy();
    expect((container.querySelector('#floor-ar-place') as HTMLButtonElement).disabled).toBe(true);
    expect(container.querySelector('#floor-ar-reset')?.textContent?.trim()).toBe('Reset');
    expect(container.querySelector('#floor-ar-restart')?.textContent?.trim()).toBe('Restart floor AR');
    expect((container.querySelector('#floor-ar-rotation') as HTMLInputElement).type).toBe('range');
    expect(container.querySelector('#floor-ar-message')?.closest('[aria-live="polite"]')).toBeTruthy();
    expect(html).toContain('id="worker-email"');
    expect(container.querySelector('#target-image-file')).toBeTruthy();
    expect(container.querySelector('#target-model-select')).toBeTruthy();
    expect(container.querySelector('#target-model-select')?.closest('label')?.hasAttribute('hidden')).toBe(true);
    expect(container.querySelector('#target-model-rail')).toBeTruthy();
    expect(container.querySelector('#target-model-rail')?.closest('.target-preview-shell')).toBeTruthy();
    expect(
      [...container.querySelectorAll<HTMLElement>('[data-target-inspector-tab]')].map((tab) => (
        tab.dataset.targetInspectorTab
      )),
    ).toEqual(['target', 'objects', 'text', 'object-controls']);
    expect(container.querySelector('[data-target-inspector-tab="target"]')?.getAttribute('aria-selected')).toBe('true');
    expect(container.querySelector('[data-target-inspector-tab="object-controls"]')?.getAttribute('aria-disabled')).toBe('true');
    expect(container.querySelector('[data-target-inspector-tab="object-controls"]')?.hasAttribute('disabled')).toBe(true);
    expect(container.querySelector('[data-target-inspector-panel="target"]')?.hasAttribute('hidden')).toBe(false);
    expect(container.querySelector('[data-target-inspector-panel="objects"]')?.hasAttribute('hidden')).toBe(true);
    expect(container.querySelector('[data-target-inspector-panel="text"]')?.hasAttribute('hidden')).toBe(true);
    expect(container.querySelector('[data-target-inspector-panel="object-controls"]')?.hasAttribute('hidden')).toBe(true);
    expect(container.querySelector('[data-target-inspector-panel="animation"]')).toBeNull();
    expect(container.querySelector('#add-target-object')).toBeNull();
    expect(container.querySelector('#remove-target-object')).toBeNull();
    expect(container.querySelector('#target-object-list')).toBeTruthy();
    expect(container.querySelector('#target-object-list')?.closest('[data-target-inspector-panel="objects"]')).toBeTruthy();
    const groupSelected = container.querySelector<HTMLButtonElement>('#group-selected-objects');
    expect(groupSelected).toBeTruthy();
    expect(groupSelected?.disabled).toBe(true);
    expect(groupSelected?.textContent?.trim()).toBe('Group selected');
    expect(groupSelected?.closest('[data-target-inspector-panel="objects"]')).toBeTruthy();
    expect(container.querySelector('#target-text-value')).toBeTruthy();
    expect(container.querySelector('#target-text-value')?.closest('[data-target-inspector-panel="text"]')).toBeTruthy();
    expect(container.querySelector('.target-text-advanced')?.closest('[data-target-inspector-panel="text"]')).toBeNull();
    expect(container.querySelector('.target-text-advanced')?.closest('[data-target-inspector-panel="object-controls"]')).toBeTruthy();
    expect(container.querySelector('.target-text-advanced')?.hasAttribute('hidden')).toBe(true);
    expect(container.querySelector('.target-text-advanced')?.hasAttribute('open')).toBe(false);
    expect(container.querySelector('#target-text-language')).toBeTruthy();
    expect(container.querySelector('#target-text-language option[value="english"]')).toBeTruthy();
    expect(container.querySelector('#target-text-language option[value="german"]')).toBeTruthy();
    expect(container.querySelector('#target-text-language option[value="tamil"]')).toBeTruthy();
    expect(container.querySelector('#target-text-font')).toBeTruthy();
    expect(container.querySelector('#target-text-font option[value="studio-sans"]')).toBeTruthy();
    expect(container.querySelector('#target-text-font option[value="studio-sans-bold"]')).toBeTruthy();
    expect(container.querySelector('#target-text-font option[value="studio-serif"]')).toBeTruthy();
    expect(container.querySelector('#target-text-font option[value="studio-serif-bold"]')).toBeTruthy();
    expect(container.querySelector('#target-text-font option[value="droid-serif"]')).toBeTruthy();
    expect(container.querySelector('#target-text-font option[value="droid-serif-bold"]')).toBeTruthy();
    expect(container.querySelector('#target-text-font option[value="optimer"]')).toBeTruthy();
    expect(container.querySelector('#target-text-font option[value="optimer-bold"]')).toBeTruthy();
    expect(container.querySelector('#target-text-font option[value="helvetiker"]')).toBeTruthy();
    expect(container.querySelector('#target-text-font option[value="helvetiker-bold"]')).toBeTruthy();
    expect(container.querySelector('#target-text-font option[value="studio-mono"]')).toBeTruthy();
    expect(container.querySelector('#target-text-font option[value="tamil-ui"]')).toBeTruthy();
    expect(container.querySelector('#target-text-preset')).toBeTruthy();
    expect(container.querySelector('#target-text-preset option[value="gold-bevel"]')).toBeTruthy();
    expect(container.querySelector('#target-text-fill-mode')).toBeTruthy();
    expect(container.querySelector('#target-text-fill-mode')?.closest('.target-text-advanced')).toBeTruthy();
    expect(container.querySelector('#target-text-fill-mode')?.closest('[data-target-inspector-panel="object-controls"]')).toBeTruthy();
    expect(container.querySelector('#target-text-fill-mode option[value="solid"]')).toBeTruthy();
    expect(container.querySelector('#target-text-fill-mode option[value="gradient"]')).toBeTruthy();
    expect(container.querySelector('#target-text-color')).toBeTruthy();
    expect((container.querySelector('#target-text-color') as HTMLInputElement).type).toBe('color');
    expect(container.querySelector('#target-text-gradient-start')).toBeTruthy();
    expect(container.querySelector('#target-text-gradient-end')).toBeTruthy();
    expect(container.querySelector('#target-text-gradient-direction')).toBeTruthy();
    expect(container.querySelector('#target-text-gradient-direction option[value="depth"]')).toBeTruthy();
    expect(container.querySelector('#target-text-side-color')).toBeTruthy();
    expect(container.querySelector('#target-text-depth')).toBeTruthy();
    expect(container.querySelector('#target-text-bevel')).toBeTruthy();
    expect(container.querySelector('#target-text-gloss')).toBeTruthy();
    expect(container.querySelector('#add-target-text')).toBeTruthy();
    expect(container.querySelector('#target-scale')).toBeTruthy();
    expect(container.querySelector('#target-scale')?.closest('[data-target-inspector-panel="object-controls"]')).toBeTruthy();
    expect(container.querySelector('#target-scale-x')).toBeNull();
    expect(container.querySelector('#target-scale-y')).toBeNull();
    expect(container.querySelector('#target-scale-z')).toBeNull();
    expect(container.querySelector('#target-rotation-x')).toBeTruthy();
    expect(container.querySelector('#target-rotation-y')).toBeTruthy();
    expect(container.querySelector('#target-rotation-z')).toBeTruthy();
    expect(container.querySelector('[data-reset-transform="move"][data-reset-axis="all"]')).toBeTruthy();
    expect(container.querySelector('[data-reset-transform="move"][data-reset-axis="x"]')).toBeTruthy();
    expect(container.querySelector('[data-reset-transform="move"][data-reset-axis="y"]')).toBeTruthy();
    expect(container.querySelector('[data-reset-transform="move"][data-reset-axis="z"]')).toBeTruthy();
    expect(container.querySelector('[data-reset-transform="rotate"][data-reset-axis="all"]')).toBeTruthy();
    expect(container.querySelector('[data-reset-transform="rotate"][data-reset-axis="x"]')).toBeTruthy();
    expect(container.querySelector('[data-reset-transform="rotate"][data-reset-axis="y"]')).toBeTruthy();
    expect(container.querySelector('[data-reset-transform="rotate"][data-reset-axis="z"]')).toBeTruthy();
    expect(container.querySelector('[data-reset-transform="scale"][data-reset-axis="all"]')).toBeTruthy();
    expect(container.querySelector('[data-reset-transform="scale"][data-reset-axis="x"]')).toBeNull();
    expect(container.querySelector('[data-reset-transform="scale"][data-reset-axis="y"]')).toBeNull();
    expect(container.querySelector('[data-reset-transform="scale"][data-reset-axis="z"]')).toBeNull();
    expect(container.querySelector('.transform-control-group[data-control-group="move"]')?.tagName).toBe('DETAILS');
    expect(container.querySelector('.transform-control-group[data-control-group="rotate"]')?.tagName).toBe('DETAILS');
    expect(container.querySelector('.transform-control-group[data-control-group="scale"]')?.tagName).toBe('DETAILS');
    expect(container.querySelector('.transform-control-group[data-control-group="animation"]')?.tagName).toBe('DETAILS');
    expect(
      [...container.querySelectorAll<HTMLDetailsElement>('.transform-control-group')]
        .map((group) => [group.dataset.controlGroup, group.hasAttribute('open')]),
    ).toEqual([
      ['move', false],
      ['rotate', false],
      ['scale', false],
      ['animation', false],
    ]);
    expect(container.querySelector('[data-transform-mode="translate"]')).toBeTruthy();
    expect(container.querySelector('[data-transform-mode="rotate"]')).toBeTruthy();
    expect(container.querySelector('[data-transform-mode="scale"]')).toBeTruthy();
    expect(container.querySelector('#target-camera-distance')).toBeTruthy();
    expect(container.querySelector('#target-camera-height')).toBeTruthy();
    expect(container.querySelector('#target-camera-yaw')).toBeTruthy();
    const cameraViewControls = container.querySelector('.target-camera-view-controls');
    const cameraViewHead = container.querySelector('.target-camera-view-head');
    const previewControls = container.querySelector('.target-preview-controls');
    const targetPreviewShell = container.querySelector('.target-preview-shell');
    const transformToolbar = container.querySelector('.target-transform-toolbar');
    expect(cameraViewControls?.closest('.target-preview-shell')).toBe(targetPreviewShell);
    expect(cameraViewControls?.closest('[data-target-inspector-panel="object-controls"]')).toBeNull();
    expect(cameraViewControls?.closest('.target-preview-controls')).toBe(previewControls);
    expect(transformToolbar?.closest('.target-preview-controls')).toBe(previewControls);
    expect(previewControls && transformToolbar && cameraViewControls
      ? [...previewControls.children].indexOf(transformToolbar) <
          [...previewControls.children].indexOf(cameraViewControls)
      : false).toBe(true);
    expect(container.querySelector('#target-camera-gizmo')).toBeNull();
    const cameraArrows = [...container.querySelectorAll<HTMLButtonElement>('[data-camera-orbit]')];
    expect(cameraArrows).toEqual([]);
    const cameraPresetButtons = [...container.querySelectorAll<HTMLButtonElement>('[data-camera-preset]')];
    expect(cameraViewControls?.firstElementChild).toBe(cameraViewHead);
    expect(cameraViewHead?.querySelector('.eyebrow')?.textContent?.trim()).toBe('Camera view');
    expect(cameraViewHead?.querySelector('.target-camera-preset-row')).toBeTruthy();
    expect(cameraPresetButtons.every((button) => button.closest('.target-camera-view-head'))).toBe(true);
    expect(
      cameraViewControls && cameraViewHead
        ? [...cameraViewControls.children].indexOf(cameraViewHead) <
            [...cameraViewControls.children].indexOf(container.querySelector('.target-camera-view-grid') as Element)
        : false,
    ).toBe(true);
    expect(cameraPresetButtons.map((button) => button.dataset.cameraPreset)).toEqual([
      'reset',
      'front',
      'left',
      'right',
      'top',
    ]);
    expect(cameraPresetButtons.map((button) => button.textContent?.trim())).toEqual([
      'Reset',
      'Front',
      'Left',
      'Right',
      'Top',
    ]);
    expect(cameraPresetButtons.every((button) => button.closest('.target-camera-view-controls'))).toBe(true);
    const animationPreset = container.querySelector<HTMLSelectElement>('#target-animation-preset');
    expect(animationPreset).toBeTruthy();
    expect(animationPreset?.closest('[data-target-inspector-panel="object-controls"]')).toBeTruthy();
    expect(Array.from(animationPreset?.options ?? []).map((option) => option.textContent)).toEqual([
      'Mixed',
      'None',
      'Gentle float',
      'Turntable',
      'Showcase',
      'Sway',
      'Pulse',
      'Orbit',
      'Bounce',
      'Custom',
    ]);
    expect(animationPreset?.value).toBe('none');
    expect(container.querySelector('#target-animation-tracks')).toBeTruthy();
    expect(container.querySelector('#add-target-animation-track')?.textContent).toContain('Add motion');
    expect(container.querySelector('#reset-target-animation')).toBeTruthy();
    expect(container.querySelector('#reset-target-animation')?.closest('[data-target-inspector-panel="object-controls"]')).toBeTruthy();
    expect(container.querySelector('#target-preview-stage')).toBeTruthy();
    expect(container.querySelector('#save-image-target')).toBeTruthy();
    const targetAccessMode = container.querySelector<HTMLSelectElement>('#target-access-mode');
    expect(targetAccessMode).toBeTruthy();
    expect(Array.from(targetAccessMode?.options ?? []).map((option) => [option.value, option.textContent])).toEqual([
      ['owner_only', 'Only me'],
      ['any_signed_in', 'Any signed-in user'],
      ['anyone_with_link', 'Anyone with the link'],
      ['specific_accounts', 'Specific accounts'],
    ]);
    expect(targetAccessMode?.value).toBe('owner_only');
    expect(container.querySelector('#target-access-emails')).toBeTruthy();
    expect(container.querySelector('#target-access-emails-field')?.hasAttribute('hidden')).toBe(true);
    expect(container.querySelector('#new-image-target')).toBeTruthy();
    expect(container.querySelector('#saved-image-target-list')).toBeTruthy();
    expect(container.querySelector('#saved-image-target-list')?.closest('[data-target-inspector-panel="target"]')).toBeTruthy();
    expect(html).toContain('Marker AR studio');
    expect(html).toContain('Web-AR Worker');
  });
});

function layoutOrder(root: ParentNode, selector: string): string[] {
  return [...root.querySelector(selector)!.children]
    .map((element) => (element as HTMLElement).dataset.layoutRole!)
    .filter(Boolean);
}
