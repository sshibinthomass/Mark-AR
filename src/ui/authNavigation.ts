import { isAuthenticated, type AuthUiState } from './authUi';
import type { AppRoute } from './pageRoutes';
import { activateAccessibleRoute, type AccessibleRouteResult } from './pageRouter';

export class AuthNavigation {
  private pendingProtectedRoute: AppRoute | undefined;
  private pendingProtectedHref: string | undefined;

  activate(root: HTMLElement, requestedRoute: AppRoute, authState: AuthUiState): AccessibleRouteResult {
    const result = activateAccessibleRoute(root, requestedRoute, authState);
    if (result.blocked) {
      this.pendingProtectedRoute = requestedRoute;
      this.pendingProtectedHref = undefined;
    } else if (requestedRoute !== 'account') {
      this.pendingProtectedRoute = undefined;
      this.pendingProtectedHref = undefined;
    }
    return result;
  }

  remember(route: AppRoute): void {
    this.pendingProtectedRoute = route;
    this.pendingProtectedHref = undefined;
  }

  rememberHref(href: string): void {
    this.pendingProtectedHref = href;
    this.pendingProtectedRoute = undefined;
  }

  takePending(authState: AuthUiState): AppRoute | undefined {
    if (!isAuthenticated(authState)) {
      return undefined;
    }
    const route = this.pendingProtectedRoute;
    this.pendingProtectedRoute = undefined;
    return route;
  }

  takePendingHref(authState: AuthUiState): string | undefined {
    if (!isAuthenticated(authState)) {
      return undefined;
    }
    const href = this.pendingProtectedHref;
    this.pendingProtectedHref = undefined;
    return href;
  }

  clear(): void {
    this.pendingProtectedRoute = undefined;
    this.pendingProtectedHref = undefined;
  }
}
