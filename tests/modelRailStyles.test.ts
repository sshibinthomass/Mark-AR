import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync('src/style.css', 'utf8');

function cssRule(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`${escaped}\\s*\\{(?<body>[^}]*)\\}`, 'm').exec(css)?.groups?.body ?? '';
}

describe('target model rail styles', () => {
  it('keeps thumbnail cards as square aligned tiles', () => {
    const rail = cssRule('.target-model-rail');
    const card = cssRule('.target-model-card');
    const thumb = cssRule('.target-model-thumb');
    const label = cssRule('.target-model-card-label');

    expect(rail).toContain('--target-model-card-size: 96px');
    expect(rail).toContain('justify-items: center');
    expect(rail).toContain('grid-auto-rows: var(--target-model-card-size)');
    expect(rail).not.toContain('scrollbar-gutter');
    expect(card).toContain('aspect-ratio: 1 / 1');
    expect(card).toContain('place-items: center');
    expect(card).toContain('overflow: hidden');
    expect(thumb).toContain('width: 100%');
    expect(thumb).toContain('aspect-ratio: 1 / 1');
    expect(label).toContain('position: absolute');
    expect(label).toContain('clip-path: inset(50%)');
  });

  it('restores tile geometry after the broad target button rule', () => {
    const buttonRuleIndex = css.indexOf('.target-page button');
    const cardOverrideIndex = css.indexOf('.target-page .target-model-card');
    const cardOverride = cssRule('.target-page .target-model-card');

    expect(cardOverrideIndex).toBeGreaterThan(buttonRuleIndex);
    expect(cardOverride).toContain('width: var(--target-model-card-size)');
    expect(cardOverride).toContain('height: var(--target-model-card-size)');
    expect(cardOverride).toContain('padding: 6px');
    expect(cardOverride).toContain('font-size: 11px');
  });
});
