# AnchorAR by Arvenilo Website Redesign

## Goal

Redesign the complete existing web product as **AnchorAR by Arvenilo** using the supplied Arvenilo Design Handoff. The result combines a story-led product website with immediate access to the working scanner, creation studio, and account flows. It must feel recognizably Arvenilo while preserving all current AR, editing, authentication, sharing, and routing behavior.

## Approval and Ownership

- Design direction: **Story, then studio**
- Approval state: approved for implementation by the product owner on 2026-07-17
- Design source: `Arvenilo-Design-Handoff/`
- Product name: **AnchorAR by Arvenilo**
- Company name: **Arvenilo**
- Product status: **AVAILABLE NOW**

## Product Grounding

AnchorAR is Arvenilo's current web-based augmented-reality product. It lets a creator use an image as a real-world trigger, place 3D models or styled text above it, publish the experience, and share an exact scan link or branded QR code. A viewer can open the link, grant camera access, scan the target, and optionally move the saved scene onto a floor through WebXR.

The product serves two audiences:

- visitors evaluating what AnchorAR does and where it is useful;
- creators and viewers who need to scan, build, edit, publish, or manage an experience immediately.

The homepage must serve both audiences without placing a marketing gate in front of the working product.

## Confirmed Direction

Use a **story-first hybrid homepage followed by a task-first product shell**.

The homepage opens with a calm editorial explanation of AnchorAR, then proves the concept through one dark spatial demonstration, then exposes the working Scan, Studio, and Account destinations. Supporting marketing sections explain use cases, current capabilities, permissions, compatibility, and the Arvenilo relationship.

Dedicated product routes remain direct application surfaces:

- Scan is a focused camera experience.
- Image Targets is visibly renamed **AnchorAR Studio**.
- Account is a quiet, trustworthy access surface.

This direction was selected over a product-dashboard-first homepage, which did not establish enough category and brand context, and a split workspace hub, which treated first-time visitors as returning operators.

## Source-of-Truth Rules

Use the supplied handoff in this order:

1. approved PNG logo assets in `Arvenilo-Design-Handoff/03-Logos/`;
2. `Arvenilo-Design-Handoff/01-Guidelines/arvenilo-complete-brand-book.pdf`;
3. `Arvenilo-Design-Handoff/01-Guidelines/ARVENILO_PRODUCT_DESIGN_SYSTEM.md`;
4. the CSS and JSON token exports in `Arvenilo-Design-Handoff/02-Design-Tokens/`;
5. the product-specific decisions in this document.

Raster logo artwork must remain unchanged even when its embedded colors differ slightly from UI tokens.

## Brand Architecture and Assets

### Naming

- Use **AnchorAR by Arvenilo** for the complete endorsed product name.
- Use **AnchorAR** after the full name has been established in the current view.
- Use **AnchorAR Studio** for the authenticated creation and target-management workspace.
- Use **Arvenilo** only for the parent company and endorsement.
- Remove visible uses of `Mark AR`, `Marker AR`, `Marker Web AR`, and `Marker AR studio`.
- Do not expose backend implementation names such as `Web-AR Worker` or `Cloudflare` in normal customer-facing copy unless an error genuinely requires the technical detail.

Internal identifiers do not change in this redesign:

- package name `mark-ar`;
- GitHub Pages base path `/Mark-AR/`;
- existing hash-route paths;
- existing local-storage keys;
- API endpoints and payloads.

### Logo use

- Use the approved horizontal **AnchorAR by Arvenilo** lockup for the global shell and hero.
- Use the compact approved AnchorAR symbol for the favicon and compact mobile identity.
- Use the Arvenilo corporate lockup only in the company/footer area.
- Do not redraw, recolor, crop, rotate, outline, glow, shadow, or filter any logo.
- Place the dark product lockup only on Reality Mist, white, or another sufficiently light solid surface.
- Preserve a minimum full-lockup width of 92 pixels and a minimum symbol size of 18 pixels.

Approved source files:

- `Arvenilo-Design-Handoff/03-Logos/Transparent-PNG/04-anchorar-platform-transparent-QR.png`
- `Arvenilo-Design-Handoff/03-Logos/Transparent-PNG/04-anchorar-platform-transparent.png`
- `Arvenilo-Design-Handoff/03-Logos/Transparent-PNG/04-anchorar-platform-transparent-logo.png`
- `Arvenilo-Design-Handoff/03-Logos/Transparent-PNG/00-arvenilo-master-transparent.png`

## Visual Direction: Precision Spatial

### Palette

Use the canonical interface tokens without substitution:

- Spatial Void `#020A0C`
- Spatial Ink `#081D21`
- Spatial Surface `#0D2A2E`
- Spatial Surface Raised `#12363A`
- Reality Mist `#F4FBFA`
- Interface White `#FFFFFF`
- Signal Mint `#5EEAD4`
- Digital Violet `#7456F1`
- Anchor Gold `#F4B942`
- Context Slate `#4D6265`
- Mist Slate `#A8B9BB`
- Dark Border `#1D454A`
- Light Border `#C9DADA`
- Mint Wash `#D8F8F2`
- Violet Wash `#E9E5FF`
- Gold Wash `#FFF1CF`
- Error Dark `#B83E4B`
- Error Light `#FF9099`

Reality Mist and white carry editorial content. Spatial Ink and related surfaces carry the single product-demonstration moment, camera stages, and the 3D editor stage. Signal Mint identifies primary actions, active systems, and successful completion. Digital Violet is limited to connected or future-facing secondary information. Anchor Gold identifies one selected spatial target or focus; it is never a normal CTA color.

Use solid surfaces and cool one-pixel borders before shadows. Do not use glassmorphism, neon glow, decorative gradients, fake coordinates, floating AI spheres, or dense circuit/particle decoration.

### Typography

Self-host the supplied font files:

- Sora Variable, weights 600–700, for product statements and headings;
- Inter Variable, weights 400–600, for navigation, body copy, forms, and controls;
- IBM Plex Mono, weights 400–500, for short status, category, and utility labels.

Heading treatment is Sora weight 650, line-height 1.08, and tracking near `-0.035em`. Body copy uses Inter with line-height 1.6–1.7 and a maximum width of 66 characters. Uppercase utility text is reserved for short real labels such as `AVAILABLE NOW`, `CAMERA READY`, and `SAVED`.

### Layout and shape

- Full shell maximum: 1600 pixels.
- Wide spatial content: 1440 pixels.
- Standard content: 1200 pixels.
- Reading content: 720 pixels.
- Controls: 10-pixel radius.
- Cards: 16-pixel radius.
- Camera and 3D stages: 24-pixel radius.
- Pills: status, filters, and compact metadata only.

Use the handoff spacing scale from 4 to 128 pixels. Major section spacing uses `clamp(4.5rem, 8vw, 8rem)`. Each screen or section has one dominant focus.

### Signature element

The memorable AnchorAR element is a **working Spatial Aperture**: a real trigger frame, a converging path, and one gold signal point that becomes an interactive layer. It appears meaningfully in the homepage proof stage, scanner guide, selected editor target, and QR presentation. It does not repeat as decoration behind forms or every card.

One deliberate visual risk is the homepage's transition from a quiet, light editorial hero into a contained Spatial Void demonstration stage. The contrast expresses the move from physical context into an immersive layer. All surrounding sections remain restrained so this transition carries the brand moment alone.

## Global Application Shell

### Desktop

The desktop shell uses a solid light navigation bar with the approved horizontal product lockup on the left. The right side exposes:

- `Product` — returns to the homepage product statement;
- `Use cases` — returns to the homepage use-case section;
- `Scan` — opens the scanner route;
- `Studio` — opens the protected target-creation route or Account when signed out;
- `Account` or `Sign in` — reflects authentication state.

Scan and Studio remain visible product destinations; visitors never have to finish reading the marketing page before opening a tool. The active route is identified with text, border/surface treatment, and `aria-current`, not color alone.

`Product` and `Use cases` are homepage section links rather than new routes. Each uses `href="#/"` plus a section-target data attribute. When activated from Home, the link scrolls to the corresponding semantic section. When activated from another route, the shell activates Home first and then moves focus and scroll position to that section. This preserves the existing hash-route grammar and gives keyboard users a real focus destination.

### Mobile

At 767 pixels and below, use a compact top identity bar and a fixed four-item bottom navigation:

- Home
- Scan
- Studio
- Account or Sign in

Each item includes a familiar outline icon and visible text. The bar respects the bottom safe area and provides at least 44-by-44-pixel targets. It hides only while an active camera or floor-placement session requires the full viewport, and every immersive state retains a visible contextual exit.

### Route behavior

The existing routes remain:

- `#/`
- `#/scan`
- `#/scan/:scanId`
- `#/targets`
- `#/account`

Route activation continues to expose one page, update `aria-current`, scroll to the start, and focus the active page heading. Signed-out Studio links continue to preserve the protected destination. Exact target scan links continue to survive sign-in and return to the same scan ID.

## Homepage: Story, Then Studio

### 1. Editorial hero

The first viewport is light, spacious, and centered around the approved product lockup and one outcome.

Required copy:

- status: `ANCHORAR BY ARVENILO · AVAILABLE NOW`
- heading: `Interactive stories, anchored in reality.`
- body: `Use an image, product, or place to open a web-based AR experience—no app required.`
- primary action: `Create an experience`
- secondary action: `Open scanner`

The primary action follows the current authentication guard. The secondary action opens Scan directly. The hero contains no fake product metrics or speculative AI claims.

### 2. Spatial proof

A single dark product-demonstration section explains the real sequence:

1. **Anchor** — choose the real-world trigger;
2. **Compose** — place objects, text, and motion;
3. **Share** — publish one link or branded QR.

The visual is a restrained target frame and object layer with one Anchor Gold signal point. It may use one 600–1200-millisecond convergence animation on entry. Reduced-motion users see the final composed state immediately.

### 3. Product gateway

Three equal destinations appear immediately after the proof:

- **Scan an experience** — `Open the camera and view a shared AnchorAR target.`
- **Create in AnchorAR Studio** — `Build, arrange, publish, and manage an experience.`
- **Access your account** — `Sign in or create an account for protected studio tools.`

The destination and action wording must remain stable across cards, navigation, forms, and confirmation messages.

### 4. Use cases

Present specific, current applications without implying unsupported vertical-specific features:

- packaging and products;
- retail visualization;
- campaigns and events;
- learning and storytelling.

Each use case explains an outcome in one sentence and links back to either Scan or Create. Photography is not required for the initial implementation; the existing product proof and real interface are more credible than generic stock imagery.

### 5. Current capabilities

Explain only features present in the application:

- browser-based target scanning;
- image-target creation and access control;
- multiple 3D models and styled 3D text;
- grouping, transforms, camera presets, and animation;
- WebXR floor placement where supported;
- exact share links and branded QR codes.

Do not present reserved Arvenilo Agents, Spatial, or Network concepts as launched AnchorAR functionality.

### 6. Trust, permissions, and compatibility

State that AnchorAR requests camera access only when scanning or placing an experience. Explain that floor placement depends on compatible WebXR hardware/browser support and that normal image-target scanning remains available when floor AR is unavailable. Do not claim universal device support.

### 7. Arvenilo endorsement and footer

Close with the company statement `Where Intelligence Meets Reality.` and the approved Arvenilo corporate lockup. The footer reiterates that AnchorAR is an Arvenilo product without introducing unrelated future products.

## Scan Experience

Scan uses Product Demonstration mode:

- Spatial Ink or Spatial Void surrounds the camera stage.
- The stage is the dominant focus.
- The approved AnchorAR compact mark and current target name remain outside the WebGL/camera canvas.
- Status and permission copy explain the next action before camera access is requested.
- `Start camera`, retry, floor availability, and exit actions remain visible and specific.
- The scanner guide uses the Spatial Aperture frame and one signal point only when a target needs alignment.

On mobile, status and the primary camera action appear before the inactive stage. During an active marker or floor session, the stage may occupy the viewport, global bottom navigation hides, and an explicit return action remains visible in the safe area.

## AnchorAR Studio

The visible page title changes from Image Targets to **AnchorAR Studio** while the route remains `#/targets`.

### Desktop

Use a wide two-column creator workspace:

- left: the dark 3D preview stage, spatial tools, camera controls, and model rail;
- right: the light inspector with Target, Objects, Text, and Object tabs.

The selected target or object gets the one Anchor Gold focus treatment. Signal Mint remains reserved for primary save/add actions and active system states. Instrument controls use dark solid surfaces, visible borders, and real labels rather than decorative technical language.

### Mobile

The page order is:

1. page heading and current save/status state;
2. target setup or active inspector panel;
3. relevant primary save action;
4. 3D preview stage and model rail.

When a draft exists, the save strip may remain sticky above the bottom navigation. Inspector tabs remain labeled, keyboard accessible, and at least 44 pixels high. The DOM order must match the visual/focus order; interactive panels are moved rather than visually reordered with CSS alone.

### Existing features preserved

- target upload and label;
- scan access modes and account email sharing;
- model selection and placement;
- 3D text content, language, font, presets, and advanced style;
- multi-object selection and grouping;
- translate, rotate, and uniform scale;
- camera presets and view controls;
- animation presets and custom tracks;
- create, update, refresh, edit, delete, and saved-target listing;
- exact scan link, branded QR generation, sharing, downloading, copying, and opening.

## Account Experience

Account uses Editorial Light mode with a restrained dark trust panel.

- The form or signed-in action is the primary focus.
- The product name is AnchorAR, not the backend Worker name.
- Sign-in and account creation remain one segmented control.
- Labels remain above inputs and errors remain adjacent to the relevant action.
- The explanatory panel describes why an account protects creation and sharing controls.
- Mobile places the form before supporting trust content.
- The signed-in state exposes `Open AnchorAR Studio` and `Sign out` with clear hierarchy.

## Shared Components

### Actions

- Primary: Signal Mint fill with Spatial Ink text.
- Secondary: white or transparent surface with a visible cool border.
- Inverse: Spatial Surface with white text on dark fields.
- Quiet: text action with precise hover/underline feedback.
- Danger: Error Dark treatment and an explicit destructive label.

All actions use Inter, a minimum 44-pixel target, visible focus, and action-first wording. There is one primary action per local decision group. Anchor Gold is never a normal button color.

### Cards

Cards use a 16-pixel radius, one-pixel border, solid surface, title, current status where relevant, one-sentence outcome, and one clear next action. Avoid nested cards and decorative shadows.

### Forms and tabs

Inputs, selects, textareas, file controls, ranges, segmented controls, and tabs share the handoff token system. Labels sit above fields. Optional complexity remains progressive. Active tabs use fill, border, text, and `aria-selected` rather than color alone.

### Status and feedback

Use IBM Plex Mono for compact real status labels and Inter for the explanatory message. Status combines text with color or icon. Toasts confirm completed outcomes but never replace persistent information needed to continue.

Empty states explain what is missing and offer the next useful action. Loading states name the operation. Errors state what failed and provide a retry, correction, or fallback.

## State and Error Design

Existing application state and data flow remain unchanged: `main.ts` coordinates auth, routing, scanning, editing, persistence, and UI helpers; specialized modules continue to own their existing behavior. The redesign changes presentation and visible copy around those flows, not the APIs or stored data.

Required state treatments include:

- camera waiting, permission request, starting, active, stopped, denied, and failed;
- target loading, empty, draft, saving, saved, updating, failed, and retry available;
- model loading, loaded, unavailable, and failed;
- account checking, signed out, creating, awaiting approval, signed in, recovery attempted, and failed;
- QR generating, ready, sharing, fallback downloaded/copied, failed, and cancelled;
- floor AR unsupported, preparing, scanning, ready, placed, ended, and failed.

Errors must preserve recoverable user input and existing editor state. Backend names appear only when needed for diagnosis. Camera, identity, and floor-placement permissions are explained before request. When advanced rendering or floor AR is unavailable, the interface keeps normal navigation, scan information, and recovery actions usable.

## Responsive and Accessibility Requirements

Design and verify at 320, 390, 768, 1024, 1440, and 1920 pixels.

- Mobile uses one primary column and places outcome, current state, and primary action before media.
- Tablet preserves split layouts only while both columns remain readable.
- Desktop uses the 12-column system and constrained reading widths.
- Wide desktop increases gutters instead of stretching copy indefinitely.
- Touch targets are at least 44 by 44 pixels.
- Focus uses a 3-pixel Signal Mint ring with a 3-pixel offset.
- Every action is keyboard reachable and visibly focused.
- Color is never the sole indicator of status, selection, lock, or error.
- Semantic headings and landmarks remain intact.
- Important labels and actions stay outside canvas and camera content.
- Reduced motion removes convergence animation, camera-like transitions, smooth scrolling, and ambient movement without removing information.
- Safe areas, browser zoom, orientation changes, and the on-screen keyboard must not hide essential actions.

Target WCAG 2.2 AA for implemented states.

## Motion

- Hover and press: 120–180 milliseconds.
- UI reveal: 180–300 milliseconds.
- Section transition: 300–500 milliseconds.
- The single spatial proof moment: 600–1200 milliseconds.
- Page transitions never exceed 650 milliseconds.

Use the supplied standard, enter, and exit easing tokens. Do not scroll-jack, delay access to actions, or animate every card. Stop nonessential motion after interaction or when off-screen.

## Implementation Boundaries

Primary implementation surfaces are:

- `src/ui/appShell.ts` for the shell, homepage sections, route titles, product copy, and preserved hooks;
- `src/style.css` for tokens, fonts, full visual system, page layouts, components, states, and responsive behavior;
- `index.html` for title, description, favicon, and product metadata;
- public approved logo and font assets;
- visible product terminology in `src/main.ts`, `src/ui/authFormMode.ts`, and `src/app/authMessages.ts` where it is customer-facing;
- focused tests that assert brand, structure, design tokens, accessibility hooks, and preserved behavior.

All existing element IDs, `data-*` hooks, AR canvases, live regions, form names, routing values, and event bindings must remain available to their current consumers. Markup may be regrouped only when the hook and behavior remain intact.

Avoid a broad architectural rewrite. The current framework-free Vite and TypeScript stack remains. No new UI framework, CSS framework, remote font dependency, analytics system, backend service, or router is introduced.

## Test Strategy

Implementation follows test-driven development.

### Brand and shell tests

- The page metadata names `AnchorAR by Arvenilo` and contains no visible legacy product name.
- The shell renders an approved product logo asset with useful alternative text.
- Home, Scan, Studio, and Account remain discoverable.
- Signed-out Studio links remain protected and restore the intended route.
- The homepage contains the story hero, spatial proof, product gateway, use cases, current capability, trust/compatibility, and Arvenilo endorsement sections.
- Product status is expressed as text.

### Visual-system tests

- Canonical Arvenilo colors, fonts, radii, widths, spacing, and easing tokens exist.
- Local Sora, Inter, and IBM Plex Mono faces are declared.
- Signal Mint is used for primary actions and Anchor Gold for selected spatial focus.
- Shared focus, reduced-motion, minimum target, and responsive safe-area rules exist.
- Desktop, tablet, and mobile layout rules preserve the intended content order.

### Regression tests

- The existing route, auth, scan, target editor, model rail, inspector, saved target, floor AR, and QR behaviors remain covered.
- Required IDs and data hooks remain unique and present.
- Exact target scan URLs and the GitHub Pages base path remain unchanged.
- QR output continues to use the approved AnchorAR branding.

### Browser verification

- Inspect Home, Scan, Studio, and Account at 1440 by 1000 and 390 by 844.
- Inspect intermediate behavior at 768 and 1024 pixels.
- Check keyboard navigation, focus visibility, horizontal overflow, sticky/fixed controls, long labels, empty/loading/error states, and reduced motion.
- Confirm console output has no new errors.
- When hardware is available, smoke-test camera scanning and floor placement on compatible Android Chrome hardware.

### Completion commands

```powershell
npm test
npm run build
$env:GITHUB_PAGES = 'true'
npm run build
```

## Acceptance Criteria

- Every visible product identity reads AnchorAR by Arvenilo or an approved shortened form.
- The approved product and company logos are used without visual alteration.
- The homepage visibly combines the selected story-first marketing sequence with direct product access.
- Every existing route and current product capability remains functional.
- The scanner, studio, account, QR, and floor experiences use the same Arvenilo token and component system.
- The site works without horizontal overflow from 320 through 1920 pixels.
- Keyboard focus, reduced motion, touch targets, status text, and error recovery meet the specified accessibility requirements.
- The full Vitest suite and both production build modes pass.
- Final desktop and mobile browser captures show the intended hierarchy and no obvious visual regressions.

## Out of Scope

- Renaming the repository, package, deployment URL, GitHub Pages base path, local-storage keys, or API endpoints.
- Changing authentication, account approval, target permissions, persistence, or QR payload behavior.
- Replacing hash routing or the framework-free architecture.
- Adding new AR authoring features, use-case-specific workflows, analytics, billing, or account management.
- Presenting reserved Arvenilo capability families as launched products.
- Creating or tracing new vector logo masters.
- Adding unapproved monochrome or inverse logo variants.
