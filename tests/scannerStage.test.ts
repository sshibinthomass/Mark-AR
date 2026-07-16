import { describe, expect, it } from 'vitest';
import {
  prepareScannerStage,
  resetScannerStage,
  setScannerGuideVisible,
} from '../src/ui/scannerStage';

describe('scanner stage', () => {
  it('creates one decorative scanner guide inside the camera stage', () => {
    const stage = document.createElement('div');
    stage.innerHTML = '<div class="stage-idle"><span>Scan target</span></div>';

    const guide = prepareScannerStage(stage);
    prepareScannerStage(stage);

    expect(stage.querySelectorAll('[data-scanner-guide]')).toHaveLength(1);
    expect(stage.firstElementChild).toBe(stage.querySelector('[data-scanner-guide]'));
    expect(guide.getAttribute('aria-hidden')).toBe('true');
    expect(guide.querySelector('.scanner-guide-frame')).toBeTruthy();
    expect(guide.querySelector('.scanner-guide-line')).toBeTruthy();
  });

  it('hides the guide while a target is visible and shows it while scanning', () => {
    const stage = document.createElement('div');
    prepareScannerStage(stage);

    setScannerGuideVisible(stage, false);
    expect(stage.querySelector<HTMLElement>('[data-scanner-guide]')?.hidden).toBe(true);

    setScannerGuideVisible(stage, true);
    expect(stage.querySelector<HTMLElement>('[data-scanner-guide]')?.hidden).toBe(false);
  });

  it('restores the idle placeholder and removes active scanner content', () => {
    const stage = document.createElement('div');
    prepareScannerStage(stage);
    stage.append(document.createElement('video'), document.createElement('canvas'));

    resetScannerStage(stage);

    expect(stage.querySelector('[data-scanner-guide]')).toBeNull();
    expect(stage.querySelector('video')).toBeNull();
    expect(stage.querySelector('canvas')).toBeNull();
    expect(stage.querySelector('.stage-idle')?.textContent).toBe('Scan target');
  });
});
