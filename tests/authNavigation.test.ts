import { describe, expect, it } from 'vitest';
import { AuthNavigation } from '../src/ui/authNavigation';

const signedOut = {
  status: 'signed-out' as const,
  message: 'Sign in to use Image Targets.',
};

const signedIn = {
  status: 'signed-in' as const,
  message: 'Image Targets unlocked.',
  email: 'artist@example.com',
};

const checking = {
  status: 'checking' as const,
  message: 'Checking your saved session…',
};

describe('AuthNavigation', () => {
  it('guards a direct Targets request and restores it after authentication', () => {
    const navigation = new AuthNavigation();
    const root = renderRouteFixture();

    expect(navigation.activate(root, 'targets', signedOut)).toEqual({
      activeRoute: 'account',
      blocked: true,
    });
    expect(navigation.takePending(signedOut)).toBeUndefined();
    expect(navigation.takePending(signedIn)).toBe('targets');
    expect(navigation.takePending(signedIn)).toBeUndefined();
  });

  it('keeps Targets guarded until a saved session is verified', () => {
    const navigation = new AuthNavigation();
    const root = renderRouteFixture();

    expect(navigation.activate(root, 'targets', checking)).toEqual({
      activeRoute: 'account',
      blocked: true,
    });
    expect(navigation.takePending(checking)).toBeUndefined();
    expect(navigation.takePending(signedIn)).toBe('targets');
  });

  it('cancels a pending Targets redirect when the user explicitly opens Scan', () => {
    const navigation = new AuthNavigation();
    const root = renderRouteFixture();

    navigation.activate(root, 'targets', signedOut);
    navigation.activate(root, 'scan', signedOut);

    expect(navigation.takePending(signedIn)).toBeUndefined();
    expect(root.dataset.activePage).toBe('scan');
  });

  it('keeps the pending target while the user remains in the Account flow', () => {
    const navigation = new AuthNavigation();
    const root = renderRouteFixture();

    navigation.remember('targets');
    navigation.activate(root, 'account', signedOut);

    expect(navigation.takePending(signedIn)).toBe('targets');
  });

  it('clears pending navigation on logout', () => {
    const navigation = new AuthNavigation();
    navigation.remember('targets');

    navigation.clear();

    expect(navigation.takePending(signedIn)).toBeUndefined();
  });

  it('restores an exact target scan hash after authentication', () => {
    const navigation = new AuthNavigation();

    navigation.rememberHref('#/scan/scan-abc');

    expect(navigation.takePendingHref(signedOut)).toBeUndefined();
    expect(navigation.takePendingHref(signedIn)).toBe('#/scan/scan-abc');
    expect(navigation.takePendingHref(signedIn)).toBeUndefined();
  });

  it('cancels an exact pending scan when the user opens another non-account page', () => {
    const navigation = new AuthNavigation();
    const root = renderRouteFixture();

    navigation.rememberHref('#/scan/scan-abc');
    navigation.activate(root, 'scan', signedOut);

    expect(navigation.takePendingHref(signedIn)).toBeUndefined();
  });
});

function renderRouteFixture(): HTMLElement {
  const root = document.createElement('main');
  root.innerHTML = `
    <section data-page="scan" hidden></section>
    <section data-page="targets" hidden></section>
    <section data-page="account" hidden></section>
  `;
  return root;
}
