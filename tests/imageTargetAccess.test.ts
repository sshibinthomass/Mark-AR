import { describe, expect, it } from 'vitest';
import {
  DEFAULT_IMAGE_TARGET_ACCESS,
  parseAllowedEmails,
  validateImageTargetAccess,
} from '../src/app/imageTargetAccess';

describe('image target access', () => {
  it('defaults new targets to owner-only access', () => {
    expect(DEFAULT_IMAGE_TARGET_ACCESS).toEqual({
      accessMode: 'owner_only',
      allowedEmails: [],
    });
  });

  it('normalizes comma and line separated account emails', () => {
    expect(parseAllowedEmails(' Friend@Example.com,friend@example.com\nsecond@example.com ')).toEqual([
      'friend@example.com',
      'second@example.com',
    ]);
  });

  it('validates specific-account access and excludes owner-only sharing', () => {
    expect(validateImageTargetAccess({
      accessMode: 'specific_accounts',
      allowedEmails: [],
    }, 'owner@example.com')).toBe('Add at least one account email.');
    expect(validateImageTargetAccess({
      accessMode: 'specific_accounts',
      allowedEmails: ['OWNER@example.com'],
    }, 'owner@example.com')).toBe('Add at least one account email other than your own.');
    expect(validateImageTargetAccess({
      accessMode: 'specific_accounts',
      allowedEmails: ['not-an-email', 'friend@example.com'],
    }, 'owner@example.com')).toBe('Enter valid account emails.');
    expect(validateImageTargetAccess({
      accessMode: 'specific_accounts',
      allowedEmails: ['friend@example.com'],
    }, 'owner@example.com')).toBeNull();
  });
});
