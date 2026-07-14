import { describe, expect, it } from 'vitest';
import { setupTargetInspectorTabs } from '../src/ui/targetInspectorTabs';

describe('setupTargetInspectorTabs', () => {
  it('switches inspector tab buttons and panels without moving form state', () => {
    const root = document.createElement('div');
    root.innerHTML = `
      <button data-target-inspector-tab="target" aria-selected="true" aria-controls="target-panel">Target</button>
      <button data-target-inspector-tab="text" aria-selected="false" aria-controls="text-panel">Text</button>
      <section id="target-panel" data-target-inspector-panel="target">
        <input id="target-label" value="poster" />
      </section>
      <section id="text-panel" data-target-inspector-panel="text" hidden>
        <textarea id="target-text-value">Hello AR</textarea>
      </section>
    `;

    setupTargetInspectorTabs(root);
    root.querySelector<HTMLButtonElement>('[data-target-inspector-tab="text"]')?.click();

    expect(root.querySelector('[data-target-inspector-tab="target"]')?.getAttribute('aria-selected')).toBe('false');
    expect(root.querySelector('[data-target-inspector-tab="text"]')?.getAttribute('aria-selected')).toBe('true');
    expect(root.querySelector('[data-target-inspector-panel="target"]')?.hasAttribute('hidden')).toBe(true);
    expect(root.querySelector('[data-target-inspector-panel="text"]')?.hasAttribute('hidden')).toBe(false);
    expect((root.querySelector('#target-label') as HTMLInputElement).value).toBe('poster');
    expect((root.querySelector('#target-text-value') as HTMLTextAreaElement).value).toBe('Hello AR');
  });

  it('does not activate disabled object controls until they are enabled programmatically', () => {
    const root = document.createElement('div');
    root.innerHTML = `
      <button data-target-inspector-tab="target" aria-selected="true" aria-controls="target-panel">Target</button>
      <button data-target-inspector-tab="object-controls" aria-selected="false" aria-controls="object-controls-panel" disabled aria-disabled="true">Object</button>
      <section id="target-panel" data-target-inspector-panel="target">Target settings</section>
      <section id="object-controls-panel" data-target-inspector-panel="object-controls" hidden>Object controls</section>
    `;

    const inspector = setupTargetInspectorTabs(root);
    root.querySelector<HTMLButtonElement>('[data-target-inspector-tab="object-controls"]')?.click();

    expect(root.querySelector('[data-target-inspector-tab="target"]')?.getAttribute('aria-selected')).toBe('true');
    expect(root.querySelector('[data-target-inspector-panel="object-controls"]')?.hasAttribute('hidden')).toBe(true);

    inspector.setTabEnabled('object-controls', true);
    inspector.activate('object-controls');

    expect(root.querySelector('[data-target-inspector-tab="target"]')?.getAttribute('aria-selected')).toBe('false');
    expect(root.querySelector('[data-target-inspector-tab="object-controls"]')?.getAttribute('aria-selected')).toBe('true');
    expect(root.querySelector('[data-target-inspector-tab="object-controls"]')?.hasAttribute('disabled')).toBe(false);
    expect(root.querySelector('[data-target-inspector-tab="object-controls"]')?.getAttribute('aria-disabled')).toBe('false');
    expect(root.querySelector('[data-target-inspector-panel="target"]')?.hasAttribute('hidden')).toBe(true);
    expect(root.querySelector('[data-target-inspector-panel="object-controls"]')?.hasAttribute('hidden')).toBe(false);
  });

  it('updates a tab label for the current selection context', () => {
    const root = document.createElement('div');
    root.innerHTML = `
      <button data-target-inspector-tab="object-controls">Object</button>
      <section data-target-inspector-panel="object-controls"></section>
    `;
    const inspector = setupTargetInspectorTabs(root);

    inspector.setTabLabel('object-controls', 'Selection (3)');

    expect(root.querySelector('[data-target-inspector-tab="object-controls"]')?.textContent).toBe('Selection (3)');
  });
});
