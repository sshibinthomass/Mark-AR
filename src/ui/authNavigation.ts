import { isAuthenticated, type AuthUiState } from './authUi';
import type { AppRoute } from './pageRoutes';
import { activateAccessibleRoute, type AccessibleRouteResult } from './pageRouter';

export class AuthNavigation {
  private pendingProtectedRoute: AppRoute | undefined;

  activate(root: HTMLElement, requestedRoute: AppRoute, authState: AuthUiState): AccessibleRouteResult {
    const result = activateAccessibleRoute(root, requestedRoute, authState);
    if (result.blocked) {
      this.pendingProtectedRoute = requestedRoute;
    } else if (requestedRoute !== 'account') {
      this.pendingProtectedRoute = undefined;
    }
    return result;
  }

  remember(route: AppRoute): void {
    this.pendingProtectedRoute = route;
  }

  takePending(authState: AuthUiState): AppRoute | undefined {
    if (!isAuthenticated(authState)) {
      return undefined;
    }
    const route = this.pendingProtectedRoute;
    this.pendingProtectedRoute = undefined;
    return route;
  }

  clear(): void {
    this.pendingProtectedRoute = undefined;
  }
}
