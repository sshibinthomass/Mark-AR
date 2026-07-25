# Keyboard Shortcut Settings Page Design

## Goal

Add an authenticated Settings destination that gives signed-in users a clear, read-only reference for every keyboard shortcut that currently works in AnchorAR Studio.

## Scope

The feature is documentation and navigation only. Users cannot remap shortcuts, change movement increments, select shortcut profiles, or persist preferences. The page will not display proposed or unimplemented shortcuts.

## Navigation and Access

Add `settings` to the application routes and place a Settings tab immediately before Account in the main route navigation.

The Settings tab is hidden unless authentication state is `signed-in`. The `#/settings` route uses the same authentication boundary as AnchorAR Studio:

- signed-in users can open Settings;
- signed-out users are redirected to Account;
- users whose saved session is still being checked remain on Account until authentication resolves;
- a valid saved session restores the originally requested Settings route;
- signing out while Settings is active redirects to Account.

The Settings page can remain present in the rendered application shell, but it must not become the active page or expose its navigation tab while signed out.

## Content Architecture

Create a typed shortcut catalog as the single source for the reference page. Each entry contains:

- section identifier and label;
- action label;
- one or more displayed keys;
- a short scope note when focus or selection matters.

The catalog includes only implemented behavior:

### Object movement

- Arrow Left: move selected objects left.
- Arrow Right: move selected objects right.
- Arrow Up: move selected objects forward.
- Arrow Down: move selected objects backward.
- Page Up: raise selected objects.
- Page Down: lower selected objects.
- Delete: remove selected objects.

These shortcuts work anywhere on the active Studio page when there is a selection, except while the user is typing or editing a form control.

### Transform tools

- W or G: activate Move.
- E: activate Rotate.
- R or S: activate Scale.
- Escape or Enter: return to Move and finish the current direct interaction.

These shortcuts require focus inside the 3D preview.

### Camera views

- 1: Front view.
- 3: Right view.
- 7: Top view.
- 0 or F: Home view.

These shortcuts require focus inside the 3D preview.

The page will include a concise usage note explaining the difference between Studio-wide selection shortcuts and preview-focused shortcuts.

## Presentation

Render the page with the existing product page header and card system. Use one section per shortcut category and compact rows containing:

- accessible `<kbd>` elements for each key;
- a plain-language action;
- an optional scope note.

The layout uses a responsive grid on wider screens and a single column on narrow screens. It will follow existing Arvenilo colors, typography, spacing, focus indicators, and reduced-motion behavior.

The page heading is focusable through the existing route activation behavior. Shortcut rows are semantic list items rather than interactive controls because the page is read-only.

## Components

- `src/app/keyboardShortcuts.ts`: typed, immutable catalog of implemented shortcuts.
- `src/ui/keyboardSettings.ts`: render the catalog into Settings page markup or DOM.
- `src/ui/pageRoutes.ts`: add the `settings` route.
- `src/ui/authUi.ts`: treat Settings as authenticated and control Settings-tab visibility.
- `src/ui/authNavigation.ts`: remember and restore a protected Settings destination in addition to Studio.
- `src/ui/appShell.ts`: add the Settings tab and page container.
- `src/main.ts`: redirect on logout when either Studio or Settings is active.
- Existing stylesheet files: add responsive Settings page and `<kbd>` presentation.

## Error and State Handling

The catalog is static and requires no network call. If authentication expires, the existing session validation moves the user to Account and hides the Settings tab.

Unknown hashes continue to resolve to Home. Existing Home, Scan, Studio, and Account route behavior remains unchanged.

## Testing

Automated tests will cover:

- parsing and generating `#/settings`;
- hiding the Settings tab while signed out or checking authentication;
- showing the Settings tab while signed in;
- blocking direct signed-out Settings navigation and restoring it after sign-in;
- rendering every catalog entry with its exact working keys and scope note;
- keeping unimplemented shortcuts absent;
- redirecting to Account when signing out from Settings;
- responsive Settings layout and accessible shortcut markup;
- no regressions to existing route and authentication behavior.

Verification will include focused route/auth/settings tests, the complete root test suite with unrelated worktrees excluded, a production build, and an available local browser check.
