import { describe, expect, it } from 'vitest';
import {
  applyAuthUi,
  isAuthenticated,
  resolveAccessibleRoute,
  type AuthUiState,
} from '../src/ui/authUi';

const signedOut: AuthUiState = {
  status: 'signed-out',
  message: 'Sign in to use Image Targets.',
};

const checking: AuthUiState = {
  status: 'checking',
  message: 'Checking saved session…',
};

const signedIn: AuthUiState = {
  status: 'signed-in',
  message: 'Image Targets unlocked.',
  email: 'artist@example.com',
};

describe('auth UI state', () => {
  it('allows Image Targets only for a verified signed-in user', () => {
    expect(resolveAccessibleRoute('targets', signedOut)).toBe('account');
    expect(resolveAccessibleRoute('targets', checking)).toBe('account');
    expect(resolveAccessibleRoute('targets', signedIn)).toBe('targets');
    expect(resolveAccessibleRoute('scan', signedOut)).toBe('scan');
    expect(isAuthenticated(signedOut)).toBe(false);
    expect(isAuthenticated(checking)).toBe(false);
    expect(isAuthenticated(signedIn)).toBe(true);
  });

  it.each([
    ['signed-out', signedOut],
    ['checking', checking],
    ['signed-in', signedIn],
  ] as const)('shows only the %s account panel', (visiblePanel, state) => {
    const root = renderAuthFixture();

    applyAuthUi(root, state);

    for (const panel of root.querySelectorAll<HTMLElement>('[data-auth-panel]')) {
      expect(panel.hidden).toBe(panel.dataset.authPanel !== visiblePanel);
    }
    expect(root.querySelector('#worker-status')?.textContent).toBe(state.message);
  });

  it('locks protected links and presents a sign-in identity while signed out', () => {
    const root = renderAuthFixture();

    applyAuthUi(root, signedOut);

    const targetLink = root.querySelector<HTMLAnchorElement>('[data-auth-protected]');
    expect(targetLink?.getAttribute('href')).toBe('#/account');
    expect(targetLink?.getAttribute('aria-disabled')).toBe('true');
    expect(targetLink?.dataset.authLocked).toBe('true');
    expect(root.querySelector('[data-auth-account-label]')?.textContent).toBe('Sign in');
    expect(root.querySelector('[data-auth-access-label]')?.textContent).toBe('Locked');
    expect(root.querySelector('[data-auth-protected-label]')?.textContent).toBe('Sign in to unlock');
  });

  it('unlocks protected links and displays the verified user while signed in', () => {
    const root = renderAuthFixture();

    applyAuthUi(root, signedIn);

    const targetLink = root.querySelector<HTMLAnchorElement>('[data-auth-protected]');
    expect(targetLink?.getAttribute('href')).toBe('#/targets');
    expect(targetLink?.hasAttribute('aria-disabled')).toBe(false);
    expect(targetLink?.hasAttribute('data-auth-locked')).toBe(false);
    expect(root.querySelector('[data-auth-account-label]')?.textContent).toBe('Account');
    expect(root.querySelector('[data-auth-access-label]')?.textContent).toBe('Unlocked');
    expect(root.querySelector('[data-auth-email]')?.textContent).toBe('artist@example.com');
    expect(root.querySelector('[data-auth-protected-label]')?.textContent).toBe('Create target');
  });
});

function renderAuthFixture(): HTMLElement {
  const root = document.createElement('main');
  root.innerHTML = `
    <a href="#/targets" data-auth-protected data-unlocked-href="#/targets">
      Targets <span data-auth-protected-label>Create target</span>
    </a>
    <span data-auth-account-label>Sign in</span>
    <span data-auth-access-label>Locked</span>
    <span data-auth-email></span>
    <p id="worker-status"></p>
    <section data-auth-panel="signed-out"></section>
    <section data-auth-panel="checking" hidden></section>
    <section data-auth-panel="signed-in" hidden></section>
  `;
  return root;
}
