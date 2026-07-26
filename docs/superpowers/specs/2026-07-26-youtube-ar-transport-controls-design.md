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

The control bar is a child of the existing `.youtube-css3d-player` wrapper.
It is positioned outside the video rectangle, centered above its top edge.

Because the controls share the video's CSS3D object:

- they inherit the video object's world position, rotation, and scale;
- they move when the floor object or complete floor experience moves;
- they scale when the video object or complete experience scales;
- no separate Three.js synchronization or selection metadata is required.

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

The transport bar remains inside `.youtube-css3d-player`, which is already
excluded from:

- `FloorGestureController` tap, long-press, drag, and pinch recognition;
- image-target scene pointer interception in `mindarRuntime`.

Buttons also stop propagation for their own click events. Pressing a transport
button therefore cannot:

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

- The bar is created before player initialization but remains hidden until the
  player is ready.
- Player creation failure removes the wrapper and controls and restores the
  existing thumbnail/error behavior.
- Target loss, session end, relaunch, stop, and disposal remove the complete
  wrapper and its listeners with the active player.
- A late state-change event for a removed player is ignored by checking the
  active-player map.
- Transport actions operate only on the active player associated with their
  own wrapper.
- Existing playback error reporting is unchanged.

No timers or polling loops are introduced. Player-state synchronization is
event-driven.

## Testing

### Player manager unit tests

- The bar appears only after player readiness.
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

### Interaction regressions

- Floor gestures ignore descendants of the player wrapper, including all
  transport buttons.
- Marker runtime pointer interception ignores the transport buttons.
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
4. The control bar follows video movement, rotation, and scale.
5. Control taps never move, select, scale, or reposition the floor object.
6. The controls disappear and release player resources on every existing
   cleanup path.
7. Existing thumbnail activation, playback-error recovery, marker AR, floor
   AR, and target persistence behavior remain unchanged.
