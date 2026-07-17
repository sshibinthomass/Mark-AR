import type { AuthSession } from '../app/webArAuth';
import { pendingApprovalMessage, protectedTargetsMessage, signupPendingMessage } from '../app/authMessages';
import type { AppRoute } from './pageRoutes';

export type AuthUiState =
  | { status: 'checking'; message: string }
  | { status: 'signed-out'; message: string }
  | { status: 'signed-in'; message: string; email: string };

export type SignupResult =
  | { kind: 'pending'; email: string; message: string }
  | { kind: 'signed-in'; token: string; state: Extract<AuthUiState, { status: 'signed-in' }> };

export type LoginResult = {
  token: string;
  state: Extract<AuthUiState, { status: 'signed-in' }>;
};

export function resolveLoginResult(session: AuthSession): LoginResult {
  if (session.user.status !== 'active') {
    throw new Error(pendingApprovalMessage);
  }
  if (!session.token) {
    throw new Error('The sign-in service did not return a session token.');
  }
  return {
    token: session.token,
    state: {
      status: 'signed-in',
      email: session.user.email,
      message: 'AnchorAR Studio unlocked.',
    },
  };
}

export function resolveSignupResult(session: AuthSession): SignupResult {
  if (!session.token || session.user.status !== 'active') {
    return {
      kind: 'pending',
      email: session.user.email,
      message: signupPendingMessage,
    };
  }

  return {
    kind: 'signed-in',
    token: session.token,
    state: {
      status: 'signed-in',
      email: session.user.email,
      message: 'AnchorAR Studio unlocked.',
    },
  };
}

export function isAuthenticated(state: AuthUiState): state is Extract<AuthUiState, { status: 'signed-in' }> {
  return state.status === 'signed-in';
}

export function resolveAccessibleRoute(route: AppRoute, state: AuthUiState): AppRoute {
  return route === 'targets' && !isAuthenticated(state) ? 'account' : route;
}

export function applyAuthUi(root: HTMLElement, state: AuthUiState): void {
  const authenticated = isAuthenticated(state);
  root.dataset.authState = state.status;

  root.querySelectorAll<HTMLElement>('[data-auth-panel]').forEach((panel) => {
    panel.hidden = panel.dataset.authPanel !== state.status;
  });

  const status = root.querySelector<HTMLElement>('#worker-status');
  if (status) {
    status.textContent = state.message;
  }

  setText(root, '[data-auth-account-label]', authenticated ? 'Account' : 'Sign in');
  setText(root, '[data-auth-access-label]', authenticated ? 'Unlocked' : state.status === 'checking' ? 'Checking' : 'Locked');
  setText(root, '[data-auth-protected-label]', authenticated ? 'Create target' : state.status === 'checking' ? 'Checking access' : 'Sign in to unlock');
  setText(root, '[data-auth-account-action]', authenticated ? 'View account' : 'Sign in');
  setText(root, '[data-auth-email]', authenticated ? state.email : '');

  root.querySelectorAll<HTMLAnchorElement>('[data-auth-protected]').forEach((link) => {
    if (authenticated) {
      link.href = link.dataset.unlockedHref ?? '#/targets';
      link.removeAttribute('aria-disabled');
      link.removeAttribute('data-auth-locked');
      link.removeAttribute('aria-label');
      link.removeAttribute('title');
      return;
    }

    link.href = '#/account';
    link.removeAttribute('aria-disabled');
    link.dataset.authLocked = 'true';
    if (link.dataset.routeLink === 'targets') {
      link.setAttribute(
        'aria-label',
        state.status === 'checking' ? 'AnchorAR Studio — checking access' : 'AnchorAR Studio — sign in required',
      );
    }
    link.title = state.status === 'checking' ? 'Checking your session' : protectedTargetsMessage;
  });
}

function setText(root: HTMLElement, selector: string, value: string): void {
  root.querySelectorAll<HTMLElement>(selector).forEach((element) => {
    element.textContent = value;
  });
}
