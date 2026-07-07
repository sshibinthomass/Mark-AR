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
});
