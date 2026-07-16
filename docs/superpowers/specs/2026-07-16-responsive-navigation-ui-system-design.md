# Responsive Navigation and UI System Design

## Goal

Make every Mark-AR page and in-page AR mode easy to enter, understand, and leave on desktop and mobile. The work must add an unmistakable return action to floor placement, remove navigational dead ends, prioritize the correct controls at each viewport size, and unify buttons, typography, spacing, alignment, and interaction feedback without replacing the product's established identity.

## Product Grounding

Mark-AR is a technical creative studio for people who build and view image-anchored and floor-placed WebAR scenes. Its audience includes creators configuring targets on desktop and viewers scanning or placing scenes from a phone. The interface's single job is to keep the user oriented while moving through the real workflow:

1. choose or create a target;
2. add and arrange content;
3. scan the image or place the saved scene on a floor.

The design preserves the existing teal-and-gold technical studio identity. It refines the current calibration-grid and target-registration language rather than introducing an unrelated visual brand.

## Confirmed Direction

Use a **studio shell plus immersive task mode**.

- Normal pages share one persistent, predictable application shell.
- Desktop creation tasks use the available canvas width and retain a professional workspace layout.
- Mobile pages reorder content around the user's immediate task rather than shrinking the desktop arrangement.
- Camera and floor-placement modes become focused workspaces with their own visible contextual exit.
- Route destinations are explicit. Controls do not depend on browser history to know where “back” should go.

This direction was selected over an always-visible dashboard frame, which would consume too much camera and editor space, and a linear wizard, which would slow experienced creators and require an unnecessary workflow rewrite.

## Audit Findings

The existing hash routes and authentication redirect behavior are functionally sound. Home, Scan, Account, locked Targets, exact protected scan links, and page-back navigation already resolve to the expected route.

The remaining problems are structural and visual:

- Floor placement fills the camera stage but has no exit inside that visual context. The existing `Scan image` control remains in the scanner control strip outside the overlay and can fall below the mobile viewport.
- On mobile Scan, the large camera stage appears before the status and primary camera action, so the next action is initially out of view.
- On mobile Targets, the desktop canvas-first order pushes setup and save controls too far down the page.
- On mobile Account, explanatory security content appears before the sign-in form even though authentication is the page's primary task.
- The mobile top shell consumes excessive vertical space while providing only three route choices and no explicit Home item.
- Desktop Home renders three mode cards in a five-column grid, producing an accidental empty region.
- The generic `Back` label does not state its destination and changes alignment between viewports.
- Buttons, link-buttons, tab controls, tool controls, and destructive actions use overlapping but inconsistent sizing and visual rules.
- Page heading widths, card padding, spacing, and action alignment vary by page.

## Information Architecture and Navigation

### Global destinations

The global navigation contains four explicit destinations:

- `Home`
- `Scan`
- `Targets`
- `Account` or `Sign in`, depending on authentication state

The brand remains a Home link, but Home also appears as a named navigation item so the route model is visible rather than implied.

Targets retains its existing authentication guard. When signed out, its link points to Account, communicates the locked state, and restores the pending target destination after successful authentication. Exact protected scan links retain their current sign-in-and-return behavior.

### Route activation

Every route change must:

- expose exactly one `[data-page]`;
- update `aria-current="page"` on every matching navigation representation;
- scroll the document to the start of the new page;
- move programmatic focus to the active page heading without showing a focus ring for pointer navigation;
- stop and dispose active camera or XR work when leaving Scan;
- preserve the current exact target scan URL while switching between marker and floor modes.

Unknown routes continue to resolve to Home.

### Page-level return control

Scan, Targets, and Account use the same page-heading component. Its return control reads `Home`, includes a left-arrow icon, and always links to `#/`. It is not a generic history action.

On desktop, the return control sits to the left of the heading block. On mobile, it remains a compact 44-pixel control aligned with the heading rather than becoming a full-width bar.

### Floor-placement return control

Floor placement receives a dedicated `Back to image scan` button inside the floor overlay, pinned to the top-left safe area. It is visible in every floor state:

- scanning for a floor;
- floor ready;
- scene placed;
- session ended;
- runtime error.

The control stops the WebXR session, restores the same focused target's marker scanner, and never navigates to generic Scan, Home, or another target. It remains independent of the bottom placement tray, so an error or crowded tray cannot remove the exit.

The existing external floor-mode toggle is used only to enter floor placement. It reads `Place on floor` in marker mode and is hidden while floor mode is visible. This avoids presenting two competing return controls.

## Responsive Application Shell

### Desktop shell

At widths above 760 pixels:

- retain the sticky translucent studio bar;
- keep the brand at the left and the four destinations at the right;
- use one 56-pixel control height rhythm;
- constrain standard content to 1040 pixels and workspace content to 1180 pixels;
- align the navigation, page heading, and primary content to the same outer grid.

### Mobile shell

At widths of 760 pixels and below:

- reduce the top shell to a compact brand bar;
- move the four route links into a fixed bottom navigation bar;
- give the content bottom padding equal to the navigation height plus the device safe area;
- use icon-and-label navigation items with visible active state and no icon-only destinations;
- maintain at least 44-by-44-pixel touch targets;
- hide the bottom navigation while floor AR is active;
- hide it while a marker camera session is actively occupying the scan stage, then restore it when that session stops or the route changes.

The bottom bar is part of the same route navigation rather than a second navigation model. Authentication labels and locked Targets behavior update in both viewport modes.

## Page Designs

### Home

Desktop keeps the current split hero because it communicates the product's AR subject clearly. The layout is corrected to:

- copy and real three-step workflow on the left;
- technical AR preview on the right;
- exactly three equal action cards below.

The numbered Target → Objects → AR structure remains because it represents a real ordered process. The current five-column mode-card grid is replaced by three equal columns.

Mobile reorders the page for action:

1. product statement;
2. three destination cards;
3. compact workflow strip;
4. decorative AR preview.

Cards become compact rows rather than tall stacked tiles. The preview is reduced in height and placed after useful navigation, preventing decorative content from delaying the first action.

### Scan

Desktop retains the large camera stage with a status/action strip below it.

Mobile places the scanner status and primary action before the camera stage. This ensures `Start camera`, retry, and floor availability are visible before the user scrolls into the stage. The stage uses the remaining viewport proportion without forcing essential actions below the fold.

When marker AR is active, the camera view is the dominant surface. When floor AR is active:

- the new `Back to image scan` control occupies the top-left safe area;
- concise mode/status text occupies the top or bottom tray;
- placement controls remain in the bottom safe area;
- global mobile navigation and the external scanner control strip are hidden;
- all placement controls remain reachable with one-handed touch.

### Targets

Desktop retains the two-column creator workspace:

- preview canvas and model rail on the left;
- inspector, saved targets, and save actions on the right.

The top of both columns aligns. The inspector uses the same card radius, padding, headings, labels, and button variants as the rest of the application. Preview tools remain visually distinct as dark “instrument” controls, but use the shared sizing and focus tokens.

Mobile changes the order to:

1. page heading;
2. inspector and target setup;
3. save action strip;
4. preview workspace and model rail.

The save strip becomes sticky within the page when editing data is present, while respecting the bottom navigation safe area. The preview remains large enough for direct manipulation but no longer blocks access to target setup. Inspector tabs horizontally fit the viewport, preserve their labels, and use 44-pixel targets.

### Account

Desktop retains the two-panel composition:

- protected-workspace explanation on the left;
- account form or signed-in actions on the right.

Mobile places the account form first because signing in or creating an account is the page's primary job. The explanatory security panel follows as supporting context. The form switch, fields, primary action, signed-in identity, Open Targets link, and Sign out action all use the shared component system.

## Visual System

### Palette

The existing palette is retained and assigned explicit roles:

- **Studio ink — `#102326`:** primary text and high-contrast controls.
- **Canvas mist — `#F4FBFA`:** application background.
- **Instrument teal — `#0F766E`:** labels, active outlines, progress, and technical UI.
- **Active mint — `#5EEAD4`:** primary actions and successful active states.
- **Guidance gold — `#FBBF24`:** selected transform tools, floor targets, and attention markers.
- **Failure red — `#B91C1C`:** destructive actions and errors only.

White and near-black surfaces remain supporting neutrals. Teal and gold are not interchangeable: teal means primary action or active system state; gold means selection, spatial guidance, or attention.

### Typography

No network font dependency is added.

- **Display role:** `Arial Black`, `Segoe UI Black`, then the body stack. Used only for hero and page titles.
- **Body role:** `Segoe UI Variable Text`, `Inter`, system sans-serif. Used for instructions, forms, cards, and navigation.
- **Utility role:** system monospace. Used sparingly for spatial/tool labels, IDs, and compact technical status where the data-like voice is useful.

The shared type scale is:

- hero: `clamp(46px, 7vw, 76px)`;
- page title: `clamp(32px, 4.5vw, 52px)`;
- section title: `24–32px`;
- card title: `17–20px`;
- body: `15–16px`;
- control: `13–14px`;
- label/eyebrow: `11–12px`.

Interface copy uses sentence case and stable action verbs. `Back`, `Submit`, and vague failure text are replaced with explicit destinations or outcomes.

### Spacing and alignment

All layouts derive from a 4-pixel base:

- control gaps: 8 pixels;
- card internal gaps: 12 or 16 pixels;
- card padding: 16 pixels mobile, 20–24 pixels desktop;
- section spacing: 24 pixels mobile, 32 pixels desktop;
- major composition spacing: 48 pixels and above.

Standard pages share one horizontal edge. Heading copy uses a consistent maximum width. Adjacent columns align at their top edge. Action rows align primary actions first and destructive actions last.

### Shape and elevation

- controls: 8-pixel radius;
- cards and navigation shell: 12-pixel radius;
- large visual stages: 12-pixel radius;
- pills are reserved for statuses, compact badges, and avatar-like identity elements.

One soft teal-tinted elevation scale replaces page-specific shadows. Dark AR and preview surfaces use borders rather than large shadows.

### Signature element

The product's signature remains the **AR registration system**: calibration grid, thin target frames, and a single gold spatial marker. This language appears in the Home preview, active camera surfaces, and selected spatial tools. It is meaningful to marker registration and floor placement, not generic decoration.

The grid and marker are restrained elsewhere so the signature does not compete with forms or navigation.

## Component System

### Buttons and links

All action controls share the same base dimensions, typography, focus treatment, disabled state, and transition timing.

- **Primary:** active mint fill, studio ink text. One primary action per local decision area.
- **Secondary:** light surface, teal border, studio ink text.
- **Quiet:** transparent surface for low-emphasis navigation and tool actions.
- **Selected tool:** guidance gold fill on dark instrument surfaces.
- **Danger:** pale red surface and failure-red text; never styled like a primary action.
- **Inverse AR:** dark translucent surface with white text and teal/gold focus ring.

Link-buttons and buttons with the same role render identically. Disabled controls use `not-allowed` except controls that are genuinely waiting on asynchronous preparation, which may use a progress cursor and `aria-busy`.

### Form controls

Inputs, textareas, selects, file controls, and ranges use:

- consistent labels above controls;
- 44-pixel minimum interactive height;
- the same border, radius, background, and focus ring;
- helpful text below the control;
- error text adjacent to the relevant field or action region.

### Tabs and toolbars

Tabs use a shared segmented-control treatment. Active tabs rely on fill, border, and `aria-selected`, not color alone. Transform tools use the same sizing but retain the dark instrument surface and gold selected state.

### Status and errors

Status messages describe current state and the next useful action. Floor, camera, authentication, target-save, and model-load statuses use consistent live-region behavior.

Errors state what failed and how to recover. Empty target lists invite creation rather than presenting a dead end.

## Motion and Accessibility

- Motion is limited to one purposeful entrance for contextual AR controls and small hover/press feedback.
- `prefers-reduced-motion: reduce` removes entrances, smooth scrolling, and nonessential transitions.
- Every interactive element has visible keyboard focus.
- Mobile touch targets are at least 44 pixels.
- Color is never the only indicator of selected, locked, failed, or active state.
- AR overlays account for top and bottom safe areas.
- Headings, navigation labels, button labels, and status text remain understandable without the decorative preview.
- The application maintains a logical keyboard order when content is visually reordered at mobile widths.

Because CSS `order` must not create a mismatch between visual and DOM reading order, task-critical responsive changes use a small layout coordinator that moves the existing panel nodes at the breakpoint. Controls are never duplicated, IDs remain unique, and DOM order matches the visible order at both desktop and mobile sizes. Pure CSS reordering is reserved for decorative or non-interactive supporting content.

## Implementation Boundaries

The redesign changes the application shell, page composition, floor-placement UI state, responsive styling, and navigation focus behavior. It does not change:

- Worker APIs or authentication semantics;
- target data models;
- MindAR marker behavior;
- WebXR placement math or gestures;
- target editor persistence;
- route names or exact scan-link format;
- model, text, grouping, or animation features.

Reusable navigation, page-heading, button, tab, form, and status styles should replace narrowly scoped duplicates where this can be done without unrelated application refactoring.

## Testing and Acceptance Criteria

All behavior changes follow test-driven development.

### Navigation tests

- Home, Scan, Targets, and Account render in global navigation.
- Active desktop and mobile navigation representations receive `aria-current="page"`.
- Signed-out Targets remains locked and restores after authentication.
- Exact protected scan links still return to the exact scan ID after authentication.
- Every non-Home page exposes an explicit Home destination.
- Route activation shows exactly one page, scrolls to the top, and focuses the active heading.
- Leaving Scan stops the active marker or floor session.

### Floor tests

- The floor overlay contains `Back to image scan`.
- The floor return control is visible in scanning, ready, placed, ended, and error states.
- It is hidden outside floor mode.
- Entering floor mode hides the external `Place on floor` toggle and mobile global navigation.
- Returning stops floor AR and restarts the same target-specific marker scanner.
- Failed or already-ended floor sessions still leave the return action usable.

### Responsive structure tests

- Desktop Home has three equal mode-card columns.
- Mobile Home presents destination cards before the decorative preview.
- Mobile Scan presents status/actions before the camera stage.
- Mobile Targets presents setup/save before the preview.
- Mobile Account presents the form before the explanatory panel.
- Mobile content includes safe-area clearance for the fixed bottom navigation.
- No page produces horizontal document overflow at 320, 390, 768, 1024, or 1440 pixels.

### Visual-system tests

- Primary, secondary, quiet, selected, danger, and inverse controls use shared classes or tokens.
- Interactive controls meet the required minimum heights.
- Page headings and cards use shared spacing, radius, and typography tokens.
- Reduced-motion rules cover navigation, cards, and AR overlay entrances.

### Verification

Completion requires:

- focused red-green unit and integration tests;
- the full Vitest suite;
- a normal production build;
- a GitHub Pages base-path build;
- rendered desktop checks at 1440 by 1000;
- rendered mobile checks at 390 by 844;
- keyboard navigation and focus checks;
- injected floor-state visual checks for every overlay state;
- a physical Android Chrome smoke test for the final floor-mode return control when hardware is available.

## Out of Scope

- Replacing hash routing with another router.
- Adding a remote font service or UI framework.
- Rebuilding the editor as a wizard.
- Changing authentication permissions or account approval behavior.
- Changing AR scene content, transforms, animation, or persistence.
- Adding new target creation features.
- Redesigning the Worker or Cloudflare backend.
