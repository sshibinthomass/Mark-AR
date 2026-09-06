import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const tokensCss = readFileSync('src/styles/arvenilo-tokens.css', 'utf8');
const css = readFileSync('src/styles/arvenilo.css', 'utf8');

type Specificity = [number, number, number];

function compareSpecificity(left: Specificity, right: Specificity): number {
  for (let index = 0; index < left.length; index += 1) {
    const difference = left[index] - right[index];
    if (difference !== 0) {
      return difference;
    }
  }
  return 0;
}

function selectorSpecificity(selector: string): Specificity {
  const expanded = selector.replace(/:not\(([^)]*)\)/g, ' $1');
  const ids = expanded.match(/#[\w-]+/g)?.length ?? 0;
  const classes = expanded.match(/\.[\w-]+|\[[^\]]+\]|:(?!:)[\w-]+/g)?.length ?? 0;
  const elements = expanded
    .replace(/#[\w-]+|\.[\w-]+|\[[^\]]+\]|::?[\w-]+(?:\([^)]*\))?/g, ' ')
    .match(/(?:^|[\s>+~])([a-z][\w-]*)/gi)?.length ?? 0;
  return [ids, classes, elements];
}

/**
 * Pseudo-element declarations are out of reach of getComputedStyle here, so the
 * winning rule is resolved from the stylesheet directly.
 */
function winningDeclaration(element: Element, property: string, pseudo = ''): string {
  let winner: { order: number; specificity: Specificity; value: string } | undefined;
  let order = 0;

  for (const sheet of Array.from(document.styleSheets)) {
    for (const rule of Array.from(sheet.cssRules)) {
      if (!('selectorText' in rule) || !('style' in rule)) {
        continue;
      }

      for (const selector of String(rule.selectorText).split(',')) {
        const candidate = selector.trim();
        const hasRequestedPseudo = pseudo ? candidate.includes(pseudo) : !candidate.includes('::');
        const matchable = pseudo ? candidate.replace(pseudo, '') : candidate;
        const value = rule.style.getPropertyValue(property).trim();
        order += 1;

        if (!hasRequestedPseudo || !value) {
          continue;
        }

        try {
          if (!element.matches(matchable)) {
            continue;
          }
        } catch {
          continue;
        }

        const specificity = selectorSpecificity(candidate);
        if (!winner
          || compareSpecificity(specificity, winner.specificity) > 0
          || (compareSpecificity(specificity, winner.specificity) === 0 && order > winner.order)) {
          winner = { order, specificity, value };
        }
      }
    }
  }

  return winner?.value ?? '';
}

function resolvedColor(variable: string): string {
  const probe = document.createElement('span');
  probe.style.color = `var(${variable})`;
  document.body.append(probe);
  const color = getComputedStyle(probe).color;
  probe.remove();
  return color;
}

function required<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Fixture element missing: ${selector}`);
  }
  return element;
}

function useLightTheme(): void {
  document.documentElement.setAttribute('data-theme', 'light');
}

beforeEach(() => {
  document.head.innerHTML = `
    <style>${tokensCss}</style>
    <style>${css}</style>
  `;
  document.body.innerHTML = `
    <main class="target-page">
      <section class="scanner-controls"><p id="ar-status" data-tone="error">Camera failed</p></section>
      <section class="floor-ar-controls"><p id="floor-ar-status" data-tone="error">Floor failed</p></section>
      <section class="tool-card-head"><p>Account</p><p id="worker-status" data-tone="error">Sign-in failed</p></section>
      <section class="tool-card-head"><p>Studio</p><p id="image-target-status" class="is-error">Save failed</p></section>

      <button class="animation-track-remove" type="button">Remove</button>
      <label class="target-text-options"><input id="range-control" type="range"></label>
      <label class="target-text-color-control"><input id="color-control" type="color"></label>
      <label class="file-control"><input id="file-control" type="file"></label>

      <details><summary class="transform-control-summary">Transform</summary></details>
      <details class="target-text-advanced"><summary>Text options</summary></details>
      <label class="animation-track-label"><output>1.0</output></label>
      <code class="saved-target-url">https://example.test/scan</code>
    </main>
    <section class="target-qr-share-link"><code>https://example.test/share</code></section>
  `;
});

afterEach(() => {
  document.documentElement.removeAttribute('data-theme');
  document.head.innerHTML = '';
  document.body.innerHTML = '';
});

describe('AnchorAR theme contract', () => {
  it('tones page-level errors for the dark ground by default', () => {
    const errorOnDark = resolvedColor('--color-error-light');

    expect(getComputedStyle(required('#ar-status')).color).toBe(errorOnDark);
    expect(getComputedStyle(required('#worker-status')).color).toBe(errorOnDark);
    expect(getComputedStyle(required('#image-target-status')).color).toBe(errorOnDark);
  });

  it('flips page-level errors to the dark red once the light theme is chosen', () => {
    useLightTheme();
    const errorOnLight = resolvedColor('--color-error-dark');

    expect(getComputedStyle(required('#ar-status')).color).toBe(errorOnLight);
    expect(getComputedStyle(required('#worker-status')).color).toBe(errorOnLight);
    expect(getComputedStyle(required('#image-target-status')).color).toBe(errorOnLight);
  });

  it('keeps the AR overlay error light in both themes because its ground never changes', () => {
    const errorOnDark = resolvedColor('--color-error-light');
    expect(getComputedStyle(required('#floor-ar-status')).color).toBe(errorOnDark);

    useLightTheme();
    expect(getComputedStyle(required('#floor-ar-status')).color).toBe(
      resolvedColor('--color-error-light'),
    );
  });

  it('keeps animation remove readable as danger on either ground', () => {
    const remove = required<HTMLButtonElement>('.animation-track-remove');

    expect(getComputedStyle(remove).color).toBe(resolvedColor('--status-error'));
    expect(winningDeclaration(remove, 'background', ':hover')).toBe('var(--status-error)');

    useLightTheme();
    expect(getComputedStyle(remove).color).toBe(resolvedColor('--color-error-dark'));
  });

  it('canonicalizes Studio range, color, and file controls', () => {
    const range = required<HTMLInputElement>('#range-control');
    const rangeAccent = getComputedStyle(range).accentColor;
    if (rangeAccent) {
      expect(rangeAccent).toBe(resolvedColor('--color-signal-mint'));
    } else {
      expect(winningDeclaration(range, 'accent-color')).toBe('var(--color-signal-mint)');
    }

    const color = getComputedStyle(required<HTMLInputElement>('#color-control'));
    expect(color.borderColor).toBe(resolvedColor('--line-soft'));
    expect(color.borderRadius).toBe('10px');
    expect(color.backgroundColor).toBe(resolvedColor('--surface-panel'));
    expect(color.boxShadow).toBe('none');

    const file = required<HTMLInputElement>('#file-control');
    expect(winningDeclaration(file, 'border-width', '::file-selector-button')).toBe('1px');
    expect(winningDeclaration(file, 'border-style', '::file-selector-button')).toBe('solid');
    expect(winningDeclaration(file, 'border-color', '::file-selector-button')).toBe(
      'var(--line-soft)',
    );
    expect(winningDeclaration(file, 'border-radius', '::file-selector-button')).toBe(
      'var(--radius-control)',
    );
    expect(winningDeclaration(file, 'background', '::file-selector-button')).toBe(
      'var(--accent-wash)',
    );
    expect(winningDeclaration(file, 'color', '::file-selector-button')).toBe('var(--text-primary)');
    expect(winningDeclaration(file, 'box-shadow', '::file-selector-button')).toBe('none');
  });

  it('gives Studio summaries, outputs, and saved URLs the secondary text tone', () => {
    for (const selector of [
      '.transform-control-summary',
      '.target-text-advanced summary',
      '.animation-track-label output',
      '.saved-target-url',
    ]) {
      expect(getComputedStyle(required(selector)).color, selector).toBe(
        resolvedColor('--text-secondary'),
      );
    }

    expect(getComputedStyle(required('.target-qr-share-link code')).color).toBe(
      resolvedColor('--text-primary'),
    );
  });

  it('darkens secondary text when the light theme is chosen', () => {
    useLightTheme();

    expect(getComputedStyle(required('.transform-control-summary')).color).toBe(
      resolvedColor('--color-context-slate'),
    );
    expect(getComputedStyle(required('.target-qr-share-link code')).color).toBe(
      resolvedColor('--color-spatial-ink'),
    );
  });
});
