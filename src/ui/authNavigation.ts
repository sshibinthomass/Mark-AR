import { isAuthenticated, type AuthUiState } from './authUi';
import type { AppRoute } from './pageRoutes';
import { activateAccessibleRoute, type AccessibleRouteResult } from './pageRouter';

/*
 * One destination is remembered while a signed-out visitor is bounced to the
 * account page, so signing in lands them where they were headed. A route and a
 * raw href are alternatives, never both, so they share one slot.
 */
type PendingDestination =
  | { kind: 'route'; route: AppRoute }
  | { kind: 'href'; href: string };

export class AuthNavigation {
  private pending: PendingDestination | undefined;

  activate(root: HTMLElement, requestedRoute: AppRoute, authState: AuthUiState): AccessibleRouteResult {
    const result = activateAccessibleRoute(root, requestedRoute, authState);
    if (result.blocked) {
      this.pending = { kind: 'route', route: requestedRoute };
    } else if (requestedRoute !== 'account') {
      this.pending = undefined;
    }
    return result;
  }

  remember(route: AppRoute): void {
    this.pending = { kind: 'route', route };
  }

  rememberHref(href: string): void {
    this.pending = { kind: 'href', href };
  }

  takePending(authState: AuthUiState): AppRoute | undefined {
    if (!isAuthenticated(authState) || this.pending?.kind !== 'route') {
      return undefined;
    }
    const { route } = this.pending;
    this.pending = undefined;
    return route;
  }

  takePendingHref(authState: AuthUiState): string | undefined {
    if (!isAuthenticated(authState) || this.pending?.kind !== 'href') {
      return undefined;
    }
    const { href } = this.pending;
    this.pending = undefined;
    return href;
  }

  clear(): void {
    this.pending = undefined;
  }
}
