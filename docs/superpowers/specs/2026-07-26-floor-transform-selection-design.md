# Floor AR Transform Selection Design

## Goal

Make floor AR video taps reliable by separating playback gestures from transform
gestures. A normal tap must play an unselected YouTube object without moving the
placed experience. Moving or scaling requires an explicit long-press selection.

This interaction applies only to floor AR. Image-target AR, Studio editing, and
saved target data remain unchanged.

## Root Cause

`FloorGestureController` currently emits `onDrag` for every one-finger
`touchmove`, including the small movement that naturally occurs during a tap.
It can then emit `onTap` for the same gesture when the total movement remains
under 12 pixels.

In floor AR this moves the target before YouTube hit-testing. The video raycast
can then miss the moved plane, and the existing miss fallback places the scene
again. The visible result is that the object moves while the video does not
play.

The current runtime tests invoke `onTap` directly and therefore do not exercise
this real touch sequence.

## Interaction Contract

### Floor placement

- Before the experience is placed, the existing Place action and floor tap
  placement continue to work.
- After placement, tapping empty floor does nothing. It must not reposition the
  experience.

### Playback

- Outside transform mode, tapping a YouTube thumbnail attempts inline playback.
- A missed YouTube hit does nothing after placement.
- Player initialization failure remains nonfatal, restores the thumbnail, and
  shows the existing playback error.
- Successful retry clears the playback error as it does today.

### Selection and transforms

- A small `Select All` toggle is visible with the placed floor controls.
- `Select All` is enabled by default for every new floor session.
- The toggle chooses selection scope; it does not enter transform mode by
  itself.
- With `Select All` enabled, long-pressing any selectable object selects the
  complete placed experience.
- With `Select All` disabled, long-pressing an image, video thumbnail, text, or
  3D model selects only that authored object.
- Long-pressing empty floor selects nothing.
- A selection outline and a `Done` button indicate transform mode.
- While transform mode is active:
  - one-finger drag moves the selected target;
  - pinch scales the selected target;
  - taps do not start video playback;
  - tapping outside the selected target exits transform mode.
- Pressing `Done` exits transform mode.
- Changing `Select All` clears the active selection. The next long press uses
  the new scope.
- The rotation scroller remains enabled after placement without requiring a
  selection and always rotates the complete experience.
- Reset continues to reset the complete experience and also clears the active
  selection.

All viewer transforms are session-only and are never persisted to the saved
target.

## Gesture State Machine

`FloorGestureController` will distinguish an ordinary tap from a long press and
from transform gestures.

- Long-press delay: 450 milliseconds.
- Movement threshold: the existing 12 pixels.
- A single touch starts a pending press.
- Movement below 12 pixels while the press is pending does not emit drag.
- Releasing before 450 milliseconds with movement below 12 pixels emits one
  tap.
- Crossing 12 pixels before the long-press delay cancels the pending press. It
  emits neither tap nor transform drag while no runtime selection is active.
- Holding for 450 milliseconds with movement below 12 pixels emits one long
  press.
- After a long press establishes a selection, movement in the same gesture can
  emit drag.
- Once a selection remains active, later one-finger gestures can drag it after
  crossing the movement threshold without requiring another long press.
- Pinch events may be recognized normally, but the runtime ignores them unless
  a transform selection is active.
- Touch cancellation and disconnect clear timers and pending gesture state.

Interactive HTML controls and the active YouTube player keep their existing
event ownership.

## Scene Selection Model

`TargetSceneObject` will expose a read-only collection of selectable authored
objects in addition to `youtubeSurfaces`.

Each selectable entry contains:

- the authored object ID and kind;
- a stable interaction root used for session-only transforms;
- a descendant root used for recursive raycasting.

Every authored object receives an identity interaction wrapper. Its existing
placement and animation root becomes a child of that wrapper. This prevents
the animation update loop from overwriting floor-viewer movement and scaling.
The added identity level does not change marker rendering, authored grouping,
or Studio transforms.

Models become raycast-selectable through their recursively loaded meshes.
Images and videos use their media-plane meshes. Text uses its rendered meshes.
Objects that have not finished loading cannot be selected until their geometry
exists.

## Floor Runtime State

`FloorPlacementRuntime` owns floor-session selection state:

- selection scope: `all` or `object`, defaulting to `all`;
- active target: none, the placement root, or one selectable interaction root;
- temporary selection outline;
- transform helper for the active target.

Long-press hit-testing uses the current XR camera and its synchronized inverse
projection. With `all` scope, any selectable-object hit selects the placement
root. With `object` scope, the closest authored object hit selects its
interaction root.

Whole-experience transforms reuse `FloorSceneTransform`. Individual-object
movement intersects a horizontal plane through the selected object's world
position and converts the result into the interaction root parent's local
coordinates. Individual scaling multiplies the interaction root's session
scale.

Selection outlines are updated during the render loop and removed on
deselection, reset, session end, stop, relaunch, or disposal.

## UI Integration

The floor overlay gains:

- an accessible `Select All` toggle using `aria-pressed`;
- a compact `Done` button shown only during transform mode;
- a short selection status or hint;
- an active-selection visual outline in the WebXR scene.

These controls appear only in floor AR after placement. They do not appear in
image-target scanning.

The floor UI renderer receives explicit selection state so rerenders preserve
the correct toggle, Done button, and existing playback-error status.

## Lifecycle and Failure Handling

- A new floor session resets selection scope to `all` and has no active
  transform selection.
- Switching scope, resetting, stopping, external session end, relaunching, or
  disposing clears the selection and helper resources.
- A long press with no selectable hit is a no-op.
- A stale long-press or async hit result from an ended session cannot select or
  transform a newer session.
- A failed YouTube activation restores its thumbnail and does not enter
  transform mode or move any target.
- Active YouTube iframe controls remain interactive and are not reprocessed as
  transform gestures.

## Test Strategy

### Gesture controller

- Sub-threshold touch jitter emits tap but never drag.
- Movement reaching 12 pixels before the delay emits neither tap nor an
  unselected drag.
- A 450-millisecond hold emits long press once.
- Drag begins after long press and can continue in later selected gestures.
- Pinch delivery remains available for runtime gating.
- Timers and state are cleared on cancel and disconnect.

### Target scene

- Every image, YouTube, text, and model object exposes one selectable wrapper.
- Selectable wrappers preserve authored hierarchy and transforms.
- Session transforms on a wrapper survive animation updates.
- Disposal still releases all scene resources once.

### Floor runtime

- New sessions default to Select All.
- Long press with Select All selects and transforms the placement root.
- Select All off selects only the closest authored object.
- Long press on empty floor is a no-op.
- Drag and pinch do nothing without a selection.
- Individual movement/scale do not alter sibling objects.
- Rotation works without selection and rotates the whole experience.
- A normal video tap plays without moving the target.
- A post-placement video miss does not call placement.
- Tap outside and Done clear transform mode.
- Reset and every session cleanup path remove selection state and helpers.
- Stale gestures from an old session cannot affect a relaunched session.

### UI and integration

- Select All is pressed by default and floor-only.
- Done is shown only for an active selection.
- Scope changes clear the active selection.
- Playback errors and successful retry retain the correct selection controls.
- Image-target AR behavior and marker YouTube playback remain unchanged.

## Out of Scope

- Persisting viewer transforms.
- Editing saved target placement from the scanner.
- Changing image-target AR gestures.
- Adding per-group selection.
- Rotating individual objects with gestures or the rotation scroller.
- Replacing YouTube's native iframe controls.

## Acceptance Criteria

1. A normal floor-video tap starts inline playback without moving the
   experience.
2. Natural sub-threshold finger jitter cannot move a floor object.
3. Move and scale are impossible until a long press establishes transform
   selection.
4. Select All is enabled by default and transforms the complete experience.
5. Select All off allows one authored object to be selected and transformed
   without changing siblings.
6. Rotation remains available without selection and affects the complete
   experience.
7. Tap outside or Done exits transform mode.
8. Floor-session cleanup removes all selection state.
9. Image-target AR is behaviorally unchanged.
