import { describe, expect, it } from 'vitest';
import {
  applyAuthUi,
  isAuthenticated,
  resolveLoginResult,
  resolveSignupResult,
  resolveAccessibleRoute,
  type AuthUiState,
} from '../src/ui/authUi';
import { pendingApprovalMessage } from '../src/app/authMessages';
import { loginIntroMessage, protectedTargetsMessage, signupPendingMessage } from '../src/app/authMessages';
import { renderAppShell } from '../src/ui/appShell';

const signedOut: AuthUiState = {
  status: 'signed-out',
  message: loginIntroMessage,
};

const checking: AuthUiState = {
  status: 'checking',
  message: 'Checking saved session…',
};

const signedIn: AuthUiState = {
  status: 'signed-in',
  message: 'AnchorAR Studio unlocked.',
  email: 'artist@example.com',
};

describe('auth UI state', () => {
  it('rejects a token-bearing login while the account is pending', () => {
    expect(() => resolveLoginResult({
      user: {
        email: 'maker@example.com',
        role: 'user',
        status: 'pending',
      },
      token: 'unexpected-token',
    })).toThrow(pendingApprovalMessage);
  });

  it('accepts only an active token-bearing login', () => {
    expect(resolveLoginResult({
      user: {
        email: 'maker@example.com',
        role: 'user',
        status: 'active',
      },
      token: 'login-token',
    })).toEqual({
      token: 'login-token',
      state: {
        status: 'signed-in',
        email: 'maker@example.com',
        message: 'AnchorAR Studio unlocked.',
      },
    });
  });

  it('keeps a pending signup signed out until admin approval', () => {
    expect(resolveSignupResult({
      user: {
        email: 'maker@example.com',
        name: 'Maker',
        role: 'user',
        status: 'pending',
      },
      token: null,
    })).toEqual({
      kind: 'pending',
      email: 'maker@example.com',
      message: signupPendingMessage,
    });
  });

  it('ignores an unexpected token when the signup user is still pending', () => {
    expect(resolveSignupResult({
      user: {
        email: 'maker@example.com',
        role: 'user',
        status: 'pending',
      },
      token: 'unexpected-token',
    })).toEqual({
      kind: 'pending',
      email: 'maker@example.com',
      message: signupPendingMessage,
    });
  });

  it('turns a token-bearing signup into the existing signed-in state', () => {
    expect(resolveSignupResult({
      user: {
        email: 'admin@example.com',
        role: 'admin',
        status: 'active',
      },
      token: 'signup-token',
    })).toEqual({
      kind: 'signed-in',
      token: 'signup-token',
      state: {
        status: 'signed-in',
        email: 'admin@example.com',
        message: 'AnchorAR Studio unlocked.',
      },
    });
  });

  it('allows AnchorAR Studio only for a verified signed-in user', () => {
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

  it('keeps protected links actionable to Account and presents a sign-in identity while signed out', () => {
    const root = renderAuthFixture();

    applyAuthUi(root, signedOut);

    const targetLink = root.querySelector<HTMLAnchorElement>('[data-auth-protected]');
    expect(targetLink?.getAttribute('href')).toBe('#/account');
    expect(targetLink?.hasAttribute('aria-disabled')).toBe(false);
    expect(targetLink?.tabIndex).toBe(0);
    expect(targetLink?.dataset.authLocked).toBe('true');
    expect(targetLink?.title).toBe(protectedTargetsMessage);
    expect(root.querySelector('[data-auth-account-label]')?.textContent).toBe('Sign in');
    expect(root.querySelector('[data-auth-access-label]')?.textContent).toBe('Locked');
    expect(root.querySelector('[data-auth-protected-label]')?.textContent).toBe('Sign in to unlock');
  });

  it.each([
    [signedOut, 'AnchorAR Studio — sign in required'],
    [checking, 'AnchorAR Studio — checking access'],
  ] as const)('keeps the Studio accessible label after applying %s auth UI', (state, accessibleLabel) => {
    const root = document.createElement('div');
    root.innerHTML = renderAppShell();

    applyAuthUi(root, state);

    expect(root.querySelector('[data-route-link="targets"]')?.getAttribute('aria-label')).toBe(accessibleLabel);
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

  it('publishes an account error tone and clears it with the next normal state', () => {
    const root = renderAuthFixture();
    const status = root.querySelector<HTMLElement>('#worker-status');

    applyAuthUi(root, {
      status: 'signed-out',
      message: 'Sign-in service is unavailable.',
      tone: 'error',
    });

    expect(status?.textContent).toBe('Sign-in service is unavailable.');
    expect(status?.dataset.tone).toBe('error');

    applyAuthUi(root, checking);
    expect(status?.textContent).toBe(checking.message);
    expect(status?.hasAttribute('data-tone')).toBe(false);

    applyAuthUi(root, signedOut);
    expect(status?.hasAttribute('data-tone')).toBe(false);
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
