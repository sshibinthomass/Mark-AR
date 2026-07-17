import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const tokensCss = readFileSync('src/styles/arvenilo-tokens.css', 'utf8');
const legacyCss = readFileSync('src/style.css', 'utf8');
const redesignCss = readFileSync('src/styles/arvenilo-redesign.css', 'utf8');

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

function winningDeclaration(
  element: Element,
  property: string,
  pseudo = '',
): string {
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

beforeEach(() => {
  document.head.innerHTML = `
    <style>${tokensCss}</style>
    <style>${legacyCss}</style>
    <style>${redesignCss}</style>
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
  document.head.innerHTML = '';
  document.body.innerHTML = '';
});

describe('AnchorAR route cascade precedence', () => {
  it('keeps scanner, floor, account, and Studio error states above legacy status rules', () => {
    expect(getComputedStyle(required('#ar-status')).color).toBe(resolvedColor('--color-error-dark'));
    expect(getComputedStyle(required('#floor-ar-status')).color).toBe(resolvedColor('--color-error-light'));
    expect(getComputedStyle(required('#worker-status')).color).toBe(resolvedColor('--color-error-dark'));
    expect(getComputedStyle(required('#image-target-status')).color).toBe(resolvedColor('--color-error-dark'));
  });

  it('keeps animation remove danger styling above the target button reset', () => {
    const remove = required<HTMLButtonElement>('.animation-track-remove');

    expect(getComputedStyle(remove).color).toBe(resolvedColor('--color-error-dark'));
    expect(getComputedStyle(remove).backgroundColor).toBe(resolvedColor('--color-interface-white'));
    expect(winningDeclaration(remove, 'background', ':hover')).toBe('var(--color-error-dark)');
  });

  it('canonicalizes Studio range, color, and file controls after legacy CSS', () => {
    const range = required<HTMLInputElement>('#range-control');
    const rangeAccent = getComputedStyle(range).accentColor;
    if (rangeAccent) {
      expect(rangeAccent).toBe(resolvedColor('--color-signal-mint'));
    } else {
      expect(winningDeclaration(range, 'accent-color')).toBe('var(--color-signal-mint)');
    }

    const color = getComputedStyle(required<HTMLInputElement>('#color-control'));
    expect(color.borderColor).toBe(resolvedColor('--color-border-light'));
    expect(color.borderRadius).toBe('10px');
    expect(color.backgroundColor).toBe(resolvedColor('--color-interface-white'));
    expect(color.boxShadow).toBe('none');

    const file = required<HTMLInputElement>('#file-control');
    expect(winningDeclaration(file, 'border-width', '::file-selector-button')).toBe('1px');
    expect(winningDeclaration(file, 'border-style', '::file-selector-button')).toBe('solid');
    expect(winningDeclaration(file, 'border-color', '::file-selector-button')).toBe(
      'var(--color-border-light)',
    );
    expect(winningDeclaration(file, 'border-radius', '::file-selector-button')).toBe(
      'var(--radius-control)',
    );
    expect(winningDeclaration(file, 'background', '::file-selector-button')).toBe(
      'var(--color-mint-wash)',
    );
    expect(winningDeclaration(file, 'color', '::file-selector-button')).toBe(
      'var(--color-spatial-ink)',
    );
    expect(winningDeclaration(file, 'box-shadow', '::file-selector-button')).toBe('none');
  });

  it('removes legacy teal from Studio summaries, outputs, saved URLs, and QR share code', () => {
    for (const selector of [
      '.transform-control-summary',
      '.target-text-advanced summary',
      '.animation-track-label output',
      '.saved-target-url',
    ]) {
      expect(getComputedStyle(required(selector)).color, selector).toBe(
        resolvedColor('--color-context-slate'),
      );
    }

    expect(getComputedStyle(required('.target-qr-share-link code')).color).toBe(
      resolvedColor('--color-spatial-ink'),
    );
  });
});
