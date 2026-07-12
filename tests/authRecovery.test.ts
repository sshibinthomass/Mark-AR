import { describe, expect, it, vi } from 'vitest';
import { AuthRequestError } from '../src/app/webArAuth';
import { recoverExistingAccount, shouldRecoverExistingAccount } from '../src/app/authRecovery';

describe('shouldRecoverExistingAccount', () => {
  it('recovers only a typed HTTP 409 auth error', () => {
    expect(shouldRecoverExistingAccount(new AuthRequestError('Account already exists.', 409))).toBe(true);
    expect(shouldRecoverExistingAccount(new AuthRequestError('Invalid signup.', 400))).toBe(false);
    expect(shouldRecoverExistingAccount(new Error('Account already exists.'))).toBe(false);
    expect(shouldRecoverExistingAccount('Account already exists.')).toBe(false);
  });

  it('switches to login and retries the submitted credentials for a conflict', async () => {
    const setFormMode = vi.fn();
    const signIn = vi.fn(async () => undefined);

    const recovered = await recoverExistingAccount(
      new AuthRequestError('Account already exists.', 409),
      { setFormMode, signIn },
    );

    expect(recovered).toBe(true);
    expect(setFormMode).toHaveBeenCalledWith('login');
    expect(signIn).toHaveBeenCalledWith('Account already exists. Signing in…');
  });

  it('does not change modes or retry login for other signup errors', async () => {
    const setFormMode = vi.fn();
    const signIn = vi.fn(async () => undefined);

    const recovered = await recoverExistingAccount(
      new AuthRequestError('Invalid signup.', 400),
      { setFormMode, signIn },
    );

    expect(recovered).toBe(false);
    expect(setFormMode).not.toHaveBeenCalled();
    expect(signIn).not.toHaveBeenCalled();
  });
});
