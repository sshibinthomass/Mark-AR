import { describe, expect, it } from 'vitest';
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
    expect(root.querySelector('[data-auth-form-heading]')?.textContent).toBe('Continue to Marker AR studio');
    expect(root.querySelector('[data-auth-mode="login"]')?.getAttribute('aria-selected')).toBe('true');
    expect(root.querySelector('[data-auth-mode="signup"]')?.getAttribute('aria-selected')).toBe('false');
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
    expect(root.querySelector('[data-auth-form-heading]')?.textContent).toBe('Create your Marker AR account');
    expect(root.querySelector('[data-auth-mode="login"]')?.getAttribute('aria-selected')).toBe('false');
    expect(root.querySelector('[data-auth-mode="signup"]')?.getAttribute('aria-selected')).toBe('true');
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
});

function renderFormFixture(): HTMLElement {
  const root = document.createElement('section');
  root.innerHTML = `
    <button data-auth-mode="login" aria-selected="true">Sign in</button>
    <button data-auth-mode="signup" aria-selected="false">Create account</button>
    <h3 data-auth-form-heading>Continue to Marker AR studio</h3>
    <label data-auth-name-field hidden><input id="worker-name" disabled /></label>
    <input id="worker-email" />
    <input id="worker-password" type="password" minlength="8" autocomplete="current-password" />
    <button type="submit"><span data-auth-submit-label>Sign in</span></button>
  `;
  return root;
}
