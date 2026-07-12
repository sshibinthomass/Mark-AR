import { duplicateAccountMessage } from './authMessages';
import { isAuthRequestError } from './webArAuth';

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
  setSignedOutMessage?.(duplicateAccountMessage);
  return true;
}
