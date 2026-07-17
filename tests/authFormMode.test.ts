import { describe, expect, it } from 'vitest';
import { loginIntroMessage, signupIntroMessage } from '../src/app/authMessages';
import { applyAuthFormMode } from '../src/ui/authFormMode';

describe('applyAuthFormMode', () => {
  it('keeps sign in minimal and selected by default', () => {
    const root = renderFormFixture();

    applyAuthFormMode(root, 'login');

    const nameField = root.querySelector<HTMLElement>('[data-auth-name-field]');
    const nameInput = root.querySelector<HTMLInputElement>('#worker-name');
    const password = root.querySelector<HTMLInputElement>('#worker-password');
    expect(root.dataset.authFormMode).toBe('login');
    expect(nameField?.hidden).toBe(true);
    expect(nameInput?.disabled).toBe(true);
    expect(nameInput?.required).toBe(false);
    expect(password?.autocomplete).toBe('current-password');
    expect(root.querySelector('[data-auth-submit-label]')?.textContent).toBe('Sign in');
    expect(root.querySelector('[data-auth-form-heading]')?.textContent).toBe('Continue to AnchorAR');
    expect(root.querySelector('[data-auth-mode-help]')?.textContent).toBe(loginIntroMessage);
    const loginMode = root.querySelector<HTMLButtonElement>('[data-auth-mode="login"]');
    const signupMode = root.querySelector<HTMLButtonElement>('[data-auth-mode="signup"]');
    expect(loginMode?.getAttribute('aria-pressed')).toBe('true');
    expect(signupMode?.getAttribute('aria-pressed')).toBe('false');
    expect(loginMode?.tabIndex).toBe(0);
    expect(signupMode?.tabIndex).toBe(0);
  });

  it('shows the required name and one Create account action in signup mode', () => {
    const root = renderFormFixture();

    applyAuthFormMode(root, 'signup');

    const nameField = root.querySelector<HTMLElement>('[data-auth-name-field]');
    const nameInput = root.querySelector<HTMLInputElement>('#worker-name');
    const password = root.querySelector<HTMLInputElement>('#worker-password');
    expect(root.dataset.authFormMode).toBe('signup');
    expect(nameField?.hidden).toBe(false);
    expect(nameInput?.disabled).toBe(false);
    expect(nameInput?.required).toBe(true);
    expect(password?.autocomplete).toBe('new-password');
    expect(password?.minLength).toBe(8);
    expect(root.querySelector('[data-auth-submit-label]')?.textContent).toBe('Create account');
    expect(root.querySelector('[data-auth-form-heading]')?.textContent).toBe('Create your AnchorAR account');
    expect(root.querySelector('[data-auth-mode-help]')?.textContent).toBe(signupIntroMessage);
    const loginMode = root.querySelector<HTMLButtonElement>('[data-auth-mode="login"]');
    const signupMode = root.querySelector<HTMLButtonElement>('[data-auth-mode="signup"]');
    expect(loginMode?.getAttribute('aria-pressed')).toBe('false');
    expect(signupMode?.getAttribute('aria-pressed')).toBe('true');
    expect(loginMode?.tabIndex).toBe(0);
    expect(signupMode?.tabIndex).toBe(0);
  });

  it('preserves shared field values when switching modes', () => {
    const root = renderFormFixture();
    const email = root.querySelector<HTMLInputElement>('#worker-email');
    const password = root.querySelector<HTMLInputElement>('#worker-password');
    if (!email || !password) {
      throw new Error('Fixture inputs missing');
    }
    email.value = 'maker@example.com';
    password.value = 'maker-password-123';

    applyAuthFormMode(root, 'signup');
    applyAuthFormMode(root, 'login');

    expect(email.value).toBe('maker@example.com');
    expect(password.value).toBe('maker-password-123');
  });

  it('does not overwrite a non-signed-out live auth status', () => {
    const root = renderFormFixture();
    root.dataset.authState = 'checking';
    const status = root.querySelector<HTMLElement>('#worker-status');
    if (!status) {
      throw new Error('Fixture status missing');
    }
    status.textContent = 'Checking your saved session...';

    applyAuthFormMode(root, 'login');

    expect(status.textContent).toBe('Checking your saved session...');
  });
});

function renderFormFixture(): HTMLElement {
  const root = document.createElement('section');
  root.innerHTML = `
    <button data-auth-mode="login" aria-pressed="true">Sign in</button>
    <button data-auth-mode="signup" aria-pressed="false">Create account</button>
    <h3 data-auth-form-heading>Continue to AnchorAR</h3>
    <p id="worker-status" data-auth-mode-help></p>
    <label data-auth-name-field hidden><input id="worker-name" disabled /></label>
    <input id="worker-email" />
    <input id="worker-password" type="password" minlength="8" autocomplete="current-password" />
    <button type="submit"><span data-auth-submit-label>Sign in</span></button>
  `;
  return root;
}
