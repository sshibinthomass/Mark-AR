import { describe, expect, it } from 'vitest';
import { AuthRequestError } from '../src/app/webArAuth';
import {
  duplicateAccountMessage,
  loginIntroMessage,
  pendingApprovalMessage,
  protectedTargetsMessage,
  signupIntroMessage,
  userFacingAuthErrorMessage,
} from '../src/app/authMessages';

describe('auth user-facing messages', () => {
  it('keeps the account entry-point copy action-oriented', () => {
    expect(loginIntroMessage).toBe('Sign in with an approved account to use Image Targets.');
    expect(signupIntroMessage).toBe('Create an account for administrator approval. You can sign in after approval.');
    expect(protectedTargetsMessage).toBe('Sign in with an approved account to open Image Targets.');
  });

  it('explains duplicate signup as an existing account, not a broken create flow', () => {
    expect(userFacingAuthErrorMessage(
      new AuthRequestError('Account already exists.', 409),
      'signup',
    )).toBe(duplicateAccountMessage);
  });

  it('explains pending approval when a login response identifies the account state', () => {
    expect(userFacingAuthErrorMessage(
      new Error('Account pending admin approval.'),
      'login',
    )).toBe(pendingApprovalMessage);
  });

  it('gives a next step for forbidden login attempts without exposing backend wording', () => {
    expect(userFacingAuthErrorMessage(
      new AuthRequestError('Forbidden', 403),
      'login',
    )).toBe('We could not sign you in. Check your password, or wait for administrator approval if this account is new.');
  });

  it('gives form-specific guidance for signup validation failures', () => {
    expect(userFacingAuthErrorMessage(
      new AuthRequestError('Bad request', 400),
      'signup',
    )).toBe('Check the name, email, and password, then try creating the account again.');
  });

  it('falls back to the original message when it is already specific', () => {
    expect(userFacingAuthErrorMessage(
      new Error('Worker API URL is not configured.'),
      'login',
    )).toBe('Worker API URL is not configured.');
  });
});
