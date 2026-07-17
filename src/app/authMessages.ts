import { isAuthRequestError } from './webArAuth';

export type AuthAction = 'login' | 'signup';

export const loginIntroMessage = 'Sign in with an approved account to use AnchorAR Studio.';
export const signupIntroMessage = 'Create an account for approval. You can open AnchorAR Studio after approval.';
export const protectedTargetsMessage = 'Sign in with an approved account to open AnchorAR Studio.';
export const duplicateAccountMessage = 'That email already has an AnchorAR account. Sign in instead, or use another email.';
export const pendingApprovalMessage = 'This account is waiting for administrator approval. AnchorAR Studio unlocks after approval.';
export const signupPendingMessage = 'Account created. It is waiting for approval. You can open AnchorAR Studio after approval.';
export const loginRejectedMessage = 'We could not sign you in. Check your password, or wait for administrator approval if this account is new.';
export const signupValidationMessage = 'Check the name, email, and password, then try creating the account again.';

export function userFacingAuthErrorMessage(error: unknown, action: AuthAction): string {
  if (isAuthRequestError(error, 409) && action === 'signup') {
    return duplicateAccountMessage;
  }

  if (isPendingApprovalError(error)) {
    return pendingApprovalMessage;
  }

  if (action === 'login' && isAuthRequestError(error) && (error.status === 401 || error.status === 403)) {
    return loginRejectedMessage;
  }

  if (action === 'signup' && isAuthRequestError(error) && error.status === 400) {
    return signupValidationMessage;
  }

  return error instanceof Error ? error.message : action === 'login' ? 'Unable to sign in.' : 'Unable to create account.';
}

function isPendingApprovalError(error: unknown): boolean {
  return error instanceof Error && /pending|approval|approved/i.test(error.message);
}
