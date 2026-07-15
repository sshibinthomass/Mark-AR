export const IMAGE_TARGET_ACCESS_MODES = [
  'anyone_with_link',
  'any_signed_in',
  'owner_only',
  'specific_accounts',
] as const;

export type ImageTargetAccessMode = (typeof IMAGE_TARGET_ACCESS_MODES)[number];

export type ImageTargetAccess = {
  accessMode: ImageTargetAccessMode;
  allowedEmails: string[];
};

export const DEFAULT_IMAGE_TARGET_ACCESS: ImageTargetAccess = {
  accessMode: 'owner_only',
  allowedEmails: [],
};

export function isImageTargetAccessMode(value: unknown): value is ImageTargetAccessMode {
  return typeof value === 'string' && IMAGE_TARGET_ACCESS_MODES.includes(value as ImageTargetAccessMode);
}

export function parseAllowedEmails(value: string): string[] {
  return uniqueNormalizedEmails(value.split(/[\n,]/));
}

export function normalizeAllowedEmails(value: unknown): string[] {
  return Array.isArray(value) ? uniqueNormalizedEmails(value) : [];
}

export function normalizeImageTargetAccess(
  access?: Partial<ImageTargetAccess>,
  legacyVisibility?: 'public' | 'private',
): ImageTargetAccess {
  const accessMode = isImageTargetAccessMode(access?.accessMode)
    ? access.accessMode
    : legacyVisibility === 'public'
      ? 'anyone_with_link'
      : DEFAULT_IMAGE_TARGET_ACCESS.accessMode;
  return {
    accessMode,
    allowedEmails: accessMode === 'specific_accounts'
      ? normalizeAllowedEmails(access?.allowedEmails)
      : [],
  };
}

export function validateImageTargetAccess(access: ImageTargetAccess, ownerEmail?: string): string | null {
  if (access.accessMode !== 'specific_accounts') {
    return null;
  }
  if (access.allowedEmails.length === 0) {
    return 'Add at least one account email.';
  }
  if (access.allowedEmails.some((email) => !isEmail(email.trim().toLowerCase()))) {
    return 'Enter valid account emails.';
  }
  const owner = ownerEmail?.trim().toLowerCase();
  if (owner && access.allowedEmails.every((email) => email.trim().toLowerCase() === owner)) {
    return 'Add at least one account email other than your own.';
  }
  return null;
}

function uniqueNormalizedEmails(values: unknown[]): string[] {
  return [...new Set(values.flatMap((value) => {
    if (typeof value !== 'string') {
      return [];
    }
    const email = value.trim().toLowerCase();
    return email ? [email] : [];
  }))];
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
