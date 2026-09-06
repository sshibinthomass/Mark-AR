/**
 * Theme state for the Arvenilo ground.
 *
 * The design system is dark-first, so `dark` is the default and `light` is an
 * explicit, persisted opt-in rather than a reading of `prefers-color-scheme`.
 * Only `<html data-theme>` changes -- every colour flips through the semantic
 * token layer, so nothing here needs to know about individual components.
 */

export type ThemeName = 'dark' | 'light';

export const THEME_STORAGE_KEY = 'anchorar:theme';
export const DEFAULT_THEME: ThemeName = 'dark';

/** Ground colour per theme, mirrored into `<meta name="theme-color">`. */
export const THEME_COLORS: Record<ThemeName, string> = {
  dark: '#020a0c',
  light: '#f4fbfa',
};

export function isThemeName(value: unknown): value is ThemeName {
  return value === 'dark' || value === 'light';
}

export function otherTheme(theme: ThemeName): ThemeName {
  return theme === 'dark' ? 'light' : 'dark';
}

/**
 * Storage can throw outright in private modes, so a failed read is treated the
 * same as an absent preference.
 */
export function readStoredTheme(storage: Pick<Storage, 'getItem'> | null): ThemeName | null {
  if (!storage) {
    return null;
  }

  try {
    const stored = storage.getItem(THEME_STORAGE_KEY);
    return isThemeName(stored) ? stored : null;
  } catch {
    return null;
  }
}

export function writeStoredTheme(
  storage: Pick<Storage, 'setItem'> | null,
  theme: ThemeName,
): void {
  if (!storage) {
    return;
  }

  try {
    storage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* A refused write only costs the preference, never the toggle. */
  }
}

export function resolveInitialTheme(storage: Pick<Storage, 'getItem'> | null): ThemeName {
  return readStoredTheme(storage) ?? DEFAULT_THEME;
}

/**
 * Applies the theme to the document. The dark ground is the default, so it is
 * expressed by the absence of the attribute rather than by `data-theme="dark"`.
 */
export function applyTheme(theme: ThemeName, doc: Document = document): void {
  const root = doc.documentElement;

  if (theme === 'light') {
    root.setAttribute('data-theme', 'light');
  } else {
    root.removeAttribute('data-theme');
  }

  const meta = doc.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute('content', THEME_COLORS[theme]);
  }
}

export function currentTheme(doc: Document = document): ThemeName {
  return doc.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
}

export function themeToggleLabel(theme: ThemeName): string {
  return theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme';
}

export function syncThemeToggle(button: HTMLElement, theme: ThemeName): void {
  button.setAttribute('aria-pressed', theme === 'light' ? 'true' : 'false');
  button.setAttribute('aria-label', themeToggleLabel(theme));
  button.setAttribute('title', themeToggleLabel(theme));
}

export type ThemeControllerOptions = {
  doc?: Document;
  storage?: Pick<Storage, 'getItem' | 'setItem'> | null;
  /** Called on the initial apply and on every change. */
  onChange?: (theme: ThemeName) => void;
};

export type ThemeController = {
  get: () => ThemeName;
  set: (theme: ThemeName) => void;
  toggle: () => ThemeName;
};

/**
 * Binds every `[data-theme-toggle]` control in the document. Safe to call once
 * at start-up: the shell renders its toggles before this runs.
 */
export function initTheme(options: ThemeControllerOptions = {}): ThemeController {
  const doc = options.doc ?? document;
  const storage =
    options.storage === undefined ? safeLocalStorage() : options.storage;

  let theme = resolveInitialTheme(storage);
  const toggles = Array.from(doc.querySelectorAll<HTMLElement>('[data-theme-toggle]'));

  const render = (): void => {
    applyTheme(theme, doc);
    toggles.forEach((button) => syncThemeToggle(button, theme));
    options.onChange?.(theme);
  };

  const set = (next: ThemeName): void => {
    theme = next;
    writeStoredTheme(storage, theme);
    render();
  };

  toggles.forEach((button) => {
    button.addEventListener('click', () => set(otherTheme(theme)));
  });

  render();

  return {
    get: () => theme,
    set,
    toggle: () => {
      set(otherTheme(theme));
      return theme;
    },
  };
}

function safeLocalStorage(): Pick<Storage, 'getItem' | 'setItem'> | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
