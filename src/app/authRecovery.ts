import { isAuthRequestError } from './webArAuth';

export function shouldRecoverExistingAccount(error: unknown): boolean {
  return isAuthRequestError(error, 409);
}

type ExistingAccountRecoveryDeps = {
  setFormMode: (mode: 'login') => void;
  signIn: (message: string) => Promise<void>;
};

export async function recoverExistingAccount(
  error: unknown,
  { setFormMode, signIn }: ExistingAccountRecoveryDeps,
): Promise<boolean> {
  if (!shouldRecoverExistingAccount(error)) {
    return false;
  }

  setFormMode('login');
  await signIn('Account already exists. Signing in…');
  return true;
}
