import { isAuthRequestError } from './webArAuth';

export const existingAccountMessage = 'Account already exists. Sign in with that email, or use a different email to create a new account.';

export function shouldRecoverExistingAccount(error: unknown): boolean {
  return isAuthRequestError(error, 409);
}

type ExistingAccountRecoveryDeps = {
  setFormMode: (mode: 'login') => void;
  setSignedOutMessage?: (message: string) => void;
};

export async function recoverExistingAccount(
  error: unknown,
  { setFormMode, setSignedOutMessage }: ExistingAccountRecoveryDeps,
): Promise<boolean> {
  if (!shouldRecoverExistingAccount(error)) {
    return false;
  }

  setFormMode('login');
  setSignedOutMessage?.(existingAccountMessage);
  return true;
}
