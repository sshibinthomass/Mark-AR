# YouTube AR Transport Controls Design

## Goal

Add reliable play, pause, rewind, and forward controls to active YouTube
videos in both image-target and floor AR.

The controls remain inside the AR experience. They are rendered in 3D space
above the active video, follow its transform, and never open a fullscreen
player.

## User Experience

Before activation, the existing YouTube thumbnail remains unchanged. Tapping
the thumbnail creates the embedded player and starts playback as it does
today.

When the player is ready, a three-button transport bar appears directly above
the video:

- `↶ 10` rewinds 10 seconds;
- the center button toggles between `Play` and `Pause`;
- `10 ↷` advances 10 seconds.

Each control is a native HTML button rendered by the existing CSS3D renderer.
The bar and buttons therefore occupy the same 3D coordinate space as the
video while retaining reliable pointer, touch, keyboard, and accessibility
behavior.

The bar is always visible while that video player is active. It disappears
with the player when its marker is lost, the floor session ends, AR stops, or
the manager is disposed.

## 3D Layout

The video and controls use two CSS3D objects in one Three.js hierarchy.

- The video object owns the 480-by-270 `.youtube-css3d-player` wrapper and is
  synchronized from the registered surface root each update. Its CSS-pixel
  scale is `1 / 270`.
- A separate `.youtube-css3d-controls-frame` object is parented to the video
  object at local Y `179`: half the video height, the 14-pixel gap, and half
  the 60-pixel control height.
- The controls object has a local Three.js scale of `270`, counteracting the
  video object's CSS-pixel scale. Its frame is therefore `240 / 270` by
  `60 / 270` CSS pixels.
- The native `.youtube-transport-controls` UI inside the frame remains 240 by
  60 CSS pixels and applies the reciprocal CSS scale `1 / 270`.

The reciprocal object/CSS scales give Chrome a stable, pointer-addressable
CSS3D frame while preserving the intended world-space size. Parenting the
frame object to the video object makes the bar inherit the current video
position, rotation, and scale, including floor-object and whole-experience
transforms. The controls DOM is deliberately not an overflowing descendant
of `.youtube-css3d-player`; Chrome does not reliably hit transformed content
outside a CSS3D object's border box.

During each manager update, the current control frame and button layout boxes
are projected through the controls object's actual world matrix and the
current camera/renderer viewport. Pointer fallback hit-testing uses the
resulting quadrilaterals, not transformed axis-aligned bounding boxes.
Geometry that is degenerate or crosses behind the camera is not routable.
When projected regions overlap, a camera ray is intersected with each current
control plane. The closest positive intersection wins; activation/paint order
is used only for coplanar depth ties.

The controls use a compact dark spatial surface, visible border, depth shadow,
and raised button treatment so they read as 3D controls against the camera
feed. Each button keeps a minimum touch target appropriate for mobile AR.

The controls must not cover the video, the YouTube iframe controls, or the
thumbnail before activation.

## Player API

`YouTubePlayerPort` will expose the YouTube IFrame Player API methods required
by the transport bar:

```ts
export type YouTubePlayerPort = {
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  getCurrentTime(): number;
  getDuration(): number;
  destroy(): void;
};
```

The production `YT.Player` adapter will continue to use inline playback and
native YouTube controls. It will additionally forward player-state changes to
the manager so the center button label stays synchronized when playback is
changed through either the custom controls or YouTube's own iframe controls.

YouTube player state `1` renders `Pause`. Paused, ended, cued, and unstarted
states render `Play`. Buffering retains the last stable label to avoid visual
flicker.

## Seek Behavior

Rewind calculates:

```ts
Math.max(0, player.getCurrentTime() - 10)
```

Forward calculates:

```ts
Math.min(player.getDuration(), player.getCurrentTime() + 10)
```

If the duration is not yet available or is not a positive finite number,
forward seeks to `currentTime + 10` and lets YouTube clamp the value.

Both actions call `seekTo(targetSeconds, true)`. Seeking does not explicitly
toggle playback. A paused video remains paused according to the YouTube
IFrame Player API.

Invalid or non-finite time values are normalized to zero so a control cannot
send `NaN` or an infinite value to the player.

## Event Ownership

There are two browser input paths with the same ownership invariant: a contact
that starts on a transport target remains owned by that exact active control
generation for its complete lifecycle.

On the native path, the complete `.youtube-transport-controls` root owns
pointer, touch, compatibility-mouse, and click propagation, including padding
and flex gaps. Pointer capture keeps a contact contained when it moves outside
the root after starting there. Native button click and keyboard activation
still execute on the accessible HTML buttons. A capture-phase guard suppresses
the browser's retargeted click when the physical pointer release, checked with
`elementFromPoint()`, no longer matches the exact originating button. Ordinary
same-button releases and clicks without a matching pointer completion
(including keyboard and manager-routed programmatic activation) remain native.

Chrome can render the deeply scaled CSS3D buttons while returning the renderer
layer from coordinate hit-testing. The manager therefore keeps a fallback
layer router. Each pointer, touch, or mouse contact records:

- its source and contact identifier;
- the active player generation that owned the start;
- the exact originating bar or button element;
- whether release still hit that same owner and element.

Only a same-target release on the same still-active button can invoke a
command. A bar-background start can never become a button command. Player
deactivation purges its command authorization from active and completed
contacts while retaining lifecycle containment, so a stale contact cannot
retarget a newly exposed player. Compatibility clicks remain bounded by
identifier when available, four CSS pixels, and 750 milliseconds; paired
pointer/touch completions for one physical touch are deduplicated.

As defense in depth, `FloorGestureController` and `mindarRuntime` exclude the
final `.youtube-css3d-player`, `.youtube-css3d-controls-frame`, and
`.youtube-transport-controls` topology in addition to ordinary interactive
elements. Transport input therefore cannot:

- select the video as a floor transform target;
- move, scale, or reposition the floor experience;
- trigger thumbnail activation again;
- activate a different marker object.

Native button semantics remain available to touch, mouse, keyboard, and
assistive technologies. The accessible names are `Rewind 10 seconds`,
`Pause video` or `Play video`, and `Forward 10 seconds`.

## Shared Marker and Floor Behavior

Both marker and floor AR already create the same `YouTubePlayerManager`.
The transport UI and playback commands will remain entirely inside that
manager, so both modes receive identical behavior without separate UI
implementations.

No changes are required to target persistence, Studio media authoring,
marker detection, floor selection scope, or image-target placement.

## Lifecycle and Errors

- Each activation receives a monotonic generation before asynchronous player
  creation begins. The manager stores that pending generation per surface and
  excludes the surface from further activation.
- The bar is created before player initialization but remains hidden until the
  player is ready.
- Marker loss and manager disposal invalidate and remove pending shells
  immediately. A player that resolves later is paused and destroyed and can
  never replace a newer generation.
- Marker reacquisition may create a new pending generation. Out-of-order
  resolution commits only the generation that still owns the surface's
  pending slot.
- Player creation failure removes the wrapper and controls and restores the
  existing thumbnail/error behavior.
- Target loss, session end, relaunch, stop, and disposal remove the video
  wrapper, controls frame, listeners, and active player together.
- A late state-change event for a removed player is ignored by checking the
  active-player generation.
- Transport actions operate only on the active player associated with their
  originating control generation.
- Existing playback error reporting is unchanged.

No timers or polling loops are introduced. Player-state synchronization is
event-driven.

## Testing

### Player manager unit tests

- The bar appears only after player readiness.
- Pending surfaces cannot activate twice.
- Loss during player creation removes the pending frame; a later resolved
  player is paused and destroyed.
- Loss, reacquisition, and out-of-order player resolution leave only the new
  generation active.
- It contains three native buttons in rewind, play/pause, forward order.
- Rewind seeks back exactly 10 seconds and clamps at zero.
- Forward seeks ahead exactly 10 seconds and clamps to a known duration.
- Forward remains safe when duration is unavailable.
- Pause calls `pauseVideo`; the state event changes the center label to
  `Play`.
- Play calls `playVideo`; the state event changes the center label to
  `Pause`.
- Native iframe state events keep the label synchronized.
- Invalid current-time and duration values never produce invalid seek values.
- Each active video controls only its own player.
- Creation failure and every cleanup path remove the controls.
- Fallback contacts invoke only their exact originating button after a
  same-target release; changed commands, moved scene geometry, bar origins,
  and deactivated owners cannot retarget.
- Rotated and perspective-projected blank corners are excluded by
  point-in-quad testing.
- Near/far overlaps select current visual depth; activation order resolves only
  coplanar ties.

### Interaction regressions

- The native transport root contains padding, gaps, and contacts that move
  outside after starting inside.
- Floor gestures ignore descendants of the video wrapper, controls frame, and
  transport root.
- Marker runtime pointer interception ignores the final controls topology.
- Floor video activation still plays without moving the experience.
- Image-target video activation remains unchanged.

### Style and integration tests

- The bar is positioned above, not over, the video.
- Buttons retain mobile-size touch targets and visible focus states.
- The built application includes the transport controls in both floor and
  image-target player flows because both use the shared manager.

## Out of Scope

- A custom progress slider or elapsed-time display.
- Volume, mute, playback-speed, captions, or fullscreen controls.
- Persisting playback position.
- Separate control placement in Studio.
- Replacing YouTube's native iframe control bar.

## Acceptance Criteria

1. After a YouTube thumbnail is activated, three 3D buttons appear above the
   video in marker and floor AR.
2. Rewind and forward move playback by 10 seconds with boundary clamping.
3. The center button reliably pauses and resumes playback, and its label
   reflects the current player state.
4. The separate counter-scaled control object follows video movement,
   rotation, and scale.
5. Control taps never move, select, scale, or reposition the floor object.
6. The controls disappear and release player resources on every existing
   cleanup path.
7. Existing thumbnail activation, playback-error recovery, marker AR, floor
   AR, and target persistence behavior remain unchanged.
