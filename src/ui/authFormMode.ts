export type AuthFormMode = 'login' | 'signup';

export function applyAuthFormMode(root: HTMLElement, mode: AuthFormMode): void {
  const formShell = root.matches('[data-auth-form-mode]')
    ? root
    : root.querySelector<HTMLElement>('[data-auth-form-mode]') ?? root;
  formShell.dataset.authFormMode = mode;

  root.querySelectorAll<HTMLButtonElement>('[data-auth-mode]').forEach((button) => {
    const selected = button.dataset.authMode === mode;
    button.setAttribute('aria-selected', String(selected));
    button.tabIndex = selected ? 0 : -1;
  });

  const isSignup = mode === 'signup';
  const nameField = root.querySelector<HTMLElement>('[data-auth-name-field]');
  const nameInput = root.querySelector<HTMLInputElement>('#worker-name');
  const passwordInput = root.querySelector<HTMLInputElement>('#worker-password');

  if (nameField) {
    nameField.hidden = !isSignup;
  }
  if (nameInput) {
    nameInput.disabled = !isSignup;
    nameInput.required = isSignup;
  }
  if (passwordInput) {
    passwordInput.autocomplete = isSignup ? 'new-password' : 'current-password';
    passwordInput.minLength = 8;
  }

  setText(root, '[data-auth-form-heading]', isSignup ? 'Create your Marker AR account' : 'Continue to Marker AR studio');
  setText(root, '[data-auth-submit-label]', isSignup ? 'Create account' : 'Sign in');
}

function setText(root: HTMLElement, selector: string, value: string): void {
  root.querySelectorAll<HTMLElement>(selector).forEach((element) => {
    element.textContent = value;
  });
}
