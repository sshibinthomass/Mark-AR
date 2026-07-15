# Unique-Link Floor Placement Design

## Goal

Extend every authorized `#/scan/<scan_id>` experience with a native Mark-AR floor-placement mode. The link must continue to auto-start its existing image-target scan, while a viewer can switch to floor placement and place the target's complete saved scene as one unit.

Everything runs inside Mark-AR. Web-AR is only the behavioral and implementation reference. Mark-AR must not redirect to Web-AR, embed Web-AR, transfer the viewer to another route or origin, or depend on the Web-AR frontend at runtime.

## Confirmed Requirements

- Opening `#/scan/<scan_id>` keeps the current focused target request, access checks, authentication return flow, and automatic MindAR camera startup.
- After the target loads, the scan controls expose a `Place on floor` action.
- `Place on floor` switches the current Mark-AR page from image-target scanning to native WebXR floor placement.
- The complete saved scene is placed together at one detected floor pose. Models, text, groups, relative transforms, authored heights, and animation tracks remain part of that one scene.
- Viewers do not place saved objects individually and do not receive the target editor or model picker in the shared-link view.
- Floor-placement controls act on the complete scene root. Placement, move, uniform scale, rotation, and reset never break apart the saved arrangement.
- Floor mode exposes a `Scan image` action that ends floor AR and returns to the same target's MindAR scanner.
- The generic `#/scan` route remains unchanged and does not expose the target-specific floor action.
- Target permissions remain authoritative. Floor mode is available only after the same focused scan endpoint has returned the authorized target.
- No Worker schema or saved-target metadata change is required. Floor placement is a viewer choice, not a persisted target mode.

## Architecture

Mark-AR gains a small WebXR floor runtime modeled on the proven single-object placement path in Web-AR. It uses Mark-AR's installed Three.js runtime and the saved `CloudImageTarget` already returned for the unique link. It does not import files from the Web-AR checkout and does not create a cross-repository runtime dependency.

The implementation has three boundaries:

1. A runtime-neutral target-scene builder loads and assembles the saved models, text, groups, transforms, and animations in Mark-AR's existing Y-up editor coordinate system.
2. The existing MindAR adapter wraps that Y-up scene in its current positive 90-degree X-axis conversion so image-target rendering remains unchanged.
3. A new floor-placement adapter attaches the same Y-up scene directly below a WebXR placement root and moves that root to a detected horizontal hit-test pose.

Both camera modes expose a small session lifecycle with explicit stop and cleanup behavior. A mode coordinator in `src/main.ts` owns which runtime is active and prevents an older asynchronous start from reactivating after the viewer has switched modes or navigated away.

## Target Scene Construction

The current `createCloudflareMarkerObject` path already understands model objects, text objects, groups, local and global placements, preset/custom animation tracks, and per-frame animation updates. That reusable graph construction is extracted from its MindAR-only wrapper.

The extracted scene object returns:

- one Y-up Three.js root containing the complete saved arrangement;
- an `update(delta)` operation for all active animation mixers and scripted tracks;
- a `dispose()` operation for loaded geometry, material, texture, and animation resources;
- a load failure if any required target asset cannot be prepared safely.

MindAR keeps its existing `cloudflare-preview-space` coordinate conversion. Floor AR must not reuse that rotated wrapper because it would tip the Y-up scene sideways. The WebXR hit-test matrix defines the floor root pose, while every saved object remains a local child with its authored scene transform.

The placed scene remains hidden until both asset loading and a valid floor placement are complete. The floor hit pose moves the scene root only; it never rewrites the stored object placements.

## Shared-Link User Flow

Opening an authorized unique link continues to:

1. fetch exactly one target from `GET /generate-3d/image-targets/scan/<scan_id>`;
2. preserve the exact link through sign-in when required;
3. start the existing focused MindAR scanner automatically;
4. show the existing target-specific status and camera retry behavior.

Once the target record is available, the scanner controls also show `Place on floor`. While WebXR support detection or floor-runtime preparation is pending, the action remains visible but disabled and the live status identifies the preparation state. On an unsupported device, the action stays visible but disabled beside the unsupported-device explanation while marker scanning continues normally.

Selecting `Place on floor` performs a mode switch inside the current scan page:

1. synchronously stop the MindAR render loop and release its camera resources;
2. replace the marker stage with Mark-AR's floor AR canvas and DOM overlay;
3. initiate `immersive-ar` from the same user click, preserving the browser's required user activation;
4. load and prepare the complete saved target scene;
5. guide the viewer to move the device until a floor reticle appears;
6. enable placement only after a valid hit-test pose exists;
7. place the complete scene root when the viewer taps `Place`, taps the gesture surface, or uses the XR select action.

While floor mode is active, the mode action reads `Scan image`. Selecting it ends the WebXR session, disposes the floor scene and renderer, restores the marker stage, and starts the same focused MindAR target again. If the viewer ends the native XR session directly, Mark-AR returns to the scan page with an explicit `Scan image` restart action rather than silently opening another target.

## Floor Runtime

The floor runtime is implemented inside Mark-AR with focused modules for support detection, session creation, hit testing, scene setup, and root transforms.

It requests:

- required WebXR feature `hit-test`;
- optional `dom-overlay`, `plane-detection`, and `light-estimation` features when the browser supports them;
- a `local` reference space through Three.js's WebXR renderer.

The scene contains a transparent WebGL canvas, camera, neutral environment lighting, a horizontal reticle ring, a placement root, and the target-scene root. Each XR frame updates the hit-test pose, reticle visibility, target animations, and renderer. A valid horizontal hit makes the visible `Place` action available.

The initial placement copies the hit-test pose to the placement root and reveals the complete target scene. After placement:

- dragging the placement control moves the complete root along the locked floor plane;
- pinching uniformly scales the complete root within safe bounds;
- the rotation control rotates the complete root around the floor's Y axis;
- `Reset` restores the authored root scale and rotation at the latest valid floor pose;
- placing again moves the complete root without cloning or splitting the scene.

The runtime does not include Web-AR's model picker, generated-model workspace, multi-object editor, authentication UI, Worker client, navigation shell, or full application state. Only the floor-detection and whole-root manipulation behavior is reproduced in Mark-AR.

## User-Activation and Session Coordination

WebXR session creation must stay in the direct `Place on floor` click chain. Mark-AR prepares support state, the renderer, and the Three.js AR session control after the focused target loads. The visible mode action is enabled only when that launcher is ready. Its click synchronously stops the marker session and immediately activates the prepared WebXR session control before any awaited operation.

Every start attempt receives a monotonically increasing request token. Route changes, target changes, mode switches, authentication redirects, and explicit stop actions invalidate the token. A resolved but stale MindAR compile, asset load, or WebXR preparation must dispose itself instead of attaching a canvas, camera stream, scene, or animation loop.

Only one of these may exist at a time:

- active MindAR session;
- active or pending WebXR floor session;
- visible AR canvas and camera stage;
- animation loop for the focused target.

## Interface and Copy

The existing Mark-AR scanner panel remains the visual home for both modes. The new mode action is a secondary control beside the existing camera action and follows the current Mark-AR palette, typography, corner radius, focus treatment, and mobile safe-area spacing.

Floor mode uses concise state-based guidance:

- preparing: `Preparing floor placement...`;
- scanning: `Move your phone until the floor ring appears.`;
- ready: `Floor found. Tap Place.`;
- placed: `<target label> placed on the floor.`;
- ended: `Floor AR ended. Scan the image or place it again.`;
- unsupported: `Floor placement needs Android Chrome with WebXR. Image scanning is still available.`

The visible actions use stable names: `Place on floor`, `Place`, `Scan image`, `Reset`, and `Restart floor AR`. Status changes use the existing live region. Controls have visible keyboard focus, meaningful accessible names, and touch targets appropriate for a phone held in one hand. Motion-only guidance is not required to understand the state.

## Failure and Fallback Behavior

- A `401`, `403`, or `404` focused-target response behaves exactly as it does now and never exposes floor mode.
- If immersive AR is unsupported, `Place on floor` remains visible but disabled and the page reports the unsupported-device message without stopping the working marker scanner.
- If WebXR session creation is rejected, Mark-AR restores the scan controls and keeps `Scan image` available.
- If a required scene asset fails to load after the WebXR session begins, the overlay reports the asset failure and offers `Scan image` plus `Restart floor AR`.
- If no floor hit exists, the scene cannot be placed. Mark-AR does not guess a floor position below the camera.
- Leaving the scan route always stops whichever camera mode is active, cancels pending work, removes canvases and overlays, releases camera/XR resources, and disposes the scene.
- Switching modes never falls back to the generic target collection or changes the URL.

## Data and Security Boundaries

Floor mode consumes only the already-authorized `CloudImageTarget` returned for the current scan ID. It does not make the target public, weaken access rules, expose editor actions, or send target data to another frontend.

The Worker remains the source of the target record and asset URLs. Mark-AR remains the only frontend involved after the link opens. Existing bearer-token handling and asset delivery rules remain unchanged.

## Testing

All production behavior follows test-driven development.

Focused unit tests cover:

- runtime-neutral scene construction for models, text, groups, placements, and animations;
- preservation of the existing MindAR positive 90-degree X-axis adapter;
- direct Y-up scene attachment in floor mode;
- WebXR support detection and launcher readiness;
- hit-test acquisition, reticle visibility, and placement gating;
- placing one complete scene root at one hit pose;
- whole-root move, scale, Y rotation, reset, and re-placement;
- per-frame animation updates and complete disposal;
- stale-start cancellation and single-session ownership.

Target-specific integration tests cover:

- automatic MindAR startup remains unchanged on `#/scan/<scan_id>`;
- `Place on floor` appears only after an authorized focused target loads;
- the generic `#/scan` route remains unchanged;
- clicking the floor action stops MindAR and starts the native Mark-AR floor runtime with the exact loaded target;
- returning to `Scan image` stops floor AR and restarts the same target scanner;
- unauthorized, missing, unsupported, rejected-session, asset-error, and route-departure behavior;
- multi-object, text, grouped, and animated fixtures are passed as one scene rather than individual placement items.

Completion requires the focused tests, the full Mark-AR test suite, a normal production build, a GitHub Pages base-path build, desktop browser checks for controls and unsupported fallback, and a physical Android Chrome/WebXR smoke test. The device smoke test must confirm floor reticle detection, one-tap whole-scene placement, upright orientation, authored relative layout, animation, whole-root controls, mode switching, and cleanup after leaving the route.

## Out of Scope

- Redirecting, linking, embedding, or switching to the Web-AR frontend.
- Sharing Web-AR source files or creating a runtime package dependency between the repositories.
- Adding floor-placement metadata to Worker records.
- Adding floor mode to the generic `#/scan` route.
- Editing or placing saved objects individually from a shared link.
- Showing the model library, generation flows, account workspace, target editor, or saved-layout editor in floor mode.
- Adding iOS Quick Look or a non-WebXR native fallback.
