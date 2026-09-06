import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_THEME,
  THEME_STORAGE_KEY,
  applyTheme,
  currentTheme,
  initTheme,
  isThemeName,
  otherTheme,
  readStoredTheme,
  resolveInitialTheme,
  syncThemeToggle,
  themeToggleLabel,
  writeStoredTheme,
} from '../src/ui/theme';

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    read: (key: string) => data.get(key) ?? null,
  };
}

const throwingStorage = {
  getItem(): string {
    throw new Error('storage disabled');
  },
  setItem(): void {
    throw new Error('storage disabled');
  },
};

beforeEach(() => {
  document.head.innerHTML = '<meta name="theme-color" content="#020a0c" />';
  document.body.innerHTML = '';
  document.documentElement.removeAttribute('data-theme');
});

afterEach(() => {
  document.documentElement.removeAttribute('data-theme');
});

describe('theme state', () => {
  it('recognises only the two supported names', () => {
    expect(isThemeName('dark')).toBe(true);
    expect(isThemeName('light')).toBe(true);
    expect(isThemeName('sepia')).toBe(false);
    expect(isThemeName(null)).toBe(false);
    expect(otherTheme('dark')).toBe('light');
    expect(otherTheme('light')).toBe('dark');
  });

  it('defaults to the dark ground when nothing is stored', () => {
    expect(DEFAULT_THEME).toBe('dark');
    expect(resolveInitialTheme(memoryStorage())).toBe('dark');
    expect(resolveInitialTheme(null)).toBe('dark');
  });

  it('reads a stored preference and ignores a corrupt one', () => {
    expect(readStoredTheme(memoryStorage({ [THEME_STORAGE_KEY]: 'light' }))).toBe('light');
    expect(readStoredTheme(memoryStorage({ [THEME_STORAGE_KEY]: 'neon' }))).toBeNull();
    expect(readStoredTheme(memoryStorage())).toBeNull();
  });

  it('survives storage that refuses to answer', () => {
    expect(readStoredTheme(throwingStorage)).toBeNull();
    expect(() => writeStoredTheme(throwingStorage, 'light')).not.toThrow();
    expect(resolveInitialTheme(throwingStorage)).toBe('dark');
  });

  it('expresses dark as the absence of the attribute', () => {
    applyTheme('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(currentTheme()).toBe('light');

    applyTheme('dark');
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
    expect(currentTheme()).toBe('dark');
  });

  it('keeps the browser chrome colour in step with the ground', () => {
    applyTheme('light');
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe(
      '#f4fbfa',
    );

    applyTheme('dark');
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe(
      '#020a0c',
    );
  });

  it('labels the toggle with the mode the press will switch to', () => {
    const button = document.createElement('button');

    syncThemeToggle(button, 'dark');
    expect(button.getAttribute('aria-pressed')).toBe('false');
    expect(button.getAttribute('aria-label')).toBe(themeToggleLabel('dark'));
    expect(button.getAttribute('aria-label')).toContain('light');

    syncThemeToggle(button, 'light');
    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(button.getAttribute('aria-label')).toContain('dark');
  });
});

describe('theme controller', () => {
  function mountToggle(): HTMLButtonElement {
    document.body.innerHTML = '<button data-theme-toggle type="button"></button>';
    return document.querySelector<HTMLButtonElement>('[data-theme-toggle]')!;
  }

  it('applies the stored theme and reports it on start-up', () => {
    const toggle = mountToggle();
    const storage = memoryStorage({ [THEME_STORAGE_KEY]: 'light' });
    const onChange = vi.fn();

    const controller = initTheme({ storage, onChange });

    expect(controller.get()).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    expect(onChange).toHaveBeenCalledWith('light');
  });

  it('flips, persists, and re-announces the theme when the toggle is pressed', () => {
    const toggle = mountToggle();
    const storage = memoryStorage();
    const onChange = vi.fn();

    const controller = initTheme({ storage, onChange });
    expect(controller.get()).toBe('dark');

    toggle.click();

    expect(controller.get()).toBe('light');
    expect(storage.read(THEME_STORAGE_KEY)).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(onChange).toHaveBeenLastCalledWith('light');

    toggle.click();

    expect(controller.get()).toBe('dark');
    expect(storage.read(THEME_STORAGE_KEY)).toBe('dark');
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
    expect(onChange).toHaveBeenLastCalledWith('dark');
  });

  it('still toggles when the preference cannot be written', () => {
    const toggle = mountToggle();
    const controller = initTheme({ storage: throwingStorage });

    toggle.click();

    expect(controller.get()).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });
});
