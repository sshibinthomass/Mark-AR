import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { selectorBody, mediaBlock as sourceMediaBlock } from './cssSource';

const css = readFileSync('src/styles/arvenilo.css', 'utf8');
const redesignCss = readFileSync('src/styles/arvenilo.css', 'utf8');

describe('target QR prompt styles', () => {
  it('uses a fixed, high-priority modal layer with a split desktop layout', () => {
    expect(cssRule('.target-qr-overlay')).toContain('position: fixed');
    expect(cssRule('.target-qr-overlay')).toContain('z-index: 100');
    expect(cssRule('.target-qr-overlay')).toContain('backdrop-filter: none');
    expect(cssRule('.target-qr-dialog')).toContain(
      'grid-template-columns: minmax(260px, 0.9fr) minmax(280px, 1.1fr)',
    );
    expect(cssRule('.target-qr-dialog')).toContain('animation: target-qr-dialog-enter');
  });

  it('gives the QR a square scanner frame and wraps all actions', () => {
    expect(cssRule('.target-qr-preview-shell')).toContain('aspect-ratio: 1 / 1');
    expect(cssRule('.target-qr-preview-shell')).toContain('background:');
    expect(cssRule('.target-qr-actions')).toContain('flex-wrap: wrap');
    expect(cssRule('.target-qr-actions')).toContain('grid-column: 1 / -1');
    expect(cssRule('.target-qr-share-status')).toContain('grid-column: 1 / -1');
  });

  it('replaces legacy glass and gradients with solid QR surfaces', () => {
    expect(cssRuleFrom(redesignCss, '.target-qr-overlay')).toContain('backdrop-filter: none');
    expect(cssRuleFrom(redesignCss, '.target-qr-dialog')).toContain(
      'background: var(--surface-band-raised)',
    );
    /* A modal is the one place the design system allows a lifted surface. */
    expect(cssRuleFrom(redesignCss, '.target-qr-dialog')).toContain(
      'box-shadow: var(--elevation-float)',
    );
    expect(cssRuleFrom(redesignCss, '.target-qr-preview-shell')).toContain(
      'background: var(--color-interface-white)',
    );
  });

  it('uses canonical QR typography and one meaningful Gold target detail', () => {
    const heading = cssRuleFrom(redesignCss, '.target-qr-dialog-copy h2');
    expect(heading).toContain('font-family: var(--font-display)');
    expect(heading).toContain('font-weight: 650');
    expect(cssRuleFrom(redesignCss, '.target-qr-target span')).toContain(
      'background: var(--color-anchor-gold)',
    );
    /* The legacy gradient bar is gone outright rather than neutralised. */
    expect(cssRuleFrom(redesignCss, '.target-qr-dialog::before')).toBe('');
  });

  it('shows QR errors and busy sharing with explicit semantic colors', () => {
    expect(cssRuleFrom(redesignCss, '.target-qr-error')).toContain(
      'color: var(--status-error)',
    );
    expect(cssRuleFrom(redesignCss, '.target-qr-share-status[data-tone="error"]')).toContain(
      'color: var(--status-error)',
    );
    expect(cssRuleFrom(redesignCss, '.target-qr-actions [aria-busy="true"]')).toContain(
      'cursor: progress',
    );
  });

  it('switches to one column on small screens and removes motion when requested', () => {
    expect(mediaBlock('(max-width: 767px)')).toMatch(
      /\.target-qr-dialog\s*\{[^}]*grid-template-columns:\s*1fr/m,
    );
    const reducedMotion = mediaBlock('(prefers-reduced-motion: reduce)');
    expect(cssRuleFrom(reducedMotion, '.target-qr-dialog')).toContain('animation: none');
    expect(cssRuleFrom(reducedMotion, '.target-qr-loading::before')).toContain('animation: none');

    const redesignReducedMotion = mediaBlockFrom(redesignCss, '(prefers-reduced-motion: reduce)');
    expect(cssRuleFrom(redesignReducedMotion, '.target-qr-dialog')).toContain('animation: none');
    expect(redesignReducedMotion).toMatch(
      /\.target-qr-loading::before,\s*\.target-model-card-loader::before,\s*\.target-preview-loader-spinner\s*\{[^}]*animation:\s*none/m,
    );
  });
});

function cssRuleFrom(source: string, selector: string): string {
  return selectorBody(selector, source);
}

function mediaBlockFrom(source: string, query: string): string {
  return sourceMediaBlock(query, source);
}

function cssRule(selector: string): string {
  return selectorBody(selector, css);
}

function mediaBlock(query: string): string {
  return sourceMediaBlock(query, css);
}
